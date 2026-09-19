import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type AssetStatus, ApiClientError, type AssetSummary, type SearchResponse, type SearchResult } from '../lib/api';
import { Button, EmptyState, ErrorBanner, LoadingBlock } from '../lib/ui';
import { useHashRoute, type AppRoute } from './router';
import {
  useCurrentUserQuery,
  AuthEntrySurface,
  authKeys,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from '../features/auth/auth';
import {
  assetKeys,
  deriveAssetStatus,
  isTerminalProcessing,
  useDeleteAssetMutation,
  useRenameAssetMutation,
  useAssetStatusQuery,
  useAssetTranscriptQuery,
  useAssetsQuery,
  useIndexAssetMutation,
  useUploadAssetMutation,
} from '../features/assets/assets';
import { AssetLibraryScreen } from '../features/assets/library-screen';
import { AssetDetailScreen } from '../features/assets/detail-screen';
import { WorkspaceHomeScreen } from '../features/dashboard/dashboard';
import { searchKeys, resolveTranscriptLookupId, useSearchQuery, useTranscriptContextQuery } from '../features/search/search';
import { WorkspaceSearchScreen } from '../features/search/search-screen';
import { SettingsScreen } from '../features/settings/settings';
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRenameWorkspaceMutation,
  useWorkspacesQuery,
  WorkspaceBar,
  workspaceKeys,
} from '../features/workspaces/workspaces';

const lastWorkspaceSelectionStorageKey = 'akw:last-workspace-id';

type SuccessNotice = {
  title: string;
  message: string;
};

type ShellNavItem = {
  label: string;
  route: AppRoute;
  disabled?: boolean;
  isActive: boolean;
};

