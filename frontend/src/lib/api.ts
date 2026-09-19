export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export type AuthSessionResponse = {
  userId: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AssetStatus = 'PROCESSING' | 'TRANSCRIPT_READY' | 'SEARCHABLE' | 'FAILED';
export type ProcessingJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type AssetSummary = {
  assetId: string;
  title: string;
  assetStatus: AssetStatus;
  workspaceId: string;
  createdAt: string;
};

export type AssetListEnvelope = {
  items: AssetSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export type AssetUploadResponse = {
  assetId: string;
  processingJobId: string;
  assetStatus: AssetStatus;
  workspaceId: string;
};

export type AssetStatusResponse = {
  assetId: string;
  processingJobId: string;
  assetStatus: AssetStatus;
  processingJobStatus: ProcessingJobStatus;
};

export type TranscriptRow = {
  id: string | null;
  videoId: string | null;
  segmentIndex: number | null;
  text: string;
  createdAt: string | null;
};

export type TranscriptContextResponse = {
  assetId: string;
  transcriptRowId: string;
  hitSegmentIndex: number | null;
  window: number;
  rows: TranscriptRow[];
};

export type AssetIndexResponse = {
  assetId: string;
  assetStatus: AssetStatus;
  indexedDocumentCount: number;
};

export type AssetRecordResponse = {
  id: string;
  title: string;
  status: AssetStatus;
  workspaceId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SearchResult = {
  assetId: string;
  assetTitle: string;
  transcriptRowId: string | null;
  segmentIndex: number | null;
  text: string;
  createdAt: string | null;
  score: number | null;
};

export type SearchResponse = {
  query: string;
  workspaceIdFilter: string;
  assetIdFilter: string | null;
  resultCount: number;
  results: SearchResult[];
};

type CreateWorkspacePayload = {
  name: string;
};

export type UpdateWorkspaceNameInput = {
  workspaceId: string;
  name: string;
};

type CreateAuthSessionPayload = {
  userId: string;
};

export type AuthCredentialsInput = {
  email: string;
  password: string;
};

export type UploadAssetInput = {
  workspaceId: string;
  file: File;
  title?: string;
};

export type UpdateAssetTitleInput = {
  assetId: string;
  title: string;
};

type ApiErrorPayload = {
  code?: string;
  message?: string;
  error?: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');

export const backendDisplayUrl =
  (import.meta.env.VITE_API_DISPLAY_URL ?? '').trim() ||
  normalizedApiBaseUrl ||
  'http://localhost:8081';

export const usingProxy = normalizedApiBaseUrl.length === 0;

function buildUrl(path: string): string {
  return normalizedApiBaseUrl ? `${normalizedApiBaseUrl}${path}` : path;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

function getErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const maybePayload = payload as ApiErrorPayload;
    if (typeof maybePayload.message === 'string' && maybePayload.message.trim()) {
      return maybePayload.message;
    }
    if (typeof maybePayload.error === 'string' && maybePayload.error.trim()) {
      return maybePayload.error;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return status === 0 ? 'Unable to reach the backend.' : 'The backend returned an unexpected response.';
}

function getErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const maybePayload = payload as ApiErrorPayload;
  return typeof maybePayload.code === 'string' && maybePayload.code.trim()
    ? maybePayload.code
    : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError(0, 'Unable to reach the backend.');
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiClientError(response.status, getErrorMessage(payload, response.status), getErrorCode(payload));
  }

  return payload as T;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/workspaces');
}

export async function createAuthSession(userId: string): Promise<AuthSessionResponse> {
  const payload: CreateAuthSessionPayload = { userId };

  return request<AuthSessionResponse>('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function registerUser(input: AuthCredentialsInput): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: AuthCredentialsInput): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function logoutUser(): Promise<void> {
  await request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/me');
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const payload: CreateWorkspacePayload = { name };

  return request<Workspace>('/api/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function updateWorkspaceName(input: UpdateWorkspaceNameInput): Promise<Workspace> {
  return request<Workspace>(`/api/workspaces/${input.workspaceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: input.name }),
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await request<void>(`/api/workspaces/${workspaceId}`, {
    method: 'DELETE',
  });
}

export async function listAssets(workspaceId: string): Promise<AssetSummary[]> {
  const response = await request<AssetSummary[] | AssetListEnvelope>(
    `/api/assets${buildQueryString({ workspaceId })}`,
  );

  if (Array.isArray(response)) {
    return response;
  }

  return response.items;
}

export async function uploadAsset(input: UploadAssetInput): Promise<AssetUploadResponse> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('workspaceId', input.workspaceId);

  if (input.title?.trim()) {
    formData.append('title', input.title.trim());
  }

  return request<AssetUploadResponse>('/api/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  await request<void>(`/api/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export async function updateAssetTitle(input: UpdateAssetTitleInput): Promise<AssetRecordResponse> {
  return request<AssetRecordResponse>(`/api/assets/${input.assetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: input.title }),
  });
}

export async function getAssetStatus(assetId: string): Promise<AssetStatusResponse> {
  return request<AssetStatusResponse>(`/api/assets/${assetId}/status`);
}

export async function getAssetTranscript(assetId: string): Promise<TranscriptRow[]> {
  return request<TranscriptRow[]>(`/api/assets/${assetId}/transcript`);
}

export async function indexAssetTranscript(assetId: string): Promise<AssetIndexResponse> {
  return request<AssetIndexResponse>(`/api/assets/${assetId}/index`, {
    method: 'POST',
  });
}

export async function searchTranscript(query: string, workspaceId: string, assetId?: string | null): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/search${buildQueryString({ q: query, workspaceId, assetId: assetId ?? undefined })}`);
}

export async function getTranscriptContext(
  assetId: string,
  transcriptRowId: string,
  window = 2,
): Promise<TranscriptContextResponse> {
  return request<TranscriptContextResponse>(
    `/api/assets/${assetId}/transcript/context${buildQueryString({
      transcriptRowId,
      window: String(window),
    })}`,
  );
}
