import { MockApi } from './mockApi';
import type {
  AuditResponse,
  AffectedResponse,
  AskResponse,
  CheckRequest,
  CheckResponse,
  GatekeeperApi,
  GraphResponse,
  DecisionItem,
  LoadBearingItem,
  ReverseRequest,
  ReverseResponse,
  ResetResponse,
  TargetItem,
  WhoResponse,
  WhyResponse,
} from './types';

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
const viewer = (import.meta.env.VITE_VIEWER as string | undefined) ?? 'anonymous';
const resetToken = import.meta.env.VITE_RESET_TOKEN as string | undefined;

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message); this.name = 'ApiError';
  }
}

type ToastListener = (error: ApiError) => void;
const toastListeners = new Set<ToastListener>();
export const subscribeApiErrors = (listener: ToastListener): (() => void) => { toastListeners.add(listener); return () => toastListeners.delete(listener); };

export const mapApiError = (body: unknown, status: number): ApiError => {
  const root = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const detail = root.detail && typeof root.detail === 'object' ? root.detail as Record<string, unknown> : root;
  const code = typeof detail.code === 'string' ? detail.code : `HTTP_${status}`;
  const message = typeof detail.message === 'string' ? detail.message : typeof detail.detail === 'string' ? detail.detail : `Gatekeeper API returned ${status}`;
  return new ApiError(code, message, status);
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Viewer': viewer, ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!response.ok) {
    const error = mapApiError(body, response.status);
    if (error.code !== 'UNKNOWN_TARGET') toastListeners.forEach((listener) => listener(error));
    throw error;
  }
  return body as T;
};

const httpApi: GatekeeperApi = {
  check: (body: CheckRequest) => request<CheckResponse>('/check', { method: 'POST', body: JSON.stringify(body) }),
  why: (decision) => request<WhyResponse>(`/why/${encodeURIComponent(decision)}`),
  reverse: (body: ReverseRequest) => request<ReverseResponse>('/reverse', { method: 'POST', body: JSON.stringify(body) }),
  affected: (decision) => request<AffectedResponse>(`/affected/${encodeURIComponent(decision)}`),
  who: (target) => request<WhoResponse>(`/who/${encodeURIComponent(target)}`),
  loadBearing: (limit = 5) => request<LoadBearingItem[]>(`/load_bearing?limit=${limit}`),
  graph: () => request<GraphResponse>('/graph'),
  reset: () => request<ResetResponse>('/reset', {
    method: 'POST',
    headers: resetToken ? { 'X-Reset-Token': resetToken } : {},
  }),
  ask: (question) => request<AskResponse>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  targets: () => request<TargetItem[]>('/targets'),
  decisions: () => request<DecisionItem[]>('/decisions'),
  audit: () => request<AuditResponse>('/audit'),
};

const recordingMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
const useMock = recordingMode || (import.meta.env.VITE_USE_MOCK as string | undefined) !== 'false';
export const api: GatekeeperApi = useMock ? new MockApi() : httpApi;
export const apiMode: 'MOCK' | 'LIVE' = useMock ? 'MOCK' : 'LIVE';
export { MockApi };
