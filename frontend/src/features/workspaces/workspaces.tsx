import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteWorkspace,
  createWorkspace,
  isApiClientError,
  listWorkspaces,
  updateWorkspaceName,
  type UpdateWorkspaceNameInput,
  type Workspace,
} from '../../lib/api';
import { Button, ErrorBanner, InfoBanner } from '../../lib/ui';
import { getFriendlyLogoutErrorCopy } from '../auth/auth';

export const workspaceKeys = {
  all: ['workspaces'] as const,
};

export function useWorkspacesQuery(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: listWorkspaces,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useRenameWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkspaceName,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId }: { workspaceId: string }) => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

function getTechnicalDetail(error: { code?: string; message: string }): string | undefined {
  const normalizedMessage = error.message.trim();

  if (!normalizedMessage) {
    return error.code ? `Backend detail: ${error.code}` : undefined;
  }

  return error.code
    ? `Backend detail: ${error.code} - ${normalizedMessage}`
    : `Backend detail: ${normalizedMessage}`;
}

function getFriendlyWorkspaceRenameErrorCopy(
  error: unknown,
): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_WORKSPACE_NAME') {
    return {
      tone: 'warning',
      title: 'Workspace name was rejected',
      message: 'Use a clear non-empty workspace name within the current length limit, then save again.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Workspace is no longer available',
      message: 'This workspace could not be found anymore. The shell will refresh the visible workspace scope.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Rename is temporarily unavailable',
      message: 'We could not reach the service, so the workspace name was not updated.',
    };
  }

  return {
    tone: 'error',
    title: 'Workspace rename failed',
    message: 'The workspace name change was not confirmed, so the previous name stays in place.',
    detail: getTechnicalDetail(error),
  };
}

function getFriendlyWorkspaceDeleteErrorCopy(
  error: unknown,
): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 409 && error.code === 'DEFAULT_WORKSPACE_DELETE_FORBIDDEN') {
    return {
      tone: 'warning',
      title: 'Default workspace stays protected',
      message: 'The default workspace cannot be deleted. Switch to another workspace if you want to remove it instead.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 409 && error.code === 'WORKSPACE_NOT_EMPTY') {
    return {
      tone: 'warning',
      title: 'Workspace still contains assets',
      message: 'Delete the assets in this workspace first. Workspace deletion stays blocked until it is empty.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Workspace already unavailable',
      message: 'This workspace is no longer visible. The shell will refresh and move to another visible workspace.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Delete is temporarily unavailable',
      message: 'We could not reach the service, so the workspace was not removed.',
    };
  }

  return {
    tone: 'error',
    title: 'Workspace delete failed',
    message: 'The workspace was not removed. The current shell scope stays in place until deletion is confirmed.',
    detail: getTechnicalDetail(error),
  };
}

