/**
 * apiFetch – a thin wrapper around fetch that:
 *  1. Attaches the current Bearer token automatically.
 *  2. On a 401/403 response, tries to silently refresh the access token once.
 *  3. Retries the original request with the new token.
 *  4. If refresh fails, dispatches a custom "auth:expired" event so the
 *     AuthProvider can clear the session and redirect to /login.
 *
 * Usage:
 *   import { createApiFetch } from '../context/apiFetch.js';
 *   // Inside a component / hook:
 *   const api = createApiFetch(accessToken, refreshSession);
 *   const res = await api('/api/v1/students/profile');
 */

const AUTH_API = '/api/v1/auth';

/**
 * Returns an apiFetch function bound to the caller's token + refresh callback.
 *
 * @param {string|null}   accessToken    – current JWT access token
 * @param {Function}      refreshSession – AuthContext.refreshSession()
 */
export function createApiFetch(accessToken, refreshSession) {
  /**
   * @param {string} url
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}  resolved response (may be error status)
   */
  return async function apiFetch(url, options = {}) {
    const makeHeaders = (token) => ({
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    // First attempt
    let response = await fetch(url, {
      ...options,
      headers: makeHeaders(accessToken),
    });

    // If the token was rejected, try a silent refresh once
    if (response.status === 401 || response.status === 403) {
      let newToken = null;
      try {
        newToken = await refreshSession();
      } catch {
        // refresh failed — broadcast session expiry
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return response; // return original failed response
      }

      if (newToken) {
        // Retry with the fresh token
        response = await fetch(url, {
          ...options,
          headers: makeHeaders(newToken),
        });
      } else {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    return response;
  };
}

/**
 * Convenience hook-compatible helper.
 * Call this at the top of a component after useAuth():
 *
 *   const { token, refreshSession } = useAuth();
 *   const apiFetch = useApiFetch(token, refreshSession);
 */
export function useApiFetch(token, refreshSession) {
  return createApiFetch(token, refreshSession);
}

