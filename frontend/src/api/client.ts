import { MockApi } from './mockApi';
import type {
  AffectedResponse,
  AskResponse,
  CheckRequest,
  CheckResponse,
  GatekeeperApi,
  GraphResponse,
  LoadBearingItem,
  ReverseRequest,
  ReverseResponse,
  WhoResponse,
  WhyResponse,
} from './types';

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Gatekeeper API returned ${response.status}`);
  return response.json() as Promise<T>;
};

const httpApi: GatekeeperApi = {
  check: (body: CheckRequest) => request<CheckResponse>('/check', { method: 'POST', body: JSON.stringify(body) }),
  why: (decision) => request<WhyResponse>(`/why/${encodeURIComponent(decision)}`),
  reverse: (body: ReverseRequest) => request<ReverseResponse>('/reverse', { method: 'POST', body: JSON.stringify(body) }),
  affected: (decision) => request<AffectedResponse>(`/affected/${encodeURIComponent(decision)}`),
  who: (target) => request<WhoResponse>(`/who/${encodeURIComponent(target)}`),
  loadBearing: (limit = 5) => request<LoadBearingItem[]>(`/load_bearing?limit=${limit}`),
  graph: () => request<GraphResponse>('/graph'),
  reset: () => request<void>('/reset', { method: 'POST' }),
  ask: (question) => request<AskResponse>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),
};

const useMock = (import.meta.env.VITE_USE_MOCK as string | undefined) !== 'false';
export const api: GatekeeperApi = useMock ? new MockApi() : httpApi;
export const apiMode: 'MOCK' | 'LIVE' = useMock ? 'MOCK' : 'LIVE';
export { MockApi };
