/**
 * Plus/variant OAuth flows kept separate from the upstream OAuth API surface
 * to make future baseline merges smaller.
 */

import { apiClient } from './client';

export type OAuthPlusProvider =
  | 'codex-device'
  | 'iflow'
  | 'cursor'
  | 'codebuddy'
  | 'kilo'
  | 'kiro-aws'
  | 'kiro-aws-authcode'
  | 'kiro-idc'
  | 'kiro-google'
  | 'kiro-github'
  | 'github'
  | 'gitlab';

export interface OAuthPlusStartResponse {
  url?: string;
  state?: string;
  method?: string;
  user_code?: string;
  verification_uri?: string;
}

export interface OAuthPlusStatusResponse {
  status: 'ok' | 'wait' | 'error' | 'device_code' | 'auth_url';
  error?: string;
  url?: string;
  verification_url?: string;
  user_code?: string;
}

export interface OAuthPlusStartOptions {
  label?: string;
  gitlabBaseUrl?: string;
  gitlabClientId?: string;
  gitlabClientSecret?: string;
  kiroStartUrl?: string;
  kiroRegion?: string;
  kiroFlow?: string;
}

export interface IFlowCookieResponse {
  status: 'ok';
  saved_path?: string;
  email?: string;
  expired?: string;
  type?: string;
}

export interface GitLabPatResponse {
  status: 'ok';
  saved_path?: string;
  username?: string;
  email?: string;
  token_label?: string;
  model_provider?: string;
  model_name?: string;
}

export interface KiroImportResponse {
  status: 'ok';
  saved_path?: string;
  label?: string;
}

const CALLBACK_PROVIDER_MAP: Partial<Record<OAuthPlusProvider, string>> = {
  'kiro-aws-authcode': 'kiro',
  'kiro-idc': 'kiro',
  'kiro-google': 'kiro',
  'kiro-github': 'kiro'
};

const ROUTE_PROVIDER_MAP: Record<OAuthPlusProvider, string> = {
  'codex-device': 'codex-device',
  iflow: 'iflow',
  cursor: 'cursor',
  codebuddy: 'codebuddy',
  kilo: 'kilo',
  'kiro-aws': 'kiro',
  'kiro-aws-authcode': 'kiro-aws-authcode',
  'kiro-idc': 'kiro-idc',
  'kiro-google': 'kiro',
  'kiro-github': 'kiro',
  github: 'github',
  gitlab: 'gitlab'
};

export const oauthPlusApi = {
  startAuth: (provider: OAuthPlusProvider, options?: OAuthPlusStartOptions) => {
    const params: Record<string, string | boolean> = {};
    if (provider === 'iflow' || provider === 'gitlab' || provider === 'kiro-google' || provider === 'kiro-github') {
      params.is_webui = true;
    }
    if (provider === 'cursor' && options?.label) {
      params.label = options.label;
    }
    if (provider === 'gitlab') {
      if (options?.gitlabBaseUrl) params.base_url = options.gitlabBaseUrl;
      if (options?.gitlabClientId) params.client_id = options.gitlabClientId;
      if (options?.gitlabClientSecret) params.client_secret = options.gitlabClientSecret;
    }
    if (provider === 'kiro-google') params.method = 'google';
    if (provider === 'kiro-github') params.method = 'github';
    if (provider === 'kiro-aws') params.method = 'aws';
    if (provider === 'kiro-idc') {
      if (options?.kiroStartUrl) params.start_url = options.kiroStartUrl;
      if (options?.kiroRegion) params.region = options.kiroRegion;
      if (options?.kiroFlow) params.flow = options.kiroFlow;
    }

    const routeProvider = ROUTE_PROVIDER_MAP[provider];
    return apiClient.get<OAuthPlusStartResponse>(`/${routeProvider}-auth-url`, {
      params: Object.keys(params).length ? params : undefined
    });
  },

  getAuthStatus: (state: string) =>
    apiClient.get<OAuthPlusStatusResponse>('/get-auth-status', {
      params: { state }
    }),

  submitCallback: (provider: OAuthPlusProvider, redirectUrl: string) => {
    const callbackProvider = CALLBACK_PROVIDER_MAP[provider] ?? provider;
    return apiClient.post<{ status: 'ok' }>('/oauth-callback', {
      provider: callbackProvider,
      redirect_url: redirectUrl
    });
  },

  submitIFlowCookie: (cookie: string) =>
    apiClient.post<IFlowCookieResponse>('/iflow-auth-url', { cookie }),

  submitGitLabPat: (payload: { baseUrl?: string; personalAccessToken: string }) =>
    apiClient.post<GitLabPatResponse>('/gitlab-auth-url', {
      base_url: payload.baseUrl,
      personal_access_token: payload.personalAccessToken
    }),

  importKiroToken: () => apiClient.post<KiroImportResponse>('/kiro-import')
};
