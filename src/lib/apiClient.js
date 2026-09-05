/**
 * HTTP API client for self-hosted PostgreSQL backend.
 * Replaces Supabase browser client.
 */

const TOKEN_KEY = 'rybalka_auth_token';

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

export async function apiRequest(path, options = {}) {
  if (!apiDataEnabled) {
    throw new Error('API mode is disabled');
  }
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  return parseResponse(res);
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
  upload: (bucket, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiRequest(`/api/uploads/${bucket}`, { method: 'POST', body: fd });
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
