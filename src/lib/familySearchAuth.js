/**
 * FamilySearch OAuth 2.0 PKCE Authentication Client
 * Compatible with FamilySearch CIS Web OAuth2 endpoints.
 */

const FS_TOKEN_STORAGE_KEY = 'fs_oauth_token';
const FS_CODE_VERIFIER_KEY = 'fs_code_verifier';
const FS_OAUTH_STATE_KEY = 'fs_oauth_state';

export function getStoredRedirectUriOverride() {
  try {
    return localStorage.getItem('fs_override_redirect_uri') || '';
  } catch {
    return '';
  }
}

export function setStoredRedirectUriOverride(uri) {
  try {
    if (!uri) {
      localStorage.removeItem('fs_override_redirect_uri');
    } else {
      localStorage.setItem('fs_override_redirect_uri', uri.trim());
    }
  } catch {}
}

export function getFamilySearchConfig() {
  const clientId = import.meta.env.VITE_FS_CLIENT_ID || '';
  const authUrl = import.meta.env.VITE_FS_AUTH_URL || 'https://identbeta.familysearch.org/cis-web/oauth2/v3/authorization';
  const tokenUrl = import.meta.env.VITE_FS_TOKEN_URL || 'https://identbeta.familysearch.org/cis-web/oauth2/v3/token';
  const apiBase = import.meta.env.VITE_FS_API_BASE || 'https://apibeta.familysearch.org';

  const storedOverride = getStoredRedirectUriOverride();
  let redirectUri = storedOverride || import.meta.env.VITE_FS_REDIRECT_URI || '';
  
  if (!redirectUri) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // By default test http://localhost:5173 without slash, toggleable in UI
      redirectUri = 'http://localhost:5173';
    } else {
      redirectUri = 'https://jviola60.github.io/family-history-photos/';
    }
  }

  return {
    clientId: clientId.trim(),
    authUrl,
    tokenUrl,
    apiBase,
    redirectUri
  };
}

/**
 * Generate cryptographically secure random string for PKCE code verifier and state
 */
function generateRandomString(length = 64) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(x => possible[x % possible.length]).join('');
}

/**
 * Generate SHA-256 base64url-encoded code challenge from verifier
 */
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64;
}

/**
 * Initiate FamilySearch OAuth login redirect using PKCE
 */
export async function startFamilySearchLogin(overrideRedirectUri) {
  const config = getFamilySearchConfig();
  if (!config.clientId) {
    throw new Error('FamilySearch AppKey is missing. Please check your .env settings.');
  }

  const redirectUri = overrideRedirectUri || config.redirectUri;
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem(FS_CODE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(FS_OAUTH_STATE_KEY, state);
  sessionStorage.setItem('fs_active_redirect_uri', redirectUri);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state
  });

  const targetAuthUrl = `${config.authUrl}?${params.toString()}`;
  window.location.href = targetAuthUrl;
}

/**
 * Handle incoming OAuth callback code after redirect from FamilySearch
 */
export async function handleFamilySearchCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    cleanupUrlParams();
    throw new Error(`FamilySearch authentication error: ${error}`);
  }

  if (!code) {
    return null;
  }

  const savedState = sessionStorage.getItem(FS_OAUTH_STATE_KEY);
  const codeVerifier = sessionStorage.getItem(FS_CODE_VERIFIER_KEY);
  const activeRedirect = sessionStorage.getItem('fs_active_redirect_uri');

  // Clean stored verification params immediately
  sessionStorage.removeItem(FS_OAUTH_STATE_KEY);
  sessionStorage.removeItem(FS_CODE_VERIFIER_KEY);
  sessionStorage.removeItem('fs_active_redirect_uri');

  if (!codeVerifier) {
    cleanupUrlParams();
    throw new Error('Missing PKCE code verifier. Please try signing in again.');
  }

  if (state && savedState && state !== savedState) {
    cleanupUrlParams();
    throw new Error('OAuth state mismatch detected.');
  }

  const config = getFamilySearchConfig();
  const redirectUriToUse = activeRedirect || config.redirectUri;

  const tokenPayload = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: code,
    redirect_uri: redirectUriToUse,
    code_verifier: codeVerifier
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenPayload.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    cleanupUrlParams();
    throw new Error(`Failed to exchange FamilySearch token (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const tokenData = {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Bearer',
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
    scope: data.scope || ''
  };

  saveStoredToken(tokenData);
  cleanupUrlParams();
  return tokenData;
}

function cleanupUrlParams() {
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

function saveStoredToken(tokenData) {
  try {
    localStorage.setItem(FS_TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
  } catch {}
}

export function getStoredFamilySearchToken() {
  try {
    const raw = localStorage.getItem(FS_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw);
    if (!token.accessToken) return null;
    if (token.expiresAt && Date.now() > token.expiresAt - 60000) {
      // Token expired or about to expire in < 1 minute
      clearFamilySearchToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearFamilySearchToken() {
  try {
    localStorage.removeItem(FS_TOKEN_STORAGE_KEY);
  } catch {}
}

/**
 * Fetch current user profile to verify authentication
 */
export async function getFamilySearchCurrentUser() {
  const token = getStoredFamilySearchToken();
  if (!token) return null;

  const config = getFamilySearchConfig();
  try {
    const res = await fetch(`${config.apiBase}/platform/users/current`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 401) {
      clearFamilySearchToken();
      return null;
    }

    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.users?.[0];
    return {
      id: user?.id,
      contactName: user?.contactName || user?.displayName || 'FamilySearch User',
      treePersonId: user?.personId || null
    };
  } catch (err) {
    console.warn('Could not fetch FamilySearch user profile:', err);
    return null;
  }
}
