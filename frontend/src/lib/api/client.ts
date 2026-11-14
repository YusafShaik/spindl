export const TOKEN_KEY = 'spindl.accessToken';

/** API root used by all authenticated frontend requests. */
export const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Preserve the application's existing bearer token and unauthorized-session
 * behavior. This helper deliberately does not retry requests.
 */
export function apiFetch(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...options, headers }).then((response) => {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('spindl.session');
      window.dispatchEvent(new Event('spindl:unauthorized'));
    }
    return response;
  });
}
