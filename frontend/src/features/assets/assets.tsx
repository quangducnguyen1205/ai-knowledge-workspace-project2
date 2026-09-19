import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClientError,
  deleteAsset,
  getAssetStatus,
  getAssetTranscript,
  indexAssetTranscript,
  isApiClientError,
  listAssets,
  updateAssetTitle,
  uploadAsset,
  type AssetIndexResponse,
  type AssetStatus,
  type AssetStatusResponse,
  type AssetSummary,
  type ProcessingJobStatus,
  type TranscriptRow,
  type UpdateAssetTitleInput,
} from '../../lib/api';
import { buildTranscriptDisplayRows } from '../../lib/transcript-display';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime } from '../../lib/ui';

export const assetKeys = {
  all: ['assets'] as const,
  list: (workspaceId: string) => ['assets', 'list', workspaceId] as const,
  status: (assetId: string) => ['assets', 'status', assetId] as const,
  transcript: (assetId: string) => ['assets', 'transcript', assetId] as const,
};

export function isTerminalProcessing(status: ProcessingJobStatus | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED';
}

type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

type DeleteAssetInput = {
  assetId: string;
  workspaceId: string;
};

type RenameAssetInput = UpdateAssetTitleInput & {
  workspaceId: string;
};

type IndexActionState = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonTone: 'primary' | 'secondary' | 'ghost';
  canIndex: boolean;
};

type AssetLifecycleState = {
  step: string;
  summary: string;
  nextAction: string;
  tone: 'info' | 'success' | 'warning';
};

type AssetLifecycleStepState = 'complete' | 'current' | 'upcoming' | 'failed';

type AssetLifecycleStep = {
  label: string;
  description: string;
  state: AssetLifecycleStepState;
};

function getAssetStatusDescription(status: AssetStatus | null): string {
  switch (status) {
    case 'PROCESSING':
      return 'Processing the source and preparing transcript content.';
    case 'TRANSCRIPT_READY':
      return 'Transcript is ready for review. Index it to unlock workspace search.';
    case 'SEARCHABLE':
      return 'Indexed and searchable inside this workspace.';
    case 'FAILED':
      return 'Processing failed for this asset.';
    default:
      return 'Asset state not available yet.';
  }
}

function getTechnicalDetail(error: ApiClientError): string | undefined {
  const normalizedMessage = error.message.trim();

  if (!normalizedMessage) {
    return undefined;
  }

  if (
    ['bad request', 'conflict', 'unsupported media type', 'unprocessable entity'].includes(
      normalizedMessage.toLowerCase(),
    )
  ) {
    return error.code ? `Backend detail: ${error.code}` : undefined;
  }

  return error.code
    ? `Backend detail: ${error.code} - ${normalizedMessage}`
    : `Backend detail: ${normalizedMessage}`;
}

function getFriendlyUploadErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 0) {
    return {
      title: 'Upload is temporarily unavailable',
      message: 'We could not reach the service, so the upload did not start.',
    };
  }

  if ([400, 409, 413, 415, 422].includes(error.status)) {
    return {
      title: 'Upload was rejected',
      message:
        'This file could not be accepted for processing. Try a supported lecture video file and confirm the active workspace is still valid.',
      detail: getTechnicalDetail(error),
    };
  }

  if (
    (error.status === 502 && error.code === 'FASTAPI_INTEGRATION_ERROR') ||
    (error.status === 504 && error.code === 'FASTAPI_CONNECTIVITY_ERROR')
  ) {
    return {
      title: 'Upload could not start processing',
      message:
        'The current processing path could not accept this file right now. Use a supported lecture video file and try again.',
      detail: getTechnicalDetail(error),
    };
  }

  return null;
}

function getFriendlyDeleteErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset already removed',
      message: 'This asset no longer exists. The workspace list will refresh and clear any stale selection.',
      detail: getTechnicalDetail(error),
    };
  }

  if (
    (error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
    (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')
  ) {
    return {
      tone: 'error',
      title: 'Delete could not finish',
      message: 'The asset could not be removed because search infrastructure is unavailable right now. It will stay visible until deletion is confirmed.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Delete is temporarily unavailable',
      message: 'We could not reach the service, so this asset was not removed.',
    };
  }

  return {
    tone: 'error',
    title: 'Delete failed',
    message: 'The asset was not removed. The current list stays in place until deletion is confirmed.',
    detail: getTechnicalDetail(error),
  };
}

function getFriendlyRenameErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return {
      tone: 'warning',
      title: 'Title was rejected',
      message: 'Use a clear non-empty title within the current length limit, then save again.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset no longer exists',
      message: 'This asset could not be found anymore. The workspace list will refresh and clear stale selection if needed.',
      detail: getTechnicalDetail(error),
    };
  }

  if (
    (error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
    (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')
  ) {
    return {
      tone: 'error',
      title: 'Rename could not finish',
      message: 'The title could not be updated right now, so the previous title stays in place until the change is confirmed.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Rename is temporarily unavailable',
      message: 'We could not reach the service, so this title was not updated.',
    };
  }

  return {
    tone: 'error',
    title: 'Rename failed',
    message: 'The title update was not confirmed, so the previous title is still shown.',
    detail: getTechnicalDetail(error),
  };
}

function getTranscriptConflictCopy(
  error: unknown,
  resolvedAssetStatus: AssetStatus | null,
  processingJobStatus?: ProcessingJobStatus,
): FriendlyMessageCopy | null {
  if (!(isApiClientError(error) && error.status === 409)) {
    return null;
  }

  if (resolvedAssetStatus === 'FAILED' || processingJobStatus === 'FAILED') {
    return {
      title: 'Transcript is unavailable for this asset',
      message: 'Processing failed, so there are no transcript rows available to review or index.',
      detail: getTechnicalDetail(error),
    };
  }

  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Transcript is still being prepared',
      message:
        'Processing finished, but transcript rows are not available yet. Indexing stays disabled until the transcript is ready.',
      detail: getTechnicalDetail(error),
    };
  }

  return {
    title: 'Transcript is still being prepared',
    message: 'Transcript rows are not available yet. Wait for processing to finish before indexing.',
    detail: getTechnicalDetail(error),
  };
}

function getIndexActionState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): IndexActionState {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (transcriptRowCount > 0 && input.resolvedAssetStatus === 'SEARCHABLE') {
    return {
      title: 'Rebuild search documents',
      description:
        'This asset is already searchable. Re-index only if you want search documents refreshed from the current transcript.',
      buttonLabel: 'Re-index transcript',
      buttonTone: 'secondary',
      canIndex: true,
    };
  }

  if (transcriptRowCount > 0) {
    return {
      title: 'Make this asset searchable',
      description: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded. Publish this transcript to workspace search when you are ready.`,
      buttonLabel: 'Index transcript',
      buttonTone: 'primary',
      canIndex: true,
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      title: 'Indexing unavailable',
      description: 'Processing failed for this asset, so there is no transcript available to index.',
      buttonLabel: 'Indexing unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      title: 'Indexing unavailable',
      description: 'Wait for processing to finish and the transcript to load before indexing becomes available.',
      buttonLabel: 'Waiting for transcript',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      title: 'Indexing unavailable',
      description: 'Transcript rows are still unavailable for this asset, so indexing stays disabled for now.',
      buttonLabel: 'Transcript unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  return {
    title: 'Indexing unavailable',
    description: 'Transcript rows must be available before indexing can begin.',
    buttonLabel: 'Indexing unavailable',
    buttonTone: 'ghost',
    canIndex: false,
  };
}

function getAssetLifecycleState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): AssetLifecycleState {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (input.resolvedAssetStatus === 'SEARCHABLE') {
    return {
      step: 'Searchable',
      summary: 'This asset is indexed and can now participate in workspace search.',
      nextAction: 'Run a search and open transcript context around the most relevant hit.',
      tone: 'success',
    };
  }

  if (transcriptRowCount > 0) {
    return {
      step: 'Ready to index',
      summary: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded for this asset.`,
      nextAction: 'Review the transcript, then run the explicit indexing action to unlock search.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      step: 'Failed',
      summary: 'This asset cannot continue because processing failed.',
      nextAction: 'Select another asset in the workspace or upload a new file.',
      tone: 'warning',
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      step: 'Transcript pending',
      summary: 'Processing finished, but transcript rows are still unavailable.',
      nextAction: 'Stay on this asset until transcript rows appear. Indexing remains unavailable for now.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      step: 'Processing',
      summary: 'This asset is still being processed, so transcript review and indexing are not ready yet.',
      nextAction: 'Keep this asset selected to watch for transcript readiness and the next action.',
      tone: 'warning',
    };
  }

  return {
    step: 'Uploaded',
    summary: 'The asset is selected and waiting for its first processing update.',
    nextAction: 'Keep the asset selected so status, transcript, and indexing state stay in sync.',
    tone: 'info',
  };
}

