import { type AssetSummary } from '../../lib/api';
import { Button, Section } from '../../lib/ui';
import { AssetsPanel } from './assets';

type AssetLibraryScreenProps = {
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
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

export function AssetLibraryScreen({
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
  onOpenSearch,
  onOpenSettings,
}: AssetLibraryScreenProps) {
  const processingCount = assets.filter((asset) => asset.assetStatus === 'PROCESSING').length;
  const transcriptReadyCount = assets.filter((asset) => asset.assetStatus === 'TRANSCRIPT_READY').length;
  const searchableCount = assets.filter((asset) => asset.assetStatus === 'SEARCHABLE').length;

  return (
    <div className="screen-grid screen-grid--library">
      <div className="screen-main">
        <AssetsPanel
          workspaceName={workspaceName}
          assets={assets}
          selectedAssetId={selectedAssetId}
          successNotice={successNotice}
          assetsError={assetsError}
          deleteError={deleteError}
          deleteBusy={deleteBusy}
          deletingAssetId={deletingAssetId}
          assetsLoading={assetsLoading}
          uploadError={uploadError}
          uploadSuccessId={uploadSuccessId}
          isUploading={isUploading}
          onSelectAsset={onSelectAsset}
          onDeleteAsset={onDeleteAsset}
          onUpload={onUpload}
        />
      </div>

      <div className="screen-side">
        <Section title="Library health" eyebrow={workspaceName}>
          <div className="summary-list">
            <div className="summary-list__item">
              <span className="summary-list__label">Processing</span>
              <strong>{processingCount}</strong>
            </div>
            <div className="summary-list__item">
              <span className="summary-list__label">Transcript ready</span>
              <strong>{transcriptReadyCount}</strong>
            </div>
            <div className="summary-list__item">
              <span className="summary-list__label">Searchable</span>
              <strong>{searchableCount}</strong>
            </div>
          </div>
        </Section>

        <Section title="Next actions" eyebrow="Product flow">
          <div className="guidance-card">
            <strong>{searchableCount > 0 ? 'Search is ready' : transcriptReadyCount > 0 ? 'Review transcript readiness' : 'Keep uploads moving'}</strong>
            <p>
              {searchableCount > 0
                ? 'At least one asset is searchable. Open the search screen to validate result quality and transcript context.'
                : transcriptReadyCount > 0
                  ? 'One or more assets are waiting for explicit indexing. Open an asset detail view and publish the transcript.'
                  : 'Use this library to upload lecture videos, watch processing states, and keep the workspace organized.'}
            </p>
            <div className="guidance-card__actions">
              <Button type="button" onClick={onOpenSearch} disabled={searchableCount === 0}>
                Open search
              </Button>
              <Button type="button" tone="ghost" onClick={onOpenSettings}>
                Workspace settings
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