export function WorkspaceBar({
  workspaces,
  selectedWorkspace,
  selectedWorkspaceId,
  isLoading,
  successNotice,
  createError,
  renameError,
  deleteError,
  logoutError,
  createSuccessId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  isCreating,
  isRenaming,
  isDeleting,
  onLogout,
  isLoggingOut,
}: {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  successNotice: { title: string; message: string } | null;
  createError: unknown;
  renameError: unknown;
  deleteError: unknown;
  logoutError: unknown;
  createSuccessId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (input: UpdateWorkspaceNameInput) => void;
  onDeleteWorkspace: () => void;
  isCreating: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [renameWorkspaceName, setRenameWorkspaceName] = useState('');
  const logoutErrorCopy = getFriendlyLogoutErrorCopy(logoutError);
  const renameErrorCopy = getFriendlyWorkspaceRenameErrorCopy(renameError);
  const deleteErrorCopy = getFriendlyWorkspaceDeleteErrorCopy(deleteError);
  const workspaceActionBusy = isCreating || isRenaming || isDeleting;

  useEffect(() => {
    if (createSuccessId) {
      setWorkspaceName('');
    }
  }, [createSuccessId]);

  useEffect(() => {
    setRenameWorkspaceName(selectedWorkspace?.name ?? '');
  }, [selectedWorkspace?.id, selectedWorkspace?.name]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = workspaceName.trim();

    if (!trimmedName) {
      return;
    }

    onCreateWorkspace(trimmedName);
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWorkspace) {
      return;
    }

    const trimmedName = renameWorkspaceName.trim();

    if (!trimmedName || trimmedName === selectedWorkspace.name) {
      return;
    }

    onRenameWorkspace({
      workspaceId: selectedWorkspace.id,
      name: trimmedName,
    });
  }

  return (
    <div className="workspace-bar">
      <div className="workspace-bar__top">
        <div className={`workspace-bar__intro ${isLoading ? 'workspace-bar__intro--busy' : ''}`}>
          <div>
            <span className="workspace-focus__eyebrow">Workspace shell</span>
            <strong className="workspace-focus__title">
              {selectedWorkspace ? selectedWorkspace.name : 'Create your first workspace'}
            </strong>
          </div>
          <p className="workspace-bar__intro-copy">
            Keep uploads, transcript review, indexing, and search scoped to one workspace at a time.
          </p>
        </div>

        <div className="workspace-bar__pills">
          <div className="pill">
            <span className="pill__label">Visible workspaces</span>
            <span className="pill__value">{workspaces.length}</span>
          </div>

          <Button type="button" tone="ghost" onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </div>

      <div className="workspace-bar__cluster">
        <label className="field">
          <span className="field__label">Workspace scope</span>
          <select
            className="field__input"
            value={selectedWorkspaceId ?? ''}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            disabled={isLoading || workspaces.length === 0 || isRenaming || isDeleting}
          >
            {workspaces.length === 0 ? <option value="">No workspace yet</option> : null}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <span className="field__hint">
            {selectedWorkspace
              ? `Currently viewing ${selectedWorkspace.name}. Switching workspace updates assets, transcript state, and search in place.`
              : 'Choose a workspace after you create one to start uploading and searching content.'}
          </span>
        </label>

        <form className="workspace-create" onSubmit={handleSubmit}>
          <label className="field field--grow">
            <span className="field__label">Create workspace</span>
            <input
              className="field__input"
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Algorithms, Databases, Distributed Systems..."
              maxLength={255}
              disabled={workspaceActionBusy}
            />
            <span className="field__hint">Use focused workspace names that make future search scope obvious.</span>
          </label>
          <Button type="submit" tone="secondary" disabled={workspaceActionBusy || !workspaceName.trim()}>
            {isCreating ? 'Creating...' : 'Create workspace'}
          </Button>
        </form>

        <form className="workspace-manage" onSubmit={handleRenameSubmit}>
          <label className="field field--grow">
            <span className="field__label">Rename current workspace</span>
            <input
              className="field__input"
              type="text"
              value={renameWorkspaceName}
              onChange={(event) => setRenameWorkspaceName(event.target.value)}
              placeholder="Rename the active workspace"
              maxLength={255}
              disabled={!selectedWorkspace || workspaceActionBusy}
            />
            <span className="field__hint">
              {selectedWorkspace
                ? 'Delete only works for non-default empty workspaces. Backend rules stay conservative on purpose.'
                : 'Select a workspace first to rename it or request deletion.'}
            </span>
          </label>

          <div className="workspace-manage__actions">
            <Button
              type="submit"
              tone="ghost"
              disabled={
                workspaceActionBusy ||
                !selectedWorkspace ||
                !renameWorkspaceName.trim() ||
                renameWorkspaceName.trim() === selectedWorkspace.name
              }
            >
              {isRenaming ? 'Saving...' : 'Rename workspace'}
            </Button>
            <Button type="button" tone="ghost" disabled={workspaceActionBusy || !selectedWorkspace} onClick={onDeleteWorkspace}>
              {isDeleting ? 'Deleting...' : 'Delete workspace'}
            </Button>
          </div>
        </form>
      </div>

      {successNotice ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="success"
          title={successNotice.title}
          message={successNotice.message}
        />
      ) : null}
      {logoutError ? (
        <ErrorBanner
          error={logoutError}
          className="workspace-bar__error"
          title={logoutErrorCopy?.title}
          message={logoutErrorCopy?.message}
          detail={logoutErrorCopy?.detail}
        />
      ) : null}
      {createError ? <ErrorBanner error={createError} className="workspace-bar__error" /> : null}
      {renameErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="warning"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}
      {renameErrorCopy?.tone === 'error' ? (
        <ErrorBanner
          error={renameError}
          className="workspace-bar__error"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}
      {deleteErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="warning"
          title={deleteErrorCopy.title}
          message={deleteErrorCopy.message}
          detail={deleteErrorCopy.detail}
        />
      ) : null}
      {deleteErrorCopy?.tone === 'error' ? (
        <ErrorBanner
          error={deleteError}
          className="workspace-bar__error"
          title={deleteErrorCopy.title}
          message={deleteErrorCopy.message}
          detail={deleteErrorCopy.detail}
        />
      ) : null}
    </div>
  );
}