function getLifecycleSteps(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): AssetLifecycleStep[] {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;
  const processingFailed = input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED';
  const processingComplete =
    !processingFailed &&
    (isTerminalProcessing(input.processingJobStatus) ||
      input.resolvedAssetStatus === 'TRANSCRIPT_READY' ||
      input.resolvedAssetStatus === 'SEARCHABLE' ||
      transcriptRowCount > 0);
  const transcriptReady =
    transcriptRowCount > 0 || input.resolvedAssetStatus === 'TRANSCRIPT_READY' || input.resolvedAssetStatus === 'SEARCHABLE';
  const transcriptPending =
    !processingFailed &&
    !transcriptReady &&
    ((isApiClientError(input.transcriptError) && input.transcriptError.status === 409) ||
      input.processingJobStatus === 'SUCCEEDED');

  return [
    {
      label: 'Uploaded',
      description: 'Asset saved to the workspace.',
      state: 'complete',
    },
    {
      label: 'Processing',
      description: processingFailed
        ? 'Processing failed.'
        : processingComplete
          ? 'Processing finished.'
          : 'Preparing transcript content.',
      state: processingFailed ? 'failed' : processingComplete ? 'complete' : 'current',
    },
    {
      label: 'Transcript',
      description: transcriptReady
        ? `${transcriptRowCount || 1} row${transcriptRowCount === 1 ? '' : 's'} ready.`
        : transcriptPending
          ? 'Waiting for transcript rows.'
          : 'Transcript not ready yet.',
      state: processingFailed ? 'upcoming' : transcriptReady ? 'complete' : transcriptPending ? 'current' : 'upcoming',
    },
    {
      label: 'Search',
      description:
        input.resolvedAssetStatus === 'SEARCHABLE'
          ? 'Indexed and searchable.'
          : transcriptReady
            ? 'Ready to index.'
            : 'Search is locked.',
      state:
        input.resolvedAssetStatus === 'SEARCHABLE'
          ? 'complete'
          : processingFailed
            ? 'upcoming'
            : transcriptReady
              ? 'current'
              : 'upcoming',
    },
  ];
}

export function deriveAssetStatus(
  asset: AssetSummary | null,
  statusResponse: AssetStatusResponse | undefined,
  transcriptRows: TranscriptRow[] | undefined,
  indexResponse: AssetIndexResponse | undefined,
): AssetStatus | null {
  if (indexResponse?.assetStatus) {
    return indexResponse.assetStatus;
  }

  if (asset?.assetStatus === 'SEARCHABLE' || statusResponse?.assetStatus === 'SEARCHABLE') {
    return 'SEARCHABLE';
  }

  if (transcriptRows?.length) {
    return 'TRANSCRIPT_READY';
  }

  return statusResponse?.assetStatus ?? asset?.assetStatus ?? null;
}

