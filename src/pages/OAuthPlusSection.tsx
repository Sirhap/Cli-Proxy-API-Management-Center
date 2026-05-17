import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotificationStore } from '@/stores';
import {
  oauthPlusApi,
  type GitLabPatResponse,
  type IFlowCookieResponse,
  type KiroImportResponse,
  type OAuthPlusProvider
} from '@/services/api/oauthPlus';
import { copyToClipboard } from '@/utils/clipboard';
import styles from './OAuthPlusSection.module.scss';
import iconCodex from '@/assets/icons/codex.svg';
import iconIflow from '@/assets/icons/iflow.svg';

interface ProviderState {
  url?: string;
  state?: string;
  status?: 'idle' | 'waiting' | 'success' | 'error';
  error?: string;
  polling?: boolean;
  callbackUrl?: string;
  callbackSubmitting?: boolean;
  callbackStatus?: 'success' | 'error';
  callbackError?: string;
  userCode?: string;
  label?: string;
  gitlabBaseUrl?: string;
  gitlabClientId?: string;
  gitlabClientSecret?: string;
  kiroStartUrl?: string;
  kiroRegion?: string;
  kiroFlow?: string;
}

interface IFlowCookieState {
  cookie: string;
  loading: boolean;
  error?: string;
  result?: IFlowCookieResponse;
}

interface GitLabPatState {
  baseUrl: string;
  token: string;
  loading: boolean;
  error?: string;
  result?: GitLabPatResponse;
}

interface KiroImportState {
  loading: boolean;
  error?: string;
  result?: KiroImportResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return typeof error === 'string' ? error : '';
}

function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

const PROVIDERS: {
  id: OAuthPlusProvider;
  titleKey: string;
  hintKey: string;
  urlLabelKey: string;
  icon?: string;
  badge?: string;
}[] = [
  { id: 'codex-device', titleKey: 'auth_login.codex_device_oauth_title', hintKey: 'auth_login.codex_device_oauth_hint', urlLabelKey: 'auth_login.codex_device_oauth_url_label', icon: iconCodex },
  { id: 'iflow', titleKey: 'auth_login.iflow_oauth_title', hintKey: 'auth_login.iflow_oauth_hint', urlLabelKey: 'auth_login.iflow_oauth_url_label', icon: iconIflow },
  { id: 'cursor', titleKey: 'auth_login.cursor_oauth_title', hintKey: 'auth_login.cursor_oauth_hint', urlLabelKey: 'auth_login.cursor_oauth_url_label', badge: 'CU' },
  { id: 'codebuddy', titleKey: 'auth_login.codebuddy_oauth_title', hintKey: 'auth_login.codebuddy_oauth_hint', urlLabelKey: 'auth_login.codebuddy_oauth_url_label', badge: 'CB' },
  { id: 'kilo', titleKey: 'auth_login.kilo_oauth_title', hintKey: 'auth_login.kilo_oauth_hint', urlLabelKey: 'auth_login.kilo_oauth_url_label', badge: 'KL' },
  { id: 'kiro-portal', titleKey: 'auth_login.kiro_portal_oauth_title', hintKey: 'auth_login.kiro_portal_oauth_hint', urlLabelKey: 'auth_login.kiro_portal_oauth_url_label', badge: 'KP' },
  { id: 'kiro-aws', titleKey: 'auth_login.kiro_aws_oauth_title', hintKey: 'auth_login.kiro_aws_oauth_hint', urlLabelKey: 'auth_login.kiro_aws_oauth_url_label', badge: 'KA' },
  { id: 'kiro-aws-authcode', titleKey: 'auth_login.kiro_aws_authcode_oauth_title', hintKey: 'auth_login.kiro_aws_authcode_oauth_hint', urlLabelKey: 'auth_login.kiro_aws_authcode_oauth_url_label', badge: 'KC' },
  { id: 'kiro-idc', titleKey: 'auth_login.kiro_idc_oauth_title', hintKey: 'auth_login.kiro_idc_oauth_hint', urlLabelKey: 'auth_login.kiro_idc_oauth_url_label', badge: 'KI' },
  { id: 'kiro-google', titleKey: 'auth_login.kiro_google_oauth_title', hintKey: 'auth_login.kiro_google_oauth_hint', urlLabelKey: 'auth_login.kiro_google_oauth_url_label', badge: 'KG' },
  { id: 'kiro-github', titleKey: 'auth_login.kiro_github_oauth_title', hintKey: 'auth_login.kiro_github_oauth_hint', urlLabelKey: 'auth_login.kiro_github_oauth_url_label', badge: 'KH' },
  { id: 'github', titleKey: 'auth_login.github_oauth_title', hintKey: 'auth_login.github_oauth_hint', urlLabelKey: 'auth_login.github_oauth_url_label', badge: 'GH' },
  { id: 'gitlab', titleKey: 'auth_login.gitlab_oauth_title', hintKey: 'auth_login.gitlab_oauth_hint', urlLabelKey: 'auth_login.gitlab_oauth_url_label', badge: 'GL' }
];

