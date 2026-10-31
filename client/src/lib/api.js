import { supabase } from './supabase.js';

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let token = null;
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || null;
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the Oopsie server. Is it running on port 8787?', 0, 'network');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Some failures (proxies, outages) don't return JSON.
  }

  if (!response.ok) {
    if (response.status === 401 && supabase) {
      // Token is no longer valid; let the auth listener take the learner home.
      supabase.auth.signOut().catch(() => {});
    }
    throw new ApiError(payload?.error || `Request failed (${response.status}).`, response.status, payload?.code);
  }

  return payload;
}