export function useAssetsQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? assetKeys.list(workspaceId) : ['assets', 'list', 'empty'],
    queryFn: () => listAssets(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useUploadAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadAsset,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
    },
  });
}

export function useDeleteAssetMutation() {
  return useMutation({
    mutationFn: ({ assetId }: DeleteAssetInput) => deleteAsset(assetId),
  });
}

export function useRenameAssetMutation() {
  return useMutation({
    mutationFn: ({ assetId, title }: RenameAssetInput) => updateAssetTitle({ assetId, title }),
  });
}

export function useAssetStatusQuery(assetId: string | null, pollingEnabled: boolean) {
  return useQuery({
    queryKey: assetId ? assetKeys.status(assetId) : ['assets', 'status', 'empty'],
    queryFn: () => getAssetStatus(assetId as string),
    enabled: Boolean(assetId),
    refetchInterval: pollingEnabled ? 3_000 : false,
  });
}

export function useAssetTranscriptQuery(assetId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: assetId ? assetKeys.transcript(assetId) : ['assets', 'transcript', 'empty'],
    queryFn: () => getAssetTranscript(assetId as string),
    enabled,
    retry: false,
  });
}

export function useIndexAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: indexAssetTranscript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.all });
    },
  });
}

export function StatusBadge({ status }: { status: AssetStatus | null }) {
  const normalizedStatus = status ?? 'PROCESSING';

  return <span className={`status-badge status-badge--${normalizedStatus.toLowerCase()}`}>{normalizedStatus}</span>;
}