const CALLBACK_SUPPORTED: OAuthPlusProvider[] = [
  'gitlab',
  'kiro-aws-authcode',
  'kiro-idc',
  'kiro-google',
  'kiro-github'
];
const SUCCESS_RESET_DELAY_MS = 5000;
const getProviderI18nPrefix = (provider: OAuthPlusProvider) => provider.replace(/-/g, '_');
const getAuthKey = (provider: OAuthPlusProvider, suffix: string) =>
  `auth_login.${getProviderI18nPrefix(provider)}_${suffix}`;

export function OAuthPlusSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const [states, setStates] = useState<Record<OAuthPlusProvider, ProviderState>>({} as Record<OAuthPlusProvider, ProviderState>);
  const [iflowCookieState, setIflowCookieState] = useState<IFlowCookieState>({ cookie: '', loading: false });
  const [gitlabPatState, setGitlabPatState] = useState<GitLabPatState>({ baseUrl: '', token: '', loading: false });
  const [kiroImportState, setKiroImportState] = useState<KiroImportState>({ loading: false });
  const pollingTimers = useRef<Partial<Record<OAuthPlusProvider, number>>>({});
  const successResetTimers = useRef<Partial<Record<OAuthPlusProvider, number>>>({});

  const clearTimers = useCallback(() => {
    Object.values(pollingTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearInterval(timer);
    });
    Object.values(successResetTimers.current).forEach((timer) => {
      if (timer !== undefined) window.clearTimeout(timer);
    });
    pollingTimers.current = {};
    successResetTimers.current = {};
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const updateProviderState = (provider: OAuthPlusProvider, next: Partial<ProviderState>) => {
    setStates((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] ?? {}), ...next }
    }));
  };

  const clearPollingTimer = (provider: OAuthPlusProvider) => {
    const timer = pollingTimers.current[provider];
    if (timer !== undefined) {
      window.clearInterval(timer);
      delete pollingTimers.current[provider];
    }
  };

  const clearSuccessResetTimer = (provider: OAuthPlusProvider) => {
    const timer = successResetTimers.current[provider];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete successResetTimers.current[provider];
    }
  };

  const clearProviderTimers = (provider: OAuthPlusProvider) => {
    clearPollingTimer(provider);
    clearSuccessResetTimer(provider);
  };

  const resetProviderAttempt = (provider: OAuthPlusProvider) => {
    clearProviderTimers(provider);
    setStates((prev) => {
      const current = prev[provider] ?? {};
      const next: ProviderState = {};
      if (provider === 'cursor') next.label = current.label;
      if (provider === 'gitlab') {
        next.gitlabBaseUrl = current.gitlabBaseUrl;
        next.gitlabClientId = current.gitlabClientId;
        next.gitlabClientSecret = current.gitlabClientSecret;
      }
      if (provider === 'kiro-idc') {
        next.kiroStartUrl = current.kiroStartUrl;
        next.kiroRegion = current.kiroRegion;
        next.kiroFlow = current.kiroFlow;
      }
      return { ...prev, [provider]: next };
    });
  };

  const completeProviderAuth = (provider: OAuthPlusProvider) => {
    clearPollingTimer(provider);
    clearSuccessResetTimer(provider);
    updateProviderState(provider, {
      url: undefined,
      state: undefined,
      status: 'success',
      error: undefined,
      polling: false,
      callbackUrl: '',
      callbackSubmitting: false,
      callbackStatus: undefined,
      callbackError: undefined
    });
    successResetTimers.current[provider] = window.setTimeout(() => {
      resetProviderAttempt(provider);
    }, SUCCESS_RESET_DELAY_MS);
  };

  const startPolling = (provider: OAuthPlusProvider, state: string) => {
    clearPollingTimer(provider);
    const timer = window.setInterval(async () => {
      try {
        const res = await oauthPlusApi.getAuthStatus(state);
        if (res.status === 'ok') {
          completeProviderAuth(provider);
          showNotification(t(getAuthKey(provider, 'oauth_status_success')), 'success');
        } else if (res.status === 'device_code') {
          updateProviderState(provider, { url: res.verification_url, userCode: res.user_code, status: 'waiting', polling: true });
        } else if (res.status === 'auth_url') {
          updateProviderState(provider, { url: res.url, status: 'waiting', polling: true });
        } else if (res.status === 'error') {
          updateProviderState(provider, { status: 'error', error: res.error, polling: false });
          showNotification(`${t(getAuthKey(provider, 'oauth_status_error'))} ${res.error || ''}`, 'error');
          window.clearInterval(timer);
          delete pollingTimers.current[provider];
        }
      } catch (err: unknown) {
        updateProviderState(provider, { status: 'error', error: getErrorMessage(err), polling: false });
        window.clearInterval(timer);
        delete pollingTimers.current[provider];
      }
    }, 3000);
    pollingTimers.current[provider] = timer;
  };

  const startAuth = async (provider: OAuthPlusProvider) => {
    clearProviderTimers(provider);
    const currentState = states[provider];
    updateProviderState(provider, {
      url: undefined,
      state: undefined,
      status: 'waiting',
      polling: true,
      error: undefined,
      callbackStatus: undefined,
      callbackError: undefined,
      callbackUrl: '',
      userCode: undefined
    });
    try {
      const res = await oauthPlusApi.startAuth(
        provider,
        provider === 'cursor'
          ? { label: currentState?.label?.trim() || undefined }
          : provider === 'gitlab'
            ? {
                gitlabBaseUrl: currentState?.gitlabBaseUrl?.trim() || undefined,
                gitlabClientId: currentState?.gitlabClientId?.trim() || undefined,
                gitlabClientSecret: currentState?.gitlabClientSecret?.trim() || undefined
              }
            : provider === 'kiro-idc'
              ? {
                  kiroStartUrl: currentState?.kiroStartUrl?.trim() || undefined,
                  kiroRegion: currentState?.kiroRegion?.trim() || undefined,
                  kiroFlow: currentState?.kiroFlow?.trim() || 'authcode'
                }
              : undefined
      );
      if (!res.state) {
        const message = t('auth_login.missing_state');
        updateProviderState(provider, { url: res.url, state: undefined, status: 'error', error: message, polling: false });
        showNotification(message, 'error');
        return;
      }
      updateProviderState(provider, { url: res.url, userCode: res.user_code, state: res.state, status: 'waiting', polling: true });
      startPolling(provider, res.state);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      updateProviderState(provider, { status: 'error', error: message, polling: false });
      showNotification(`${t(getAuthKey(provider, 'oauth_start_error'))}${message ? ` ${message}` : ''}`, 'error');
    }
  };

  const copyLink = async (url?: string) => {
    if (!url) return;
    const copied = await copyToClipboard(url);
    showNotification(t(copied ? 'notification.link_copied' : 'notification.copy_failed'), copied ? 'success' : 'error');
  };

  const submitCallback = async (provider: OAuthPlusProvider) => {
    const redirectUrl = (states[provider]?.callbackUrl || '').trim();
    if (!redirectUrl) {
      showNotification(t('auth_login.oauth_callback_required'), 'warning');
      return;
    }
    updateProviderState(provider, { callbackSubmitting: true, callbackStatus: undefined, callbackError: undefined });
    try {
      await oauthPlusApi.submitCallback(provider, redirectUrl);
      updateProviderState(provider, { callbackSubmitting: false, callbackStatus: 'success' });
      showNotification(t('auth_login.oauth_callback_success'), 'success');
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err);
      const errorMessage =
        status === 404
          ? t('auth_login.oauth_callback_upgrade_hint', { defaultValue: 'Please update CLI Proxy API or check the connection.' })
          : message || undefined;
      updateProviderState(provider, { callbackSubmitting: false, callbackStatus: 'error', callbackError: errorMessage });
      showNotification(errorMessage ? `${t('auth_login.oauth_callback_error')} ${errorMessage}` : t('auth_login.oauth_callback_error'), 'error');
    }
  };

  const submitIFlowCookie = async () => {
    const cookie = iflowCookieState.cookie.trim();
    if (!cookie) {
      showNotification(t('auth_login.iflow_cookie_required'), 'warning');
      return;
    }
    setIflowCookieState((prev) => ({ ...prev, loading: true, error: undefined, result: undefined }));
    try {
      const result = await oauthPlusApi.submitIFlowCookie(cookie);
      setIflowCookieState((prev) => ({ ...prev, loading: false, result }));
      showNotification(t('auth_login.iflow_cookie_status_success'), 'success');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setIflowCookieState((prev) => ({ ...prev, loading: false, error: message }));
      showNotification(`${t('auth_login.iflow_cookie_status_error')} ${message || ''}`.trim(), 'error');
    }
  };

  const submitGitLabPat = async () => {
    const token = gitlabPatState.token.trim();
    if (!token) {
      showNotification(t('auth_login.gitlab_pat_required'), 'warning');
      return;
    }
    setGitlabPatState((prev) => ({ ...prev, loading: true, error: undefined, result: undefined }));
    try {
      const result = await oauthPlusApi.submitGitLabPat({
        baseUrl: gitlabPatState.baseUrl.trim() || undefined,
        personalAccessToken: token
      });
      setGitlabPatState((prev) => ({ ...prev, loading: false, result }));
      showNotification(t('auth_login.gitlab_pat_status_success'), 'success');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setGitlabPatState((prev) => ({ ...prev, loading: false, error: message }));
      showNotification(`${t('auth_login.gitlab_pat_status_error')} ${message || ''}`.trim(), 'error');
    }
  };

  const importKiroToken = async () => {
    setKiroImportState({ loading: true });
    try {
      const result = await oauthPlusApi.importKiroToken();
      setKiroImportState({ loading: false, result });
      showNotification(t('auth_login.kiro_import_status_success'), 'success');
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setKiroImportState({ loading: false, error: message });
      showNotification(`${t('auth_login.kiro_import_status_error')} ${message || ''}`.trim(), 'error');
    }
  };

  return (
    <>
      {PROVIDERS.map((provider) => {
        const state = states[provider.id] || {};
        const canSubmitCallback = CALLBACK_SUPPORTED.includes(provider.id) && Boolean(state.url);
        const loginButtonLabel = state.status === 'success' ? t('auth_login.login_another_account') : t(getAuthKey(provider.id, 'oauth_button'));
        const statusBadgeClassName = ['status-badge', state.status === 'success' ? 'success' : '', state.status === 'error' ? 'error' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <Card
            key={provider.id}
            title={
              <span className={styles.cardTitle}>
                {provider.icon ? <img src={provider.icon} alt="" className={styles.cardTitleIcon} /> : <span className={styles.providerBadge}>{provider.badge}</span>}
                {t(provider.titleKey)}
              </span>
            }
            extra={<Button onClick={() => startAuth(provider.id)} loading={state.polling}>{loginButtonLabel}</Button>}
          >
            <div className={styles.cardContent}>
              <div className={styles.cardHint}>{t(provider.hintKey)}</div>
              {provider.id === 'cursor' && (
                <Input
                  label={t('auth_login.cursor_label_label')}
                  hint={t('auth_login.cursor_label_hint')}
                  value={state.label || ''}
                  disabled={Boolean(state.polling)}
                  onChange={(e) => updateProviderState(provider.id, { label: e.target.value })}
                  placeholder={t('auth_login.cursor_label_placeholder')}
                />
              )}
              {provider.id === 'gitlab' && (
                <>
                  <Input label={t('auth_login.gitlab_base_url_label')} hint={t('auth_login.gitlab_base_url_hint')} value={state.gitlabBaseUrl || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { gitlabBaseUrl: e.target.value })} placeholder={t('auth_login.gitlab_base_url_placeholder')} />
                  <Input label={t('auth_login.gitlab_client_id_label')} hint={t('auth_login.gitlab_client_id_hint')} value={state.gitlabClientId || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { gitlabClientId: e.target.value })} placeholder={t('auth_login.gitlab_client_id_placeholder')} />
                  <Input label={t('auth_login.gitlab_client_secret_label')} hint={t('auth_login.gitlab_client_secret_hint')} value={state.gitlabClientSecret || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { gitlabClientSecret: e.target.value })} placeholder={t('auth_login.gitlab_client_secret_placeholder')} />
                </>
              )}
              {provider.id === 'kiro-idc' && (
                <>
                  <Input label={t('auth_login.kiro_idc_start_url_label')} hint={t('auth_login.kiro_idc_start_url_hint')} value={state.kiroStartUrl || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { kiroStartUrl: e.target.value })} placeholder={t('auth_login.kiro_idc_start_url_placeholder')} />
                  <Input label={t('auth_login.kiro_idc_region_label')} hint={t('auth_login.kiro_idc_region_hint')} value={state.kiroRegion || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { kiroRegion: e.target.value })} placeholder={t('auth_login.kiro_idc_region_placeholder')} />
                  <Input label={t('auth_login.kiro_idc_flow_label')} hint={t('auth_login.kiro_idc_flow_hint')} value={state.kiroFlow || ''} disabled={Boolean(state.polling)} onChange={(e) => updateProviderState(provider.id, { kiroFlow: e.target.value })} placeholder={t('auth_login.kiro_idc_flow_placeholder')} />
                </>
              )}
              {state.url && (
                <div className={styles.authUrlBox}>
                  <div className={styles.authUrlLabel}>{t(provider.urlLabelKey)}</div>
                  <div className={styles.authUrlValue}>{state.url}</div>
                  {state.userCode && <div className={styles.authUserCode}>{t('auth_login.device_code_label')}: <strong>{state.userCode}</strong></div>}
                  <div className={styles.authUrlActions}>
                    <Button variant="secondary" size="sm" onClick={() => copyLink(state.url!)}>{t(getAuthKey(provider.id, 'copy_link'))}</Button>
                    <Button variant="secondary" size="sm" onClick={() => window.open(state.url, '_blank', 'noopener,noreferrer')}>{t(getAuthKey(provider.id, 'open_link'))}</Button>
                  </div>
                </div>
              )}
              {canSubmitCallback && (
                <div className={styles.callbackSection}>
                  <Input label={t('auth_login.oauth_callback_label')} hint={t('auth_login.oauth_callback_hint')} value={state.callbackUrl || ''} onChange={(e) => updateProviderState(provider.id, { callbackUrl: e.target.value, callbackStatus: undefined, callbackError: undefined })} placeholder={t('auth_login.oauth_callback_placeholder')} />
                  <div className={styles.callbackActions}>
                    <Button variant="secondary" size="sm" onClick={() => submitCallback(provider.id)} loading={state.callbackSubmitting}>{t('auth_login.oauth_callback_button')}</Button>
                  </div>
                  {state.callbackStatus === 'success' && state.status === 'waiting' && <div className="status-badge success">{t('auth_login.oauth_callback_status_success')}</div>}
                  {state.callbackStatus === 'error' && <div className="status-badge error">{t('auth_login.oauth_callback_status_error')} {state.callbackError || ''}</div>}
                </div>
              )}
              {state.status && state.status !== 'idle' && (
                <div className={statusBadgeClassName}>
                  {state.status === 'success'
                    ? t(getAuthKey(provider.id, 'oauth_status_success'))
                    : state.status === 'error'
                      ? `${t(getAuthKey(provider.id, 'oauth_status_error'))} ${state.error || ''}`
                      : t(getAuthKey(provider.id, 'oauth_status_waiting'))}
                </div>
              )}
              {state.status === 'success' && (
                <div className={styles.successActions}>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/auth-files')}>{t('auth_login.view_auth_files')}</Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <Card title={t('auth_login.kiro_import_title')} extra={<Button onClick={importKiroToken} loading={kiroImportState.loading}>{t('auth_login.kiro_import_button')}</Button>}>
        <div className={styles.cardContent}>
          <div className={styles.cardHint}>{t('auth_login.kiro_import_hint')}</div>
          {kiroImportState.error && <div className="status-badge error">{t('auth_login.kiro_import_status_error')} {kiroImportState.error}</div>}
          {kiroImportState.result && (
            <div className={styles.connectionBox}>
              <div className={styles.connectionLabel}>{t('auth_login.kiro_import_result_title')}</div>
              <div className={styles.keyValueList}>
                {kiroImportState.result.label && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.kiro_import_result_label')}</span><span className={styles.keyValueValue}>{kiroImportState.result.label}</span></div>}
                {kiroImportState.result.saved_path && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.kiro_import_result_path')}</span><span className={styles.keyValueValue}>{kiroImportState.result.saved_path}</span></div>}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title={t('auth_login.iflow_cookie_title')} extra={<Button onClick={submitIFlowCookie} loading={iflowCookieState.loading}>{t('auth_login.iflow_cookie_button')}</Button>}>
        <div className={styles.cardContent}>
          <div className={styles.cardHint}>{t('auth_login.iflow_cookie_hint')}</div>
          <Input label={t('auth_login.iflow_cookie_label')} hint={t('auth_login.iflow_cookie_key_hint')} value={iflowCookieState.cookie} onChange={(e) => setIflowCookieState((prev) => ({ ...prev, cookie: e.target.value }))} placeholder={t('auth_login.iflow_cookie_placeholder')} />
          {iflowCookieState.error && <div className="status-badge error">{t('auth_login.iflow_cookie_status_error')} {iflowCookieState.error}</div>}
          {iflowCookieState.result && (
            <div className={styles.connectionBox}>
              <div className={styles.connectionLabel}>{t('auth_login.iflow_cookie_result_title')}</div>
              <div className={styles.keyValueList}>
                {iflowCookieState.result.email && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.iflow_cookie_result_email')}</span><span className={styles.keyValueValue}>{iflowCookieState.result.email}</span></div>}
                {iflowCookieState.result.saved_path && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.iflow_cookie_result_path')}</span><span className={styles.keyValueValue}>{iflowCookieState.result.saved_path}</span></div>}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title={t('auth_login.gitlab_pat_title')} extra={<Button onClick={submitGitLabPat} loading={gitlabPatState.loading}>{t('auth_login.gitlab_pat_button')}</Button>}>
        <div className={styles.cardContent}>
          <div className={styles.cardHint}>{t('auth_login.gitlab_pat_hint')}</div>
          <Input label={t('auth_login.gitlab_base_url_label')} hint={t('auth_login.gitlab_base_url_hint')} value={gitlabPatState.baseUrl} onChange={(e) => setGitlabPatState((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder={t('auth_login.gitlab_base_url_placeholder')} />
          <Input label={t('auth_login.gitlab_pat_label')} hint={t('auth_login.gitlab_pat_input_hint')} value={gitlabPatState.token} onChange={(e) => setGitlabPatState((prev) => ({ ...prev, token: e.target.value }))} placeholder={t('auth_login.gitlab_pat_placeholder')} />
          {gitlabPatState.error && <div className="status-badge error">{t('auth_login.gitlab_pat_status_error')} {gitlabPatState.error}</div>}
          {gitlabPatState.result && (
            <div className={styles.connectionBox}>
              <div className={styles.connectionLabel}>{t('auth_login.gitlab_pat_result_title')}</div>
              <div className={styles.keyValueList}>
                {gitlabPatState.result.username && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.gitlab_pat_result_username')}</span><span className={styles.keyValueValue}>{gitlabPatState.result.username}</span></div>}
                {gitlabPatState.result.email && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.gitlab_pat_result_email')}</span><span className={styles.keyValueValue}>{gitlabPatState.result.email}</span></div>}
                {gitlabPatState.result.saved_path && <div className={styles.keyValueItem}><span className={styles.keyValueKey}>{t('auth_login.gitlab_pat_result_path')}</span><span className={styles.keyValueValue}>{gitlabPatState.result.saved_path}</span></div>}
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