function readStoredWorkspaceSelection(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(lastWorkspaceSelectionStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredWorkspaceSelection(workspaceId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(lastWorkspaceSelectionStorageKey, workspaceId);
  } catch {
    // Ignore storage failures and keep the shell functional.
  }
}

function canLoadTranscript(assetStatus: AssetStatus | null, processingJobStatus?: string): boolean {
  return (
    assetStatus === 'TRANSCRIPT_READY' ||
    assetStatus === 'SEARCHABLE' ||
    processingJobStatus === 'SUCCEEDED'
  );
}

export function AppShell() {
  const queryClient = useQueryClient();
  const [route, navigate] = useHashRoute();
  const [isTransitionPending, startTransition] = useTransition();

  const currentUserQuery = useCurrentUserQuery();
  const registerMutation = useRegisterMutation();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const isAuthenticated = currentUserQuery.isSuccess;
  const currentUser = currentUserQuery.data ?? null;
  const isAuthRequired =
    currentUserQuery.error instanceof ApiClientError &&
    currentUserQuery.error.status === 401 &&
    currentUserQuery.error.code === 'AUTHENTICATION_REQUIRED';

  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const renameWorkspaceMutation = useRenameWorkspaceMutation();
  const deleteWorkspaceMutation = useDeleteWorkspaceMutation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(() => readStoredWorkspaceSelection());
  const [workspaceScopeRefreshAfter, setWorkspaceScopeRefreshAfter] = useState<number | null>(null);

  useEffect(() => {
    const workspaces = workspacesQuery.data ?? [];

    if (workspaceScopeRefreshAfter !== null) {
      if (workspacesQuery.dataUpdatedAt <= workspaceScopeRefreshAfter) {
        return;
      }

      if (!workspaces.length) {
        setWorkspaceScopeRefreshAfter(null);
        return;
      }

      const restoredWorkspace = preferredWorkspaceId
        ? workspaces.find((workspace) => workspace.id === preferredWorkspaceId)
        : null;

      startTransition(() => setSelectedWorkspaceId(restoredWorkspace?.id ?? workspaces[0].id));
      setWorkspaceScopeRefreshAfter(null);
      return;
    }

    if (!workspaces.length) {
      return;
    }

    if (preferredWorkspaceId) {
      const preferredWorkspace = workspaces.find((workspace) => workspace.id === preferredWorkspaceId);
      if (preferredWorkspace) {
        startTransition(() => setSelectedWorkspaceId(preferredWorkspace.id));
        setPreferredWorkspaceId(null);
        return;
      }
    }

    if (selectedWorkspaceId && workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      return;
    }

    startTransition(() => setSelectedWorkspaceId(workspaces[0].id));
  }, [
    preferredWorkspaceId,
    selectedWorkspaceId,
    startTransition,
    workspaceScopeRefreshAfter,
    workspacesQuery.data,
    workspacesQuery.dataUpdatedAt,
  ]);

  const selectedWorkspace = useMemo(
    () => workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspacesQuery.data],
  );

  const assetsQuery = useAssetsQuery(selectedWorkspaceId);
  const uploadMutation = useUploadAssetMutation();
  const indexMutation = useIndexAssetMutation();
  const deleteMutation = useDeleteAssetMutation();
  const renameMutation = useRenameAssetMutation();
  const [workspaceSuccessNotice, setWorkspaceSuccessNotice] = useState<SuccessNotice | null>(null);
  const [assetLibrarySuccessNotice, setAssetLibrarySuccessNotice] = useState<SuccessNotice | null>(null);
  const [assetDetailSuccessNotice, setAssetDetailSuccessNotice] = useState<SuccessNotice | null>(null);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [preferredAssetId, setPreferredAssetId] = useState<string | null>(null);
  const selectedAssetIdRef = useRef<string | null>(null);
  const preferredAssetIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedAssetId(null);
    setPreferredAssetId(null);
    setAssetLibrarySuccessNotice(null);
    setAssetDetailSuccessNotice(null);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    setWorkspaceSuccessNotice(null);
    setAssetLibrarySuccessNotice(null);
    setAssetDetailSuccessNotice(null);
  }, [currentUser?.id]);

  useEffect(() => {
    selectedAssetIdRef.current = selectedAssetId;
  }, [selectedAssetId]);

  useEffect(() => {
    setAssetDetailSuccessNotice(null);
  }, [selectedAssetId]);

  useEffect(() => {
    preferredAssetIdRef.current = preferredAssetId;
  }, [preferredAssetId]);

  const routedAssetId = route.name === 'asset' ? route.assetId : null;

  useEffect(() => {
    if (!routedAssetId) {
      return;
    }

    if (routedAssetId === selectedAssetIdRef.current || routedAssetId === preferredAssetIdRef.current) {
      return;
    }

    setPreferredAssetId(routedAssetId);
  }, [routedAssetId]);

  useEffect(() => {
    const assets = assetsQuery.data ?? [];

    if (preferredAssetId) {
      const preferredAsset = assets.find((asset) => asset.assetId === preferredAssetId);
      if (preferredAsset) {
        startTransition(() => setSelectedAssetId(preferredAsset.assetId));
        setPreferredAssetId(null);
        return;
      }

      if (assetsQuery.isFetching) {
        return;
      }
    }

    if (!assets.length) {
      setSelectedAssetId(null);
      return;
    }

    if (selectedAssetId && assets.some((asset) => asset.assetId === selectedAssetId)) {
      return;
    }

    startTransition(() => setSelectedAssetId(assets[0].assetId));
  }, [assetsQuery.data, assetsQuery.isFetching, preferredAssetId, selectedAssetId, startTransition]);

  const selectedAsset = useMemo(
    () => assetsQuery.data?.find((asset) => asset.assetId === selectedAssetId) ?? null,
    [assetsQuery.data, selectedAssetId],
  );

  const [statusPollingEnabled, setStatusPollingEnabled] = useState(false);

  useEffect(() => {
    setStatusPollingEnabled(Boolean(selectedAssetId) && selectedAsset?.assetStatus === 'PROCESSING');
  }, [selectedAsset?.assetStatus, selectedAssetId]);

  useEffect(() => {
    indexMutation.reset();
  }, [indexMutation.reset, selectedAssetId]);

  const assetStatusQuery = useAssetStatusQuery(selectedAssetId, statusPollingEnabled);

  useEffect(() => {
    if (!selectedWorkspaceId || !assetStatusQuery.data) {
      return;
    }

    if (selectedAsset?.assetStatus !== assetStatusQuery.data.assetStatus) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
    }

    if (isTerminalProcessing(assetStatusQuery.data.processingJobStatus)) {
      setStatusPollingEnabled(false);
    }
  }, [assetStatusQuery.data, queryClient, selectedAsset?.assetStatus, selectedWorkspaceId]);

  const transcriptQuery = useAssetTranscriptQuery(
    selectedAssetId,
    Boolean(selectedAssetId) &&
      selectedAsset?.assetStatus !== 'FAILED' &&
      canLoadTranscript(selectedAsset?.assetStatus ?? null, assetStatusQuery.data?.processingJobStatus),
  );

  useEffect(() => {
    if (transcriptQuery.isSuccess && selectedWorkspaceId) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
    }
  }, [queryClient, selectedWorkspaceId, transcriptQuery.dataUpdatedAt, transcriptQuery.isSuccess]);

  useEffect(() => {
    if (
      transcriptQuery.error instanceof ApiClientError &&
      transcriptQuery.error.status === 409 &&
      selectedWorkspaceId &&
      selectedAssetId
    ) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: assetKeys.status(selectedAssetId) });
    }
  }, [queryClient, selectedAssetId, selectedWorkspaceId, transcriptQuery.error]);

  const resolvedAssetStatus = useMemo(
    () =>
      deriveAssetStatus(
        selectedAsset,
        assetStatusQuery.data,
        transcriptQuery.data,
        indexMutation.data?.assetId === selectedAssetId ? indexMutation.data : undefined,
      ),
    [assetStatusQuery.data, indexMutation.data, selectedAsset, selectedAssetId, transcriptQuery.data],
  );

  const displayAssets = useMemo(() => {
    const assets = assetsQuery.data ?? [];

    if (!selectedAssetId || !resolvedAssetStatus) {
      return assets;
    }

    return assets.map((asset) =>
      asset.assetId === selectedAssetId && asset.assetStatus !== resolvedAssetStatus
        ? { ...asset, assetStatus: resolvedAssetStatus }
        : asset,
    );
  }, [assetsQuery.data, resolvedAssetStatus, selectedAssetId]);

  const searchableAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'SEARCHABLE').length,
    [displayAssets],
  );
  const processingAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'PROCESSING').length,
    [displayAssets],
  );
  const transcriptReadyAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'TRANSCRIPT_READY').length,
    [displayAssets],
  );

  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [searchResetToken, setSearchResetToken] = useState(0);
  const selectedSearchResultRef = useRef<SearchResult | null>(null);
  const [assetDetailSubmittedSearch, setAssetDetailSubmittedSearch] = useState<string | null>(null);
  const [selectedAssetDetailSearchResult, setSelectedAssetDetailSearchResult] = useState<SearchResult | null>(null);
  const [assetDetailSearchResetToken, setAssetDetailSearchResetToken] = useState(0);
  const selectedAssetDetailSearchResultRef = useRef<SearchResult | null>(null);

  useEffect(() => {
    selectedSearchResultRef.current = selectedSearchResult;
  }, [selectedSearchResult]);

  useEffect(() => {
    selectedAssetDetailSearchResultRef.current = selectedAssetDetailSearchResult;
  }, [selectedAssetDetailSearchResult]);

  useEffect(() => {
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
  }, [selectedAssetId]);

  useEffect(() => {
    uploadMutation.reset();
  }, [selectedWorkspaceId, uploadMutation.reset]);

  useEffect(() => {
    if (!renameMutation.isPending && renameMutation.variables?.assetId !== selectedAssetId) {
      renameMutation.reset();
    }
  }, [renameMutation.isPending, renameMutation.reset, renameMutation.variables?.assetId, selectedAssetId]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      writeStoredWorkspaceSelection(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const searchQuery = useSearchQuery(
    submittedSearch && selectedWorkspaceId ? { query: submittedSearch, workspaceId: selectedWorkspaceId } : null,
  );
  const assetDetailSearchQuery = useSearchQuery(
    assetDetailSubmittedSearch && selectedWorkspaceId && selectedAssetId
      ? { query: assetDetailSubmittedSearch, workspaceId: selectedWorkspaceId, assetId: selectedAssetId }
      : null,
  );

  const contextLookupId = selectedSearchResult ? resolveTranscriptLookupId(selectedSearchResult) : null;
  const assetDetailContextLookupId = selectedAssetDetailSearchResult
    ? resolveTranscriptLookupId(selectedAssetDetailSearchResult)
    : null;

  const contextQuery = useTranscriptContextQuery(
    selectedSearchResult && contextLookupId
      ? {
          assetId: selectedSearchResult.assetId,
          transcriptRowId: contextLookupId,
          window: 2,
        }
      : null,
  );
  const assetDetailContextQuery = useTranscriptContextQuery(
    selectedAssetDetailSearchResult && assetDetailContextLookupId
      ? {
          assetId: selectedAssetDetailSearchResult.assetId,
          transcriptRowId: assetDetailContextLookupId,
          window: 2,
        }
      : null,
  );

  useEffect(() => {
    const uploadedAssetId = uploadMutation.data?.assetId;

    if (!uploadedAssetId) {
      return;
    }

    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
  }, [uploadMutation.data?.assetId]);

  useEffect(() => {
    const indexedAssetId = indexMutation.data?.assetId;

    if (!indexedAssetId) {
      return;
    }

    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
    if (indexedAssetId === selectedAssetIdRef.current) {
      setAssetDetailSubmittedSearch(null);
      setSelectedAssetDetailSearchResult(null);
      setAssetDetailSearchResetToken((current) => current + 1);
    }
  }, [indexMutation.data?.assetId]);

  useEffect(() => {
    const results = searchQuery.data?.results;

    if (!selectedSearchResult || !results) {
      return;
    }

    const stillPresent = results.some(
      (result) =>
        result.assetId === selectedSearchResult.assetId &&
        result.transcriptRowId === selectedSearchResult.transcriptRowId &&
        result.segmentIndex === selectedSearchResult.segmentIndex,
    );

    if (!stillPresent) {
      setSelectedSearchResult(null);
    }
  }, [searchQuery.data?.results, selectedSearchResult]);

  useEffect(() => {
    const results = assetDetailSearchQuery.data?.results;

    if (!selectedAssetDetailSearchResult || !results) {
      return;
    }

    const stillPresent = results.some(
      (result) =>
        result.assetId === selectedAssetDetailSearchResult.assetId &&
        result.transcriptRowId === selectedAssetDetailSearchResult.transcriptRowId &&
        result.segmentIndex === selectedAssetDetailSearchResult.segmentIndex,
    );

    if (!stillPresent) {
      setSelectedAssetDetailSearchResult(null);
    }
  }, [assetDetailSearchQuery.data?.results, selectedAssetDetailSearchResult]);

  useEffect(() => {
    if (selectedWorkspace) {
      return;
    }

    if (route.name === 'home' || route.name === 'settings') {
      return;
    }

    navigate({ name: 'home' });
  }, [navigate, route.name, selectedWorkspace]);

  useEffect(() => {
    if (route.name !== 'asset') {
      return;
    }

    if (!selectedWorkspace || assetsQuery.isFetching) {
      return;
    }

    const availableAssets = assetsQuery.data ?? [];
    if (!availableAssets.length || !availableAssets.some((asset) => asset.assetId === route.assetId)) {
      navigate({ name: 'library' });
    }
  }, [assetsQuery.data, assetsQuery.isFetching, navigate, route, selectedWorkspace]);

  function handleCreateWorkspace(name: string) {
    setWorkspaceSuccessNotice(null);
    createWorkspaceMutation.mutate(name, {
      onSuccess: (workspace) => {
        setPreferredWorkspaceId(workspace.id);
        setWorkspaceSuccessNotice({
          title: 'Workspace created',
          message: `Created "${workspace.name}" and refreshed the visible workspace scope.`,
        });
      },
    });
  }

  function handleSelectWorkspace(workspaceId: string) {
    setWorkspaceSuccessNotice(null);
    setPreferredWorkspaceId(workspaceId);
    setPreferredAssetId(null);
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
    startTransition(() => setSelectedWorkspaceId(workspaceId));
  }

  function clearWorkspaceScopedState(workspaceId: string) {
    const previousSelectedAssetId = selectedAssetIdRef.current;

    if (previousSelectedAssetId) {
      queryClient.removeQueries({ queryKey: assetKeys.status(previousSelectedAssetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(previousSelectedAssetId) });
    }

    queryClient.removeQueries({ queryKey: assetKeys.list(workspaceId) });
    queryClient.removeQueries({ queryKey: ['search', 'results', workspaceId] });
    queryClient.removeQueries({ queryKey: searchKeys.all });

    setPreferredWorkspaceId(null);
    setSelectedAssetId(null);
    setPreferredAssetId(null);
    setStatusPollingEnabled(false);
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setAssetLibrarySuccessNotice(null);
    setAssetDetailSuccessNotice(null);
    setSearchResetToken((current) => current + 1);
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
    startTransition(() => setSelectedWorkspaceId(null));
  }

  function handleRenameWorkspace(input: { workspaceId: string; name: string }) {
    setWorkspaceSuccessNotice(null);
    renameWorkspaceMutation.mutate(input, {
      onSuccess: (workspace) => {
        setWorkspaceSuccessNotice({
          title: 'Workspace renamed',
          message: `Active workspace is now "${workspace.name}".`,
        });
      },
      onError: async (error, variables) => {
        if (error instanceof ApiClientError && error.status === 404) {
          setWorkspaceScopeRefreshAfter(Date.now());
          clearWorkspaceScopedState(variables.workspaceId);
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
        }
      },
    });
  }

  function handleDeleteWorkspace() {
    if (!selectedWorkspace || deleteWorkspaceMutation.isPending) {
      return;
    }

    const deletingWorkspaceName = selectedWorkspace.name;
    const confirmed = window.confirm(
      `Delete workspace "${deletingWorkspaceName}"?\n\nOnly empty non-default workspaces can be removed. This will refresh the visible workspace scope.`,
    );

    if (!confirmed) {
      return;
    }

    setWorkspaceSuccessNotice(null);
    deleteWorkspaceMutation.mutate(
      { workspaceId: selectedWorkspace.id },
      {
        onSuccess: async (_response, variables) => {
          setWorkspaceScopeRefreshAfter(Date.now());
          clearWorkspaceScopedState(variables.workspaceId);
          navigate({ name: 'home' });
          setWorkspaceSuccessNotice({
            title: 'Workspace deleted',
            message: `Removed "${deletingWorkspaceName}" and refreshed the visible workspace scope.`,
          });
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            setWorkspaceScopeRefreshAfter(Date.now());
            clearWorkspaceScopedState(variables.workspaceId);
            await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
          }
        },
      },
    );
  }

  function clearSessionScopedState() {
    const previousSelectedAssetId = selectedAssetIdRef.current;

    if (previousSelectedAssetId) {
      queryClient.removeQueries({ queryKey: assetKeys.status(previousSelectedAssetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(previousSelectedAssetId) });
    }

    setSelectedAssetId(null);
    setPreferredAssetId(null);
    setStatusPollingEnabled(false);
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setWorkspaceSuccessNotice(null);
    setAssetLibrarySuccessNotice(null);
    setAssetDetailSuccessNotice(null);
    setSearchResetToken((current) => current + 1);
    setAssetDetailSubmittedSearch(null);
    setSelectedAssetDetailSearchResult(null);
    setAssetDetailSearchResetToken((current) => current + 1);
    startTransition(() => setSelectedWorkspaceId(null));

    queryClient.removeQueries({ queryKey: searchKeys.all });
  }

  function resetAuthMutations() {
    registerMutation.reset();
    loginMutation.reset();
  }

  async function reconcileAuthBoundary() {
    setWorkspaceScopeRefreshAfter(Date.now());
    clearSessionScopedState();
    queryClient.removeQueries({ queryKey: assetKeys.all });
    queryClient.removeQueries({ queryKey: workspaceKeys.all });
    await queryClient.refetchQueries({ queryKey: authKeys.currentUser, type: 'active' });
  }

  function handleRegister(input: { email: string; password: string }) {
    registerMutation.mutate(input, {
      onSuccess: async () => {
        loginMutation.reset();
        logoutMutation.reset();
        await reconcileAuthBoundary();
      },
    });
  }

  function handleLogin(input: { email: string; password: string }) {
    loginMutation.mutate(input, {
      onSuccess: async () => {
        registerMutation.reset();
        logoutMutation.reset();
        await reconcileAuthBoundary();
      },
    });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: async () => {
        setWorkspaceScopeRefreshAfter(null);
        clearSessionScopedState();
        queryClient.removeQueries({ queryKey: assetKeys.all });
        queryClient.removeQueries({ queryKey: workspaceKeys.all });
        navigate({ name: 'home' });
        await queryClient.refetchQueries({ queryKey: authKeys.currentUser, type: 'active' });
      },
    });
  }

  function openAsset(assetId: string) {
    if (!assetId) {
      return;
    }

    setPreferredAssetId(assetId);
    startTransition(() => setSelectedAssetId(assetId));
    navigate({ name: 'asset', assetId });
  }

  function handleUpload(input: { file: File; title?: string }) {
    if (!selectedWorkspaceId) {
      return;
    }

    uploadMutation.mutate(
      {
        workspaceId: selectedWorkspaceId,
        file: input.file,
        title: input.title,
      },
      {
        onSuccess: (response) => {
          setPreferredAssetId(response.assetId);
          setStatusPollingEnabled(true);
          setAssetLibrarySuccessNotice({
            title: 'Upload accepted',
            message: `Added "${input.title?.trim() || input.file.name}" to ${selectedWorkspace?.name ?? 'the active workspace'}.`,
          });
          navigate({ name: 'asset', assetId: response.assetId });
          void queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
        },
      },
    );
  }

  function handleIndexAsset() {
    if (!selectedAssetId) {
      return;
    }

    indexMutation.mutate(selectedAssetId, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: selectedWorkspaceId ? assetKeys.list(selectedWorkspaceId) : assetKeys.all,
          }),
          queryClient.invalidateQueries({ queryKey: searchKeys.all }),
        ]);
      },
    });
  }

  function updateSearchResultTitles(assetId: string, title: string) {
    queryClient.setQueriesData<SearchResponse>({ queryKey: ['search', 'results'] }, (current) => {
      if (!current?.results?.length) {
        return current;
      }

      let didChange = false;
      const results = current.results.map((result) => {
        if (result.assetId !== assetId || result.assetTitle === title) {
          return result;
        }

        didChange = true;
        return { ...result, assetTitle: title };
      });

      return didChange ? { ...current, results } : current;
    });
  }

  function clearAssetDependentState(assetId: string) {
    if (selectedAssetIdRef.current === assetId) {
      setSelectedAssetId(null);
      setStatusPollingEnabled(false);
      setAssetDetailSubmittedSearch(null);
      setAssetDetailSearchResetToken((current) => current + 1);
      queryClient.removeQueries({ queryKey: assetKeys.status(assetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(assetId) });
    }

    if (preferredAssetIdRef.current === assetId) {
      setPreferredAssetId(null);
    }

    if (selectedSearchResultRef.current?.assetId === assetId) {
      setSelectedSearchResult(null);
    }

    if (selectedAssetDetailSearchResultRef.current?.assetId === assetId) {
      setSelectedAssetDetailSearchResult(null);
    }

    queryClient.removeQueries({ queryKey: ['search', 'context', assetId] });
  }

  function handleDeleteAsset(asset: AssetSummary) {
    if (deleteMutation.isPending) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${asset.title}" from ${selectedWorkspace?.name ?? 'this workspace'}?\n\nThis removes the asset and refreshes the workspace list.`,
    );

    if (!confirmed) {
      return;
    }

    setAssetLibrarySuccessNotice(null);
    setAssetDetailSuccessNotice(null);
    deleteMutation.mutate(
      {
        assetId: asset.assetId,
        workspaceId: asset.workspaceId,
      },
      {
        onSuccess: async (_response, variables) => {
          clearAssetDependentState(variables.assetId);
          if (route.name === 'asset' && route.assetId === variables.assetId) {
            navigate({ name: 'library' });
          }
          setAssetLibrarySuccessNotice({
            title: 'Asset deleted',
            message: `Removed "${asset.title}" from ${selectedWorkspace?.name ?? 'the active workspace'}.`,
          });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
            queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
          ]);
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            clearAssetDependentState(variables.assetId);

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  function handleRenameAsset(title: string) {
    if (!selectedAsset) {
      return;
    }

    setAssetDetailSuccessNotice(null);
    renameMutation.mutate(
      {
        assetId: selectedAsset.assetId,
        workspaceId: selectedAsset.workspaceId,
        title,
      },
      {
        onSuccess: (response, variables) => {
          queryClient.setQueryData<AssetSummary[] | undefined>(assetKeys.list(variables.workspaceId), (current) =>
            current?.map((asset) =>
              asset.assetId === variables.assetId
                ? {
                    ...asset,
                    title: response.title,
                    assetStatus: response.status,
                    workspaceId: response.workspaceId || asset.workspaceId,
                    createdAt: response.createdAt ?? asset.createdAt,
                  }
                : asset,
            ),
          );

          updateSearchResultTitles(variables.assetId, response.title);
          setSelectedSearchResult((current) =>
            current?.assetId === variables.assetId ? { ...current, assetTitle: response.title } : current,
          );
          setSelectedAssetDetailSearchResult((current) =>
            current?.assetId === variables.assetId ? { ...current, assetTitle: response.title } : current,
          );
          setAssetDetailSuccessNotice({
            title: 'Asset renamed',
            message: `Title updated to "${response.title}".`,
          });
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            if (selectedAssetIdRef.current === variables.assetId) {
              clearAssetDependentState(variables.assetId);
            }

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  const visibleDeleteError =
    deleteMutation.error && deleteMutation.variables?.workspaceId === selectedWorkspaceId ? deleteMutation.error : null;
  const deletingAssetId = deleteMutation.isPending ? deleteMutation.variables?.assetId ?? null : null;
  const visibleRenameError =
    renameMutation.error && renameMutation.variables?.assetId === selectedAssetId ? renameMutation.error : null;
  const isRenamingSelectedAsset =
    renameMutation.isPending && renameMutation.variables?.assetId === selectedAssetId;

  const pageMeta = useMemo(() => {
    switch (route.name) {
      case 'library':
        return {
          title: 'Asset Library',
          description: 'Upload lecture videos, inspect processing state, and keep the workspace inventory organized.',
        };
      case 'asset':
        return {
          title: selectedAsset?.title ?? 'Asset Detail',
          description: 'Review processing, transcript readiness, explicit indexing, and searchability for a single asset.',
        };
      case 'search':
        return {
          title: 'Workspace Search',
          description: 'Run workspace-scoped transcript search and inspect surrounding context around each hit.',
        };
      case 'settings':
        return {
          title: 'Settings',
          description: 'Manage workspaces conservatively and review the authenticated account context.',
        };
      case 'home':
      default:
        return {
          title: 'Workspace Home',
          description: 'Track search readiness, recent assets, and the next best action for the current workspace.',
        };
    }
  }, [route.name, selectedAsset?.title]);

  const navItems: ShellNavItem[] = [
    { label: 'Home', route: { name: 'home' }, isActive: route.name === 'home' },
    { label: 'Library', route: { name: 'library' }, disabled: !selectedWorkspace, isActive: route.name === 'library' || route.name === 'asset' },
    { label: 'Search', route: { name: 'search' }, disabled: !selectedWorkspace, isActive: route.name === 'search' },
    { label: 'Settings', route: { name: 'settings' }, isActive: route.name === 'settings' },
  ];

  if (currentUserQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Checking authenticated session..." />
      </div>
    );
  }

  if (isAuthRequired) {
    return (
      <AuthEntrySurface
        registerError={registerMutation.error}
        loginError={loginMutation.error}
        isRegistering={registerMutation.isPending}
        isLoggingIn={loginMutation.isPending}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onResetErrors={resetAuthMutations}
      />
    );
  }

  if (currentUserQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorBanner error={currentUserQuery.error} />
      </div>
    );
  }

  if (workspacesQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Loading authenticated workspace scope..." />
      </div>
    );
  }

  if (workspacesQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorBanner error={workspacesQuery.error} />
      </div>
    );
  }

  if (!selectedWorkspace && (workspacesQuery.isFetching || workspaceScopeRefreshAfter !== null || (workspacesQuery.data?.length ?? 0) > 0)) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Refreshing workspace scope..." />
      </div>
    );
  }

  let screenContent;

  if (!selectedWorkspace) {
    screenContent = (
      <div className="screen-stack">
        <div className="workspace-setup-card">
          <EmptyState
            title="No workspace yet"
            description="Create a workspace in Settings to start uploading lecture videos and preparing them for transcript search."
          />
          <div className="workspace-setup-card__actions">
            <Button type="button" onClick={() => navigate({ name: 'settings' })}>
              Open settings
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    switch (route.name) {
      case 'library':
        screenContent = (
          <AssetLibraryScreen
            workspaceName={selectedWorkspace.name}
            assets={displayAssets}
            selectedAssetId={selectedAssetId}
            successNotice={assetLibrarySuccessNotice}
            assetsError={assetsQuery.error}
            deleteError={visibleDeleteError}
            deleteBusy={deleteMutation.isPending}
            deletingAssetId={deletingAssetId}
            assetsLoading={assetsQuery.isLoading}
            uploadError={uploadMutation.error}
            uploadSuccessId={uploadMutation.data?.assetId}
            isUploading={uploadMutation.isPending}
            onSelectAsset={openAsset}
            onDeleteAsset={handleDeleteAsset}
            onUpload={handleUpload}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenSettings={() => navigate({ name: 'settings' })}
          />
        );
        break;
      case 'asset':
        screenContent = (
          <AssetDetailScreen
            workspaceName={selectedWorkspace.name}
            assets={displayAssets}
            asset={selectedAsset}
            successNotice={assetDetailSuccessNotice}
            resolvedAssetStatus={resolvedAssetStatus}
            statusResponse={assetStatusQuery.data}
            statusError={assetStatusQuery.error}
            transcriptRows={transcriptQuery.data}
            transcriptError={transcriptQuery.error}
            transcriptLoading={transcriptQuery.isLoading || transcriptQuery.isFetching}
            indexError={indexMutation.error}
            indexResponse={indexMutation.data?.assetId === selectedAssetId ? indexMutation.data : undefined}
            isIndexing={indexMutation.isPending}
            isRenaming={Boolean(isRenamingSelectedAsset)}
            renameError={visibleRenameError}
            activeQuery={assetDetailSubmittedSearch}
            searchResponse={assetDetailSearchQuery.data}
            searchError={assetDetailSearchQuery.error}
            isSearching={assetDetailSearchQuery.isLoading || assetDetailSearchQuery.isFetching}
            contextResponse={assetDetailContextQuery.data}
            contextError={assetDetailContextQuery.error}
            isContextLoading={assetDetailContextQuery.isLoading || assetDetailContextQuery.isFetching}
            selectedSearchResult={selectedAssetDetailSearchResult}
            searchResetToken={assetDetailSearchResetToken}
            searchableAssetCount={searchableAssetCount}
            onIndex={handleIndexAsset}
            onRename={handleRenameAsset}
            onResetRename={() => renameMutation.reset()}
            onSearchWithinAsset={(query) => {
              setAssetDetailSubmittedSearch(query);
              setSelectedAssetDetailSearchResult(null);
            }}
            onSelectSearchResult={setSelectedAssetDetailSearchResult}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenAsset={openAsset}
          />
        );
        break;
      case 'search':
        screenContent = (
          <WorkspaceSearchScreen
            workspaceName={selectedWorkspace.name}
            searchableAssetCount={searchableAssetCount}
            resetToken={searchResetToken}
            activeQuery={submittedSearch}
            searchResponse={searchQuery.data}
            searchError={searchQuery.error}
            isSearching={searchQuery.isLoading || searchQuery.isFetching}
            contextResponse={contextQuery.data}
            contextError={contextQuery.error}
            isContextLoading={contextQuery.isLoading || contextQuery.isFetching}
            selectedResult={selectedSearchResult}
            assets={displayAssets}
            onSearch={(query) => {
              setSubmittedSearch(query);
              setSelectedSearchResult(null);
            }}
            onSelectResult={setSelectedSearchResult}
            onOpenAsset={openAsset}
            onOpenLibrary={() => navigate({ name: 'library' })}
          />
        );
        break;
      case 'settings':
        screenContent = (
          <SettingsScreen
            currentUserEmail={currentUser?.email ?? 'Unknown account'}
            selectedWorkspaceName={selectedWorkspace.name}
            workspaceManagement={
              <WorkspaceBar
                workspaces={workspacesQuery.data ?? []}
                selectedWorkspace={selectedWorkspace}
                selectedWorkspaceId={selectedWorkspaceId}
                isLoading={workspacesQuery.isLoading || workspacesQuery.isFetching || isTransitionPending}
                successNotice={workspaceSuccessNotice}
                createError={createWorkspaceMutation.error}
                renameError={
                  renameWorkspaceMutation.error &&
                  renameWorkspaceMutation.variables?.workspaceId === selectedWorkspaceId
                    ? renameWorkspaceMutation.error
                    : null
                }
                deleteError={
                  deleteWorkspaceMutation.error && deleteWorkspaceMutation.variables?.workspaceId === selectedWorkspaceId
                    ? deleteWorkspaceMutation.error
                    : null
                }
                logoutError={logoutMutation.error}
                createSuccessId={createWorkspaceMutation.data?.id}
                onSelectWorkspace={handleSelectWorkspace}
                onCreateWorkspace={handleCreateWorkspace}
                onRenameWorkspace={handleRenameWorkspace}
                onDeleteWorkspace={handleDeleteWorkspace}
                isCreating={createWorkspaceMutation.isPending}
                isRenaming={renameWorkspaceMutation.isPending}
                isDeleting={deleteWorkspaceMutation.isPending}
                onLogout={handleLogout}
                isLoggingOut={logoutMutation.isPending}
              />
            }
          />
        );
        break;
      case 'home':
      default:
        screenContent = (
          <WorkspaceHomeScreen
            workspaceName={selectedWorkspace.name}
            currentUserEmail={currentUser?.email ?? 'Unknown account'}
            assets={displayAssets}
            selectedAsset={selectedAsset}
            searchableAssetCount={searchableAssetCount}
            activeQuery={submittedSearch}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenAsset={openAsset}
            onOpenSettings={() => navigate({ name: 'settings' })}
          />
        );
        break;
    }
  }

  return (
    <div className="app-shell app-shell--product">
      <div className="product-shell">
        <aside className="product-sidebar">
          <div className="product-brand">
            <div className="product-brand__mark" aria-hidden="true">
              AK
            </div>
            <div className="product-brand__copy">
              <span className="product-brand__eyebrow">AI Knowledge Workspace</span>
              <strong>Pre-AI product shell</strong>
            </div>
          </div>

          <div className="product-sidebar__workspace">
            <span className="product-sidebar__label">Current workspace</span>
            <strong>{selectedWorkspace?.name ?? 'No workspace yet'}</strong>
            <span>{selectedWorkspace ? `${processingAssetCount} processing, ${transcriptReadyAssetCount} transcript ready, ${searchableAssetCount} searchable` : 'Create a workspace to start the product flow.'}</span>
          </div>

          <nav className="product-nav" aria-label="Product navigation">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`product-nav__button ${item.isActive ? 'product-nav__button--active' : ''}`}
                onClick={() => navigate(item.route)}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="product-sidebar__footer">
            <span className="product-sidebar__label">Signed in as</span>
            <strong>{currentUser?.email ?? 'Unknown account'}</strong>
          </div>
        </aside>

        <div className="product-main">
          <header className="product-topbar">
            <div className="product-topbar__copy">
              <p className="hero__eyebrow">{selectedWorkspace?.name ?? 'Workspace setup'}</p>
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.description}</p>
            </div>

            <div className="product-topbar__actions">
              <label className="product-workspace-switcher">
                <span className="product-workspace-switcher__label">Workspace</span>
                <select
                  className="field__input"
                  value={selectedWorkspaceId ?? ''}
                  onChange={(event) => handleSelectWorkspace(event.target.value)}
                  disabled={workspacesQuery.isFetching || (workspacesQuery.data?.length ?? 0) === 0}
                >
                  {(workspacesQuery.data ?? []).length === 0 ? <option value="">No workspace yet</option> : null}
                  {(workspacesQuery.data ?? []).map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>

              <Button type="button" tone="secondary" onClick={() => navigate({ name: 'settings' })}>
                Workspace settings
              </Button>
              <Button type="button" tone="ghost" onClick={handleLogout} disabled={logoutMutation.isPending}>
                {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </header>

          <main className="product-content">{screenContent}</main>
        </div>
      </div>
    </div>
  );
}