export function AssetsPanel({
  workspaceName,
  assets,
  selectedAssetId,
  successNotice,
  assetsError,
  deleteError,
  deleteBusy,
  deletingAssetId,
  assetsLoading,
  uploadError,
  uploadSuccessId,
  isUploading,
  onSelectAsset,
  onDeleteAsset,
  onUpload,
}: {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAssetId: string | null;
  successNotice: { title: string; message: string } | null;
  assetsError: unknown;
  deleteError: unknown;
  deleteBusy: boolean;
  deletingAssetId: string | null;
  assetsLoading: boolean;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
  onUpload: (input: { file: File; title?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadErrorCopy = getFriendlyUploadErrorCopy(uploadError);
  const deleteErrorCopy = getFriendlyDeleteErrorCopy(deleteError);

  useEffect(() => {
    if (uploadSuccessId) {
      setTitle('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      return;
    }

    onUpload({
      file,
      title: title.trim() || undefined,
    });
  }

  return (
    <Section
      title="Asset Library"
      eyebrow={workspaceName}
      actions={<span className="panel-pill">{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</span>}
    >
      <div className="upload-card">
        <div className="upload-card__copy">
          <p className="panel__eyebrow">Add source material</p>
          <h3>Upload a lecture video</h3>
          <p>Every uploaded asset moves through transcript review, explicit indexing, and focused workspace search.</p>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Asset title</span>
            <input
              className="field__input"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave blank to use the filename"
              maxLength={255}
            />
          </label>

          <label className="field">
            <span className="field__label">Source file</span>
            <input
              ref={fileInputRef}
              className="field__input field__input--file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              accept="video/*,.mp4,.mov,.m4v,.webm,.avi"
            />
            <span className="field__hint">Use a lecture video file for the current product flow. MP4 works well for local smoke checks.</span>
          </label>

          <div className="upload-card__actions">
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? `Uploading to ${workspaceName}...` : 'Upload to workspace'}
            </Button>
            <span className="upload-card__hint">Uploaded assets appear in the library first, then move through processing.</span>
          </div>

          {file ? (
            <div className="selected-file">
              <strong>Selected file</strong>
              <span>{file.name}</span>
            </div>
          ) : null}

          {isUploading ? (
            <InfoBanner
              title="Upload in progress"
              message={`Adding the selected file to ${workspaceName}. It will appear in the library and continue processing in place.`}
            />
          ) : null}

          {uploadError ? (
            <ErrorBanner
              error={uploadError}
              title={uploadErrorCopy?.title}
              message={uploadErrorCopy?.message}
              detail={uploadErrorCopy?.detail}
            />
          ) : null}
        </form>
      </div>

      <div className="asset-list">
        <div className="asset-list__meta">
          <strong>{assets.length}</strong>
          <span>{assets.length === 1 ? 'asset in this workspace' : 'assets in this workspace'}</span>
        </div>

        <div className="status-legend">
          <span className="status-legend__label">Status legend</span>
          <StatusBadge status="PROCESSING" />
          <StatusBadge status="TRANSCRIPT_READY" />
          <StatusBadge status="SEARCHABLE" />
          <StatusBadge status="FAILED" />
        </div>

        {assetsLoading ? <LoadingBlock label="Loading workspace assets..." compact /> : null}
        {!assetsLoading && assetsError ? <ErrorBanner error={assetsError} /> : null}
        {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'warning' ? (
          <InfoBanner
            tone="warning"
            title={deleteErrorCopy.title}
            message={deleteErrorCopy.message}
            detail={deleteErrorCopy.detail}
          />
        ) : null}
        {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'error' ? (
          <ErrorBanner
            error={deleteError}
            title={deleteErrorCopy.title}
            message={deleteErrorCopy.message}
            detail={deleteErrorCopy.detail}
          />
        ) : null}
        {!assetsLoading && !assetsError && successNotice ? (
          <InfoBanner tone="success" title={successNotice.title} message={successNotice.message} />
        ) : null}

        {!assetsLoading && !assetsError && assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            description="Upload a lecture video to start transcript review and prepare this workspace for search."
          />
        ) : null}

        {!assetsLoading && !assetsError && assets.length > 0 ? (
          <ul className="asset-list__items">
            {assets.map((asset) => {
              const isSelected = asset.assetId === selectedAssetId;
              const isDeleting = deletingAssetId === asset.assetId;

              return (
                <li key={asset.assetId} className="asset-row">
                  <button
                    type="button"
                    className={`asset-card ${isSelected ? 'asset-card--selected' : ''}`}
                    onClick={() => onSelectAsset(asset.assetId)}
                  >
                    <div className="asset-card__header">
                      <strong>{asset.title}</strong>
                      <StatusBadge status={asset.assetStatus} />
                    </div>
                    <div className="asset-card__meta">
                      <span>{formatDateTime(asset.createdAt)}</span>
                      <span className="asset-card__id">{asset.assetId}</span>
                    </div>
                    <p className="asset-card__summary">{getAssetStatusDescription(asset.assetStatus)}</p>
                  </button>
                  <Button
                    type="button"
                    tone="ghost"
                    className="asset-row__delete"
                    onClick={() => onDeleteAsset(asset)}
                    disabled={deleteBusy}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

type SelectedAssetPanelProps = {
  asset: AssetSummary | null;
  workspaceName: string;
  successNotice: { title: string; message: string } | null;
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  statusError: unknown;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
  transcriptLoading: boolean;
  indexError: unknown;
  indexResponse?: AssetIndexResponse;
  isIndexing: boolean;
  isRenaming: boolean;
  renameError: unknown;
  onIndex: () => void;
  onRename: (title: string) => void;
  onResetRename: () => void;
};

export function SelectedAssetPanel({
  asset,
  workspaceName,
  successNotice,
  resolvedAssetStatus,
  statusResponse,
  statusError,
  transcriptRows,
  transcriptError,
  transcriptLoading,
  indexError,
  indexResponse,
  isIndexing,
  isRenaming,
  renameError,
  onIndex,
  onRename,
  onResetRename,
}: SelectedAssetPanelProps) {
  const transcriptRowCount = transcriptRows?.length ?? 0;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const normalizedDraftTitle = draftTitle.trim();
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);
  const indexActionState = getIndexActionState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });
  const lifecycleState = getAssetLifecycleState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });
  const lifecycleSteps = getLifecycleSteps({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });
  const statusPairs = useMemo(
    () => [
      ['Workspace', workspaceName],
      ['Asset status', resolvedAssetStatus ?? 'Unknown'],
      ['Processing job', statusResponse?.processingJobStatus ?? 'Waiting for status'],
      ['Transcript rows', transcriptRowCount > 0 ? String(transcriptRowCount) : 'Not loaded yet'],
      ['Created', asset ? formatDateTime(asset.createdAt) : 'Unknown'],
    ],
    [asset, resolvedAssetStatus, statusResponse?.processingJobStatus, transcriptRowCount, workspaceName],
  );

  useEffect(() => {
    if (!asset) {
      setDraftTitle('');
      setIsEditingTitle(false);
      return;
    }

    setDraftTitle(asset.title);
    setIsEditingTitle(false);
  }, [asset?.assetId, asset?.title]);

  if (!asset) {
    return (
      <Section title="Asset Detail" eyebrow="Asset details">
        <EmptyState
          title="Pick an asset"
          description="Choose an uploaded asset to review status, read the transcript, and control when it becomes searchable."
        />
      </Section>
    );
  }

  return (
    <Section title="Asset Detail" eyebrow={workspaceName} actions={<StatusBadge status={resolvedAssetStatus} />}>
      <div className="selected-asset-title">
        <div className="selected-asset-title__copy">
          <p className="panel__eyebrow">Selected asset</p>
          {!isEditingTitle ? <h3>{asset.title}</h3> : null}
          {!isEditingTitle ? (
            <p className="selected-asset-title__hint">
              Keep the title clear here so it stays readable in the library and search results.
            </p>
          ) : null}
        </div>

        {!isEditingTitle ? (
          <Button
            type="button"
            tone="ghost"
            className="button--inline"
            onClick={() => {
              onResetRename();
              setDraftTitle(asset.title);
              setIsEditingTitle(true);
            }}
            disabled={isRenaming}
          >
            Rename
          </Button>
        ) : (
          <form
            className="selected-asset-title__form"
            onSubmit={(event) => {
              event.preventDefault();
              const normalizedTitle = draftTitle.trim();

              if (normalizedTitle === asset.title.trim()) {
                onResetRename();
                setDraftTitle(asset.title);
                setIsEditingTitle(false);
                return;
              }

              onRename(normalizedTitle);
            }}
          >
            <input
              className="field__input"
              type="text"
              value={draftTitle}
              onChange={(event) => {
                if (renameError) {
                  onResetRename();
                }
                setDraftTitle(event.target.value);
              }}
              maxLength={255}
              autoFocus
              disabled={isRenaming}
            />
            <div className="selected-asset-title__actions">
              <Button
                type="submit"
                className="button--inline"
                disabled={isRenaming || !normalizedDraftTitle || normalizedDraftTitle === asset.title.trim()}
              >
                {isRenaming ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                tone="ghost"
                className="button--inline"
                onClick={() => {
                  onResetRename();
                  setDraftTitle(asset.title);
                  setIsEditingTitle(false);
                }}
                disabled={isRenaming}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {renameErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          tone="warning"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}
      {renameErrorCopy?.tone === 'error' ? (
        <ErrorBanner
          error={renameError}
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}
      {successNotice ? <InfoBanner tone="success" title={successNotice.title} message={successNotice.message} /> : null}

      <div className="detail-grid">
        {statusPairs.map(([label, value]) => (
          <div key={label} className="detail-grid__item">
            <span className="detail-grid__label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="lifecycle-rail">
        {lifecycleSteps.map((step, index) => (
          <div key={step.label} className={`lifecycle-step lifecycle-step--${step.state}`}>
            <span className="lifecycle-step__index">{index + 1}</span>
            <div className="lifecycle-step__copy">
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {statusError ? <ErrorBanner error={statusError} /> : null}

      {!statusError ? (
        <InfoBanner
          tone={lifecycleState.tone}
          title={`Current asset step: ${lifecycleState.step}`}
          message={lifecycleState.summary}
          detail={`Next: ${lifecycleState.nextAction}`}
        />
      ) : null}

      <div className={`action-card ${!indexActionState.canIndex ? 'action-card--muted' : ''}`}>
        <div className="action-card__copy">
          <p className="panel__eyebrow">Explicit indexing</p>
          <h3>{indexActionState.title}</h3>
          <p>{indexActionState.description}</p>
        </div>
        <Button
          type="button"
          tone={indexActionState.buttonTone}
          onClick={onIndex}
          disabled={!indexActionState.canIndex || isIndexing}
        >
          {isIndexing ? 'Indexing...' : indexActionState.buttonLabel}
        </Button>
      </div>

      {isIndexing ? (
        <InfoBanner
          title="Indexing transcript"
          message="Publishing transcript rows to workspace search so this asset becomes discoverable."
        />
      ) : null}

      {indexResponse ? (
        <InfoBanner
          tone="success"
          title="Indexing complete"
          message={`Indexed ${indexResponse.indexedDocumentCount} transcript rows for this asset.`}
        />
      ) : null}
      {indexError ? <ErrorBanner error={indexError} /> : null}
    </Section>
  );
}

export function SelectedAssetTranscriptPanel({
  asset,
  workspaceName,
  resolvedAssetStatus,
  statusResponse,
  transcriptRows,
  transcriptError,
  transcriptLoading,
}: Pick<
  SelectedAssetPanelProps,
  'asset' | 'workspaceName' | 'resolvedAssetStatus' | 'statusResponse' | 'transcriptRows' | 'transcriptError' | 'transcriptLoading'
>) {
  const transcriptConflictCopy = getTranscriptConflictCopy(
    transcriptError,
    resolvedAssetStatus,
    statusResponse?.processingJobStatus,
  );
  const displayTranscriptRows = useMemo(
    () => (transcriptRows?.length ? buildTranscriptDisplayRows(transcriptRows) : []),
    [transcriptRows],
  );

  if (!asset) {
    return null;
  }

  return (
    <Section title="Transcript Review" eyebrow={workspaceName}>
      <div className="panel-block">
        <div className="panel-block__header">
          <h3>Transcript</h3>
          <span className="context-panel__hint">Transcript rows appear here as soon as they are ready</span>
        </div>

        {transcriptLoading ? <LoadingBlock label="Loading transcript rows..." /> : null}
        {!transcriptLoading && transcriptConflictCopy ? (
          <InfoBanner
            tone="warning"
            title={transcriptConflictCopy.title}
            message={transcriptConflictCopy.message}
            detail={transcriptConflictCopy.detail}
          />
        ) : null}
        {!transcriptLoading && transcriptError && !transcriptConflictCopy ? <ErrorBanner error={transcriptError} /> : null}
        {!transcriptLoading && !transcriptError && !transcriptRows?.length ? (
          <EmptyState
            title="Transcript not loaded yet"
            description="Keep this asset selected. Transcript rows will appear here as soon as processing completes successfully."
          />
        ) : null}

        {displayTranscriptRows.length ? (
          <ol className="transcript-list">
            {displayTranscriptRows.map(({ row, displayText, overlapHidden }) => (
              <li key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`} className="transcript-list__item">
                <div className="transcript-list__meta">
                  <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                  <span>{formatDateTime(row.createdAt)}</span>
                  {overlapHidden ? <span className="transcript-overlap-note">Overlap hidden</span> : null}
                </div>
                <p>{displayText}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Section>
  );
}
