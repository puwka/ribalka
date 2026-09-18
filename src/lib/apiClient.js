/**
 * HTTP API client for self-hosted PostgreSQL backend.
 * Replaces Supabase browser client.
 */

const TOKEN_KEY = 'rybalka_auth_token';
const DEFAULT_TIMEOUT_MS = 15000;

export const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const apiDataEnabled =
  import.meta.env.VITE_USE_API === 'true' && Boolean(apiBaseUrl);

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function parseResponse(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/**
 * @param {string} path
 * @param {RequestInit & { timeoutMs?: number }} [options]
 */
export async function apiRequest(path, options = {}) {
  if (!apiDataEnabled) {
    throw new Error('API mode is disabled');
  }
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOpts } = options;
  const headers = { ...(fetchOpts.headers || {}) };
  if (fetchOpts.body && !(fetchOpts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
      body:
        fetchOpts.body && !(fetchOpts.body instanceof FormData)
          ? JSON.stringify(fetchOpts.body)
          : fetchOpts.body,
    });
    return await parseResponse(res);
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error('Сервер не отвечает. Проверьте интернет и попробуйте ещё раз.');
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  get: (path, opts) => apiRequest(path, opts),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiRequest(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => apiRequest(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
  upload: (bucket, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiRequest(`/api/uploads/${bucket}`, { method: 'POST', body: fd, timeoutMs: 60000 });
  },
};

/** @deprecated use apiDataEnabled */
export const supabaseDataEnabled = apiDataEnabled;

/** Public media URL for files stored on API server */
export function resolveMediaUrl(_client, bucket, storagePath, externalUrl) {
  if (externalUrl) return externalUrl;
  if (!storagePath) return null;
  const base = apiBaseUrl || '';
  return `${base}/uploads/${bucket}/${storagePath}`.replace(/([^:]\/)\/+/g, '$1');
}
