/**
 * @author codex
 * Stores the signed platform session token used by gateway API calls.
 */
export interface StoredAuthUser {
  username: string;
  displayName: string;
  roleCode: string;
  token: string;
}

const AUTH_TOKEN_KEY = 'qtp-auth-token';
const AUTH_USER_KEY = 'qtp-auth-user';

export function saveAuthSession(user: StoredAuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, user.token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
    username: user.username,
    displayName: user.displayName,
    roleCode: user.roleCode,
  }));
}

export function readAuthToken() {
  if (!canUseStorage()) return undefined;
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? undefined;
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}
