/**
 * Shared API helpers and error shape for service layer.
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number, details?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = meta.code ?? 'unknown';
    this.status = meta.status;
    this.details = meta.details;
  }
}

/**
 * @param {{ data: unknown, error: { message?: string, code?: string, status?: number } | null }} result
 */
export function unwrap(result) {
  if (result.error) {
    throw new ApiError(result.error.message || 'Request failed', {
      code: result.error.code,
      status: result.error.status,
      details: result.error,
    });
  }
  return result.data;
}

/**
 * @param {unknown} _client — legacy, ignored
 * @param {string} bucket
 * @param {string | null | undefined} path
 * @param {string | null | undefined} externalUrl
 */
export function resolveMediaUrl(_client, bucket, path, externalUrl) {
  if (externalUrl) return externalUrl;
  if (!path) return null;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (base) return `${base}/uploads/${bucket}/${path}`.replace(/([^:]\/)\/+/g, '$1');
  return `/uploads/${bucket}/${path}`;
}
