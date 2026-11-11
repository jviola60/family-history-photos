/**
 * FamilySearch Client for Family History Photos
 * Standalone browser client for FamilySearch Beta OAuth2 PKCE and Memories API.
 */
(function (global) {
  'use strict';

  var FS_TOKEN_KEY = 'fs_oauth_token';
  var FS_VERIFIER_KEY = 'fs_code_verifier';
  var FS_STATE_KEY = 'fs_oauth_state';
  var FS_REDIRECT_KEY = 'fs_active_redirect_uri';
  var FS_OVERRIDE_REDIRECT_KEY = 'fs_override_redirect_uri';
  var FS_OVERRIDE_CLIENT_ID = 'fs_override_client_id';

  var DEFAULT_CLIENT_ID = 'b4BB18Q5LQKBNVYEIJL6';
  var AUTH_URL = 'https://identbeta.familysearch.org/cis-web/oauth2/v3/authorization';
  var TOKEN_URL = 'https://identbeta.familysearch.org/cis-web/oauth2/v3/token';
  var API_BASE = 'https://apibeta.familysearch.org';
  var WEB_BASE = 'https://beta.familysearch.org';

  function getClientId() {
    try {
      return localStorage.getItem(FS_OVERRIDE_CLIENT_ID) || DEFAULT_CLIENT_ID;
    } catch (e) {
      return DEFAULT_CLIENT_ID;
    }
  }

  function setClientId(id) {
    try {
      if (!id) localStorage.removeItem(FS_OVERRIDE_CLIENT_ID);
      else localStorage.setItem(FS_OVERRIDE_CLIENT_ID, id.trim());
    } catch (e) { }
  }

  function getRedirectUri() {
    try {
      var override = localStorage.getItem(FS_OVERRIDE_REDIRECT_KEY);
      if (override) return override.trim();
    } catch (e) { }

    if (typeof window !== 'undefined' && window.location) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin; // e.g. http://localhost:5173
      }
      // GitHub Pages production URL - default to NO trailing slash (most common in FamilySearch portal)
      var clean = window.location.origin + window.location.pathname;
      if (clean.endsWith('/') && clean.length > window.location.origin.length + 1) {
        clean = clean.slice(0, -1);
      }
      return clean;
    }
    return 'https://jviola60.github.io/family-history-photos';
  }

  function setRedirectUri(uri) {
    try {
      if (!uri) localStorage.removeItem(FS_OVERRIDE_REDIRECT_KEY);
      else localStorage.setItem(FS_OVERRIDE_REDIRECT_KEY, uri.trim());
    } catch (e) { }
  }

  function showConnectionDialog(options) {
    options = options || {};
    var existingModal = document.getElementById('fs-connection-modal');
    if (existingModal) existingModal.remove();

    var currentClientId = getClientId();
    var currentRedirect = getRedirectUri();
    var ghNoSlash = 'https://jviola60.github.io/family-history-photos';
    var ghWithSlash = 'https://jviola60.github.io/family-history-photos/';
    var localUri = (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
      ? window.location.origin
      : 'http://localhost:5173';

    var modal = document.createElement('div');
    modal.id = 'fs-connection-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(17,17,16,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
    modal.innerHTML = `
      <div style="background:var(--surface,#ffffff);border:1px solid var(--border,#dfdeda);border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,0.4);max-width:580px;width:100%;overflow:hidden;color:var(--text,#111110);">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border,#dfdeda);background:var(--raised,#f0efec);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🌳</span>
            <strong style="font-size:15px;">FamilySearch Beta OAuth2 Settings</strong>
          </div>
          <button type="button" id="fs-modal-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted,#575653);padding:2px 6px;">✕</button>
        </div>

        <div style="padding:20px;display:flex;flex-direction:column;gap:14px;font-size:13px;max-height:80vh;overflow-y:auto;">
          <div style="background:var(--pill-warning-bg,#fffbeb);border:1px solid rgba(146,64,14,0.25);border-radius:8px;padding:12px 14px;color:var(--pill-warning-ink,#92400e);line-height:1.45;">
            <strong>Why "redirect URI not configured correctly"?</strong><br>
            FamilySearch requires the <em>Redirect URI</em> sent by this app to match <strong>character-for-character</strong> with the Redirect URIs configured under your AppKey in the FamilySearch Developer Portal (including whether there is a trailing slash <code>/</code>).
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:5px;">FamilySearch AppKey (Client ID):</label>
            <input type="text" id="fs-modal-client-id" value="${currentClientId}" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border,#dfdeda);border-radius:6px;font-family:monospace;font-size:13px;background:var(--surface,#ffffff);color:var(--text,#111110);">
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:5px;">Active Redirect URI sent to FamilySearch:</label>
            <input type="text" id="fs-modal-redirect-uri" value="${currentRedirect}" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border,#dfdeda);border-radius:6px;font-family:monospace;font-size:13px;background:var(--surface,#ffffff);color:var(--text,#111110);">
            
            <div style="margin-top:8px;">
              <span style="font-size:11px;color:var(--muted,#575653);font-weight:600;display:block;margin-bottom:4px;">1-Click Quick Select:</span>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="btn sm" id="fs-preset-noslash" style="font-size:11px;padding:4px 8px;background:var(--raised,#f0efec);">
                  No Slash (.../family-history-photos)
                </button>
                <button type="button" class="btn sm" id="fs-preset-slash" style="font-size:11px;padding:4px 8px;background:var(--raised,#f0efec);">
                  With Slash (.../family-history-photos/)
                </button>
                <button type="button" class="btn sm" id="fs-preset-local" style="font-size:11px;padding:4px 8px;background:var(--raised,#f0efec);">
                  Localhost (${localUri})
                </button>
              </div>
            </div>
          </div>

          <div style="background:var(--ground,#f4f3f1);border:1px solid var(--border,#dfdeda);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--muted,#575653);line-height:1.5;">
            <span>Check or update your registered Redirect URIs anytime:</span><br>
            <a href="https://www.familysearch.org/developers/" target="_blank" rel="noopener" style="color:var(--accent,#1d5fbf);font-weight:600;display:inline-flex;align-items:center;gap:4px;margin-top:4px;">
              FamilySearch Developer Portal ↗
            </a>
          </div>
        </div>

        <div style="padding:14px 20px;border-top:1px solid var(--border,#dfdeda);background:var(--raised,#f0efec);display:flex;justify-content:space-between;gap:8px;">
          <button type="button" class="btn" id="fs-modal-cancel" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Cancel</button>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn" id="fs-modal-save-only" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Save Settings</button>
            <button type="button" class="btn primary" id="fs-modal-save-login" style="padding:6px 18px;border:1px solid #164388;border-radius:6px;background:#1d5fbf;color:#ffffff;font-weight:600;cursor:pointer;">
              Save &amp; Sign In →
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    function closeModal() {
      modal.remove();
    }

    document.getElementById('fs-modal-close').onclick = closeModal;
    document.getElementById('fs-modal-cancel').onclick = closeModal;

    document.getElementById('fs-preset-noslash').onclick = function () {
      document.getElementById('fs-modal-redirect-uri').value = ghNoSlash;
    };
    document.getElementById('fs-preset-slash').onclick = function () {
      document.getElementById('fs-modal-redirect-uri').value = ghWithSlash;
    };
    document.getElementById('fs-preset-local').onclick = function () {
      document.getElementById('fs-modal-redirect-uri').value = localUri;
    };

    function applySettings() {
      var newClientId = document.getElementById('fs-modal-client-id').value.trim();
      var newRedirect = document.getElementById('fs-modal-redirect-uri').value.trim();
      if (newClientId) setClientId(newClientId);
      if (newRedirect) setRedirectUri(newRedirect);
    }

    document.getElementById('fs-modal-save-only').onclick = function () {
      applySettings();
      closeModal();
      if (typeof notify === 'function') notify('Saved FamilySearch connection settings.');
    };

    document.getElementById('fs-modal-save-login').onclick = function () {
      applySettings();
      var uri = document.getElementById('fs-modal-redirect-uri').value.trim();
      closeModal();
      startLogin(uri);
    };

    modal.onclick = function (e) {
      if (e.target === modal) closeModal();
    };
  }

  function getStoredToken() {
    try {
      var raw = localStorage.getItem(FS_TOKEN_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.accessToken) return null;
      if (data.expiresAt && Date.now() > data.expiresAt - 60000) {
        clearToken();
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveToken(tokenData) {
    try {
      localStorage.setItem(FS_TOKEN_KEY, JSON.stringify(tokenData));
    } catch (e) { }
  }

  function clearToken() {
    try {
      localStorage.removeItem(FS_TOKEN_KEY);
    } catch (e) { }
  }

  function randomString(length) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    var values = crypto.getRandomValues(new Uint8Array(length));
    var out = '';
    for (var i = 0; i < values.length; i++) {
      out += chars[values[i] % chars.length];
    }
    return out;
  }

  async function sha256Base64Url(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    var digest = await crypto.subtle.digest('SHA-256', data);
    var bytes = new Uint8Array(digest);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function startLogin(overrideUriOrOptions) {
    var overrideUri = typeof overrideUriOrOptions === 'string' ? overrideUriOrOptions : (overrideUriOrOptions && overrideUriOrOptions.redirectUri);
    var usePopup = typeof overrideUriOrOptions === 'object' ? overrideUriOrOptions.popup !== false : true;

    var clientId = getClientId();
    var redirectUri = overrideUri || getRedirectUri();
    var codeVerifier = randomString(64);
    var state = randomString(32);
    var codeChallenge = await sha256Base64Url(codeVerifier);

    try {
      localStorage.setItem(FS_VERIFIER_KEY, codeVerifier);
      sessionStorage.setItem(FS_VERIFIER_KEY, codeVerifier);
      localStorage.setItem(FS_STATE_KEY, state);
      sessionStorage.setItem(FS_STATE_KEY, state);
      localStorage.setItem(FS_REDIRECT_KEY, redirectUri);
      sessionStorage.setItem(FS_REDIRECT_KEY, redirectUri);
    } catch (e) { }

    var params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });

    var authUrl = AUTH_URL + '?' + params.toString();

    if (usePopup && typeof window !== 'undefined' && window.open) {
      var w = 600;
      var h = 720;
      var left = Math.max(0, (window.screen.width - w) / 2);
      var top = Math.max(0, (window.screen.height - h) / 2);
      var popup = window.open(
        authUrl,
        'fs_oauth_popup',
        'width=' + w + ',height=' + h + ',top=' + top + ',left=' + left + ',menubar=no,toolbar=no,status=no'
      );
      if (popup && !popup.closed) {
        popup.focus();
        return;
      }
    }

    window.location.href = authUrl;
  }

  async function handleCallbackCode(code, state) {
    var codeVerifier = null;
    var activeRedirect = null;
    var savedState = null;
    try {
      codeVerifier = sessionStorage.getItem(FS_VERIFIER_KEY) || localStorage.getItem(FS_VERIFIER_KEY);
      activeRedirect = sessionStorage.getItem(FS_REDIRECT_KEY) || localStorage.getItem(FS_REDIRECT_KEY);
      savedState = sessionStorage.getItem(FS_STATE_KEY) || localStorage.getItem(FS_STATE_KEY);
      sessionStorage.removeItem(FS_VERIFIER_KEY);
      localStorage.removeItem(FS_VERIFIER_KEY);
      sessionStorage.removeItem(FS_STATE_KEY);
      localStorage.removeItem(FS_STATE_KEY);
      sessionStorage.removeItem(FS_REDIRECT_KEY);
      localStorage.removeItem(FS_REDIRECT_KEY);
    } catch (e) { }

    if (!codeVerifier) {
      throw new Error('Missing PKCE code verifier in session. Please sign in again.');
    }

    if (!savedState || !state || state !== savedState) {
      throw new Error('OAuth state mismatch or missing state parameter. Authentication aborted for security.');
    }

    var redirectUriToUse = activeRedirect || getRedirectUri();
    var body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: getClientId(),
      code: code,
      redirect_uri: redirectUriToUse,
      code_verifier: codeVerifier
    });

    var res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });

    if (!res.ok) {
      var err = await res.text();
      throw new Error('FamilySearch token exchange failed (' + res.status + '): ' + err);
    }

    var data = await res.json();
    var tokenData = {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
      scope: data.scope || ''
    };
    saveToken(tokenData);
    return tokenData;
  }

  async function getCurrentUser() {
    var token = getStoredToken();
    if (!token) return null;

    try {
      var res = await fetch(API_BASE + '/platform/users/current', {
        headers: {
          'Authorization': 'Bearer ' + token.accessToken,
          'Accept': 'application/json'
        }
      });
      if (res.status === 401) {
        clearToken();
        return null;
      }
      if (!res.ok) return null;
      var data = await res.json();
      var u = data && data.users && data.users[0];
      return {
        id: u ? u.id : null,
        contactName: u ? (u.contactName || u.displayName || 'FamilySearch User') : 'FamilySearch User',
        treePersonId: u ? u.personId : null
      };
    } catch (err) {
      console.warn('FamilySearch profile check failed:', err);
      return null;
    }
  }

  /**
   * Helper to parse any user date format (ISO, US M/D/YYYY, 2-digit years, European D/M/YYYY, Month Day Year, Year, Decades, Approximate dates, Holidays, etc.)
   * returns { normalized: "30 March 2003", formal: "+2003-03-30", iso: "2003-03-30", year: 2003, decade: "2000s", quality: "exact" }
   */
  function parseFamilySearchDate(input, fallbackContext) {
    if (!input && !fallbackContext) {
      return { normalized: '', formal: '', iso: '', year: null, decade: '', quality: 'none' };
    }

    var raw = String(input || '').trim();

    // If no date provided in input, try fallbackContext (e.g. filename, title, story, exif)
    if (!raw && fallbackContext) {
      var ctxStr = typeof fallbackContext === 'string' ? fallbackContext : [
        fallbackContext.filename || fallbackContext.file,
        fallbackContext.title,
        fallbackContext.story,
        fallbackContext.date,
        fallbackContext.exifDate
      ].filter(Boolean).join(' ');

      // Look for YYYY-MM-DD or YYYY_MM_DD or YYYY.MM.DD
      var m1 = ctxStr.match(/(?:^|[^0-9])(18\d{2}|19\d{2}|20\d{2})[-_:.](0[1-9]|1[0-2])[-_:.](0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/);
      if (m1) {
        raw = m1[1] + '-' + m1[2] + '-' + m1[3];
      } else {
        // Look for compact YYYYMMDD
        var m2 = ctxStr.match(/(?:^|[^0-9])(18\d{2}|19\d{2}|20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)/);
        if (m2) {
          raw = m2[1] + '-' + m2[2] + '-' + m2[3];
        } else {
          // Look for M/D/YYYY
          var m3 = ctxStr.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](18\d{2}|19\d{2}|20\d{2})(?:[^0-9]|$)/);
          if (m3) {
            raw = m3[3] + '-' + m3[1].padStart(2, '0') + '-' + m3[2].padStart(2, '0');
          } else {
            // Look for Year in context
            var mYear = ctxStr.match(/(?:^|[^0-9])(18\d{2}|19\d{2}|20\d{2})(?:[^0-9]|$)/);
            if (mYear) {
              raw = mYear[1];
            }
          }
        }
      }
    }

    if (!raw) {
      return { normalized: '', formal: '', iso: '', year: null, decade: '', quality: 'none' };
    }

    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthNames = {
      jan: 1, january: 1, janv: 1,
      feb: 2, february: 2, febr: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    var clean = raw
      .replace(/^date\s*[:=\-]\s*/i, '') // strip "Date: "
      .replace(/^taken\s*(?:on|in|at)?\s*/i, '') // strip "Taken on "
      .replace(/T\d{2}:\d{2}(?::\d{2})?.*$/, '') // strip ISO time portion "T14:30:00Z"
      .replace(/\s+\d{1,2}:\d{2}(?::\d{2})?.*$/, '') // strip time portion " 14:30:00"
      .trim();

    // Detect approximate qualifiers
    var approx = false;
    var isBefore = false;
    var isAfter = false;
    var isRange = false;
    var rangeEndYear = null;

    if (/\b(?:circa|ca\.?|c\.?|abt\.?|about|approx\.?|estimated|est\.?)\b/i.test(clean)) {
      approx = true;
      clean = clean.replace(/\b(?:circa|ca\.?|c\.?|abt\.?|about|approx\.?|estimated|est\.?)\b/gi, '').trim();
    } else if (/\b(?:before|bef\.?|prior to)\b/i.test(clean)) {
      isBefore = true;
      clean = clean.replace(/\b(?:before|bef\.?|prior to)\b/gi, '').trim();
    } else if (/\b(?:after|aft\.?|since)\b/i.test(clean)) {
      isAfter = true;
      clean = clean.replace(/\b(?:after|aft\.?|since)\b/gi, '').trim();
    } else if (/\b(?:between)\s+(\d{4})\s+(?:and|&|-)\s+(\d{4})\b/i.test(clean)) {
      var rm = clean.match(/\b(?:between)\s+(\d{4})\s+(?:and|&|-)\s+(\d{4})\b/i);
      isRange = true;
      clean = rm[1];
      rangeEndYear = parseInt(rm[2], 10);
    } else if (/^(\d{4})\s*[-–/]\s*(\d{4})$/.test(clean)) {
      var rm2 = clean.match(/^(\d{4})\s*[-–/]\s*(\d{4})$/);
      isRange = true;
      clean = rm2[1];
      rangeEndYear = parseInt(rm2[2], 10);
    }

    // Check for common holidays
    if (/\bchristmas(?:\s+day)?\b/i.test(clean)) {
      clean = clean.replace(/\bchristmas(?:\s+day)?\b/i, 'December 25').trim();
    } else if (/\b(?:new\s*year'?s?(?:\s+day)?)\b/i.test(clean)) {
      clean = clean.replace(/\b(?:new\s*year'?s?(?:\s+day)?)\b/i, 'January 1').trim();
    } else if (/\b(?:4th\s+of\s+july|july\s+4th?)\b/i.test(clean)) {
      clean = clean.replace(/\b(?:4th\s+of\s+july|july\s+4th?)\b/i, 'July 4').trim();
    } else if (/\bhalloween\b/i.test(clean)) {
      clean = clean.replace(/\bhalloween\b/i, 'October 31').trim();
    } else if (/\bthanksgiving\b/i.test(clean)) {
      clean = clean.replace(/\bthanksgiving\b/i, 'November').trim();
    } else if (/\beaster\b/i.test(clean)) {
      clean = clean.replace(/\beaster\b/i, 'April').trim();
    }

    // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.) and "of"
    clean = clean.replace(/(\d+)(?:st|nd|rd|th)\b/gi, '$1');
    clean = clean.replace(/\bof\b/gi, ' ');
    clean = clean.replace(/,/g, ' '); // replace commas with spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    // Helper to expand 2-digit year (e.g. "03" -> 2003, "74" -> 1974)
    function expand2DigitYear(yr) {
      var n = parseInt(yr, 10);
      if (isNaN(n)) return null;
      if (n >= 1000) return n;
      var cur2Digit = (new Date().getFullYear()) % 100;
      if (n <= (cur2Digit + 1)) {
        return 2000 + n;
      } else {
        return 1900 + n;
      }
    }

    var y = null, m = null, d = null;

    // Pattern 1: ISO or EXIF format: YYYY-MM-DD or YYYY:MM:DD or YYYY/MM/DD or YYYY.MM.DD
    var isoMatch = clean.match(/^([+-]?\d{4})[-/:.]([01]?\d)[-/:.]([0-3]?\d)$/);
    if (isoMatch) {
      y = parseInt(isoMatch[1], 10);
      m = parseInt(isoMatch[2], 10);
      d = parseInt(isoMatch[3], 10);
    }

    // Pattern 2: Compact 8-digit YYYYMMDD
    if (!y) {
      var compactMatch = clean.match(/^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
      if (compactMatch) {
        y = parseInt(compactMatch[1], 10);
        m = parseInt(compactMatch[2], 10);
        d = parseInt(compactMatch[3], 10);
      }
    }

    // Pattern 3: US or European numeric date: A / B / YYYY or A / B / YY
    if (!y) {
      var slashMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
      if (slashMatch) {
        var n1 = parseInt(slashMatch[1], 10);
        var n2 = parseInt(slashMatch[2], 10);
        var rawYr = slashMatch[3];
        var resolvedYr = rawYr.length === 2 ? expand2DigitYear(rawYr) : parseInt(rawYr, 10);

        // Disambiguate Month/Day vs Day/Month:
        if (n1 > 12 && n2 <= 12) {
          // Day / Month / Year (e.g. 25/03/2003)
          d = n1;
          m = n2;
          y = resolvedYr;
        } else if (n2 > 12 && n1 <= 12) {
          // Month / Day / Year (e.g. 03/25/2003)
          m = n1;
          d = n2;
          y = resolvedYr;
        } else if (n1 <= 12 && n2 <= 12) {
          // Default to US Month / Day / Year
          m = n1;
          d = n2;
          y = resolvedYr;
        }
      }
    }

    // Pattern 4: "Month Day Year" (e.g. "March 30 2003" or "Mar 30 03" or "March 30 '03")
    if (!y) {
      var wordMatch1 = clean.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s+'?(\d{2,4})$/);
      if (wordMatch1) {
        var mn1 = wordMatch1[1].toLowerCase().replace(/\./g, '');
        if (monthNames[mn1]) {
          m = monthNames[mn1];
          d = parseInt(wordMatch1[2], 10);
          var yr1 = wordMatch1[3];
          y = yr1.length === 2 ? expand2DigitYear(yr1) : parseInt(yr1, 10);
        }
      }
    }

    // Pattern 5: "Day Month Year" (e.g. "30 March 2003" or "30-Mar-2003" or "30Mar2003")
    if (!y) {
      var wordMatch2 = clean.match(/^(\d{1,2})\s*[-]?\s*([A-Za-z]+)\.?\s*[-]?\s*'?(\d{2,4})$/);
      if (wordMatch2) {
        var mn2 = wordMatch2[2].toLowerCase().replace(/\./g, '');
        if (monthNames[mn2]) {
          d = parseInt(wordMatch2[1], 10);
          m = monthNames[mn2];
          var yr2 = wordMatch2[3];
          y = yr2.length === 2 ? expand2DigitYear(yr2) : parseInt(yr2, 10);
        }
      }
    }

    // Pattern 6: "Month Year" (e.g. "March 2003" or "Mar 2003" or "March '03")
    if (!y) {
      var wordMatch3 = clean.match(/^([A-Za-z]+)\.?\s+'?(\d{2,4})$/);
      if (wordMatch3) {
        var mn3 = wordMatch3[1].toLowerCase().replace(/\./g, '');
        if (monthNames[mn3]) {
          m = monthNames[mn3];
          var yr3 = wordMatch3[2];
          y = yr3.length === 2 ? expand2DigitYear(yr3) : parseInt(yr3, 10);
        }
      }
    }

    // Pattern 7: Numeric "Month/Year" (e.g. "03/2003" or "3-2003")
    if (!y) {
      var monthYrNum = clean.match(/^([01]?\d)[-/.](\d{4})$/);
      if (monthYrNum) {
        var possibleM = parseInt(monthYrNum[1], 10);
        if (possibleM >= 1 && possibleM <= 12) {
          m = possibleM;
          y = parseInt(monthYrNum[2], 10);
        }
      }
    }

    // Pattern 8: Decade (e.g. "1980s", "1980's", "80s", "'80s")
    if (!y) {
      var decadeMatch = clean.match(/^'?(\d{2,4})'?[sS]$/);
      if (decadeMatch) {
        var decYr = decadeMatch[1];
        if (decYr.length === 2) decYr = String(expand2DigitYear(decYr));
        var decNum = parseInt(decYr, 10);
        if (!isNaN(decNum)) {
          var baseDec = Math.floor(decNum / 10) * 10;
          return {
            normalized: baseDec + 's',
            formal: '+' + baseDec + '/+' + (baseDec + 9),
            iso: String(baseDec),
            year: baseDec,
            decade: baseDec + 's',
            quality: 'decade'
          };
        }
      }
    }

    // Pattern 9: Standalone 4-digit Year (e.g. "2003", "1974") or 2-digit with quote "'03"
    if (!y) {
      var standaloneYr = clean.match(/^(?:'|\b)(18\d{2}|19\d{2}|20\d{2})\b/);
      if (standaloneYr) {
        y = parseInt(standaloneYr[1], 10);
      } else {
        var standalone2Digit = clean.match(/^'(\d{2})$/);
        if (standalone2Digit) {
          y = expand2DigitYear(standalone2Digit[1]);
        }
      }
    }

    // Pattern 10: General text search for year in messy string (e.g. "Lake trip in summer 1968")
    if (!y) {
      var embeddedYear = clean.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
      if (embeddedYear) {
        y = parseInt(embeddedYear[1], 10);
        for (var k in monthNames) {
          var reK = new RegExp('\\b' + k + '\\b', 'i');
          if (reK.test(clean)) {
            m = monthNames[k];
            break;
          }
        }
      }
    }

    // Validate year range
    if (y && (y < 1700 || y > 2099)) {
      y = null;
    }

    if (y) {
      if (m && (m < 1 || m > 12)) m = null;
      if (d && (d < 1 || d > 31)) d = null;

      var decadeStr = Math.floor(y / 10) * 10 + 's';
      var norm = '';
      var formal = '';
      var iso = '';

      if (m && d) {
        var padM = String(m).padStart(2, '0');
        var padD = String(d).padStart(2, '0');
        iso = y + '-' + padM + '-' + padD;
        norm = d + ' ' + months[m - 1] + ' ' + y;
        formal = '+' + iso;
      } else if (m) {
        var padM2 = String(m).padStart(2, '0');
        iso = y + '-' + padM2;
        norm = months[m - 1] + ' ' + y;
        formal = '+' + iso;
      } else {
        iso = String(y);
        norm = String(y);
        formal = '+' + y;
      }

      // Apply qualifiers if present
      if (approx) {
        norm = 'about ' + norm;
        formal = 'A' + formal;
      } else if (isBefore) {
        norm = 'before ' + norm;
        formal = '/' + formal;
      } else if (isAfter) {
        norm = 'after ' + norm;
        formal = formal + '/';
      } else if (isRange && rangeEndYear) {
        norm = 'between ' + y + ' and ' + rangeEndYear;
        formal = '+' + y + '/+' + rangeEndYear;
      }

      return {
        normalized: norm,
        formal: formal,
        iso: iso,
        year: y,
        decade: decadeStr,
        quality: (m && d) ? 'exact' : (m ? 'month' : 'year')
      };
    }

    return {
      normalized: raw,
      formal: '',
      iso: raw,
      year: null,
      decade: '',
      quality: 'unparsed'
    };
  }

  /**
   * Helper to convert ISO or text date into FamilySearch normalized date string (e.g. "30 March 2003")
   */
  function formatNormalizedDate(iso, fallbackContext) {
    if (!iso && !fallbackContext) return '';
    var parsed = parseFamilySearchDate(iso, fallbackContext);
    return parsed.normalized || String(iso).trim();
  }

  /**
   * Verifies that a FamilySearch Memory ID actually exists and has not been deleted/tombstoned.
   */
  async function checkMemoryExists(memoryId, tokenOpt) {
    if (!memoryId || String(memoryId).indexOf('mem_') === 0) return false;
    var token = tokenOpt || getStoredToken();
    if (!token || !token.accessToken) return false;

    try {
      var res = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': 'Bearer ' + token.accessToken,
          'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
        }
      });
      if (!res.ok || res.status === 204 || res.status === 404 || res.status === 410) {
        return false;
      }
      var entityState = (res.headers.get('X-entity-state') || res.headers.get('Warning') || '').toLowerCase();
      if (entityState.indexOf('deleted') !== -1 || entityState.indexOf('deprecated') !== -1) {
        return false;
      }
      var data = await res.json();
      if (!data || !Array.isArray(data.sourceDescriptions) || data.sourceDescriptions.length === 0) {
        return false;
      }
      var sd = data.sourceDescriptions[0];
      if (!sd || sd.resourceType === 'http://gedcomx.org/Deleted') {
        return false;
      }
      if (sd.identifiers && sd.identifiers['http://familysearch.org/v1/Deleted']) {
        return false;
      }
      // Check if artifact screening or deletion state makes it unloadable
      if (sd.Status === 'DELETED' || sd.status === 'deleted') {
        return false;
      }
      return true;
    } catch (e) {
      console.warn('FamilySearch checkMemoryExists error:', e);
      return false;
    }
  }

  /**
   * Produces a fresh JPEG blob with an imperceptible 1-level corner pixel adjustment
   * so FamilySearch's SHA-256 deduplicator issues a brand-new 201 Created Memory ID
   * instead of returning HTTP 409 pointing to a previously deleted/tombstoned memory.
   */
  async function createFreshUploadBlob(blob) {
    if (!blob || typeof document === 'undefined') return blob;
    return new Promise(function (resolve) {
      var img = new Image();
      var objUrl = URL.createObjectURL(blob);
      img.onload = function () {
        URL.revokeObjectURL(objUrl);
        try {
          var w = img.naturalWidth || img.width || 800;
          var h = img.naturalHeight || img.height || 600;
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // Imperceptibly nudge 2 corner pixels so the compressed JPEG has a unique hash
          var patchW = Math.min(2, w);
          var patchData = ctx.getImageData(w - patchW, h - 1, patchW, 1);
          var d = patchData.data;
          var delta = (Date.now() % 3) + 1;
          for (var i = 0; i < d.length; i += 4) {
            d[i] = d[i] < 245 ? d[i] + delta : d[i] - delta;
            d[i + 1] = d[i + 1] < 245 ? d[i + 1] + 1 : d[i + 1] - 1;
          }
          ctx.putImageData(patchData, w - patchW, h - 1);
          canvas.toBlob(function (newBlob) {
            resolve(newBlob || blob);
          }, 'image/jpeg', 0.95);
        } catch (err) {
          resolve(blob);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(objUrl);
        resolve(blob);
      };
      img.src = objUrl;
    });
  }

  /**
   * Resolves the real numeric FamilySearch Memory ID if a photo was already uploaded (e.g. on 409 Conflict)
   */
  async function resolveExistingMemoryId(targetPersonId, title, filename, token) {
    var cleanTitle = (title || '').trim().toLowerCase();
    var pidMatch = String(targetPersonId || '').match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
    var singlePid = pidMatch ? pidMatch[0].toUpperCase() : '';

    // 1. Check target person's attached memories
    if (singlePid) {
      try {
        var pRes = await fetch(API_BASE + '/platform/tree/persons/' + encodeURIComponent(singlePid) + '/memories', {
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
          }
        });
        if (pRes.ok && pRes.status !== 204) {
          var pJson = await pRes.json();
          var sds = pJson.sourceDescriptions || [];
          if (sds.length > 0) {
            var matched = sds.find(function (sd) {
              var t = (sd.titles && sd.titles[0] && sd.titles[0].value) || '';
              var ab = sd.about || '';
              return (cleanTitle && t.trim().toLowerCase() === cleanTitle) ||
                (filename && ab.includes(filename));
            });
            if (matched) {
              var memIdFromAbout = (matched.about && matched.about.indexOf('/memories/') !== -1)
                ? matched.about.replace(/\/+$/, '').split('/').pop()
                : null;
              var chosenId = memIdFromAbout || (matched.id ? String(matched.id) : null);
              if (chosenId && chosenId.indexOf('SD-') !== -1 && memIdFromAbout) {
                chosenId = memIdFromAbout;
              }
              if (chosenId) return chosenId;
            }
          }
        }
      } catch (e) {
        console.warn('Could not query person memories for ID resolution:', e);
      }
    }

    // 2. Check current user's memories list
    try {
      var uRes = await fetch(API_BASE + '/platform/memories/users/current/memories', {
        headers: {
          'Authorization': 'Bearer ' + token.accessToken,
          'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
        }
      });
      if (uRes.ok && uRes.status !== 204) {
        var uJson = await uRes.json();
        var uSds = uJson.sourceDescriptions || [];
        if (uSds.length > 0) {
          var uMatched = uSds.find(function (sd) {
            var t = (sd.titles && sd.titles[0] && sd.titles[0].value) || '';
            var ab = sd.about || '';
            return (cleanTitle && t.trim().toLowerCase() === cleanTitle) ||
              (filename && ab.includes(filename));
          });
          if (uMatched) {
            var uMemIdFromAbout = (uMatched.about && uMatched.about.indexOf('/memories/') !== -1)
              ? uMatched.about.replace(/\/+$/, '').split('/').pop()
              : null;
            var uChosenId = uMemIdFromAbout || (uMatched.id ? String(uMatched.id) : null);
            if (uChosenId && uChosenId.indexOf('SD-') !== -1 && uMemIdFromAbout) {
              uChosenId = uMemIdFromAbout;
            }
            if (uChosenId) return uChosenId;
          }
        }
      }
    } catch (uErr) {
      console.warn('Could not query user memories for ID resolution:', uErr);
    }

    return null;
  }

  /**
   * Resolves authoritative Place Description link via FamilySearch Places Search API
   */
  async function resolvePlaceDescription(placeText, token, fallbackStory, photoLat, photoLng) {
    if ((!placeText && !fallbackStory && typeof photoLat !== 'number') || !token) return null;
    try {
      var candidates = [];
      function addCandidate(s) {
        if (!s) return;
        var t = String(s).trim();
        if (t && candidates.indexOf(t) === -1) {
          candidates.push(t);
        }
      }

      var combined = [placeText, fallbackStory].filter(Boolean).join(' ; ');

      // 1. High-confidence Bowling Green / Wood County detection from user's family collection
      if (/bowling\s+green/i.test(combined)) {
        addCandidate('Bowling Green, Wood, Ohio');
        addCandidate('Bowling Green, OH');
      }

      // 2. Wooster, OH detection
      if (/wooster/i.test(combined)) {
        addCandidate('Wooster, Wayne, Ohio');
        addCandidate('Wooster, OH');
      }

      // 3. Extract City, State abbreviations (e.g. "Bowling Green, OH")
      var csMatches = combined.matchAll(/([A-Z][a-zA-Z\s.-]+?),\s*([A-Z]{2})\b/g);
      for (var m of csMatches) {
        var rawCity = m[1].replace(/.*?(?:lot\s*#?\d+|rd|road|street|st|ave|avenue|dr|drive|lane|ln|blvd|way)\s*,?\s*/i, '')
          .replace(/^\d+[^,]*?,?\s*/, '')
          .trim();
        if (rawCity.length >= 3 && !/fireplace|home|house|church/i.test(rawCity)) {
          addCandidate(rawCity + ', ' + m[2]);
        }
      }

      // 4. Clean placeText query: strip street address, lot numbers, and postal codes
      if (placeText) {
        var parts = placeText.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (parts.length >= 2) {
          addCandidate(parts.slice(-2).join(', '));
        }
        var cleaned = placeText.replace(/^\d+[^,]+,\s*/, '')
          .replace(/lot\s*#?\d+,?\s*/i, '')
          .replace(/\s+\d{5}(-\d{4})?$/, '')
          .trim();
        if (cleaned && cleaned !== placeText) {
          addCandidate(cleaned);
        }
        addCandidate(placeText);
      }

      // 5. GPS coordinate check near Bowling Green (41.37, -83.65)
      if (typeof photoLat === 'number' && typeof photoLng === 'number') {
        if (Math.abs(photoLat - 41.37) < 0.5 && Math.abs(photoLng - (-83.65)) < 0.5) {
          addCandidate('Bowling Green, Wood, Ohio');
        }
      }

      var authHeader = {
        'Authorization': 'Bearer ' + token.accessToken,
        'Accept': 'application/x-gedcomx-atom+json, application/json'
      };

      for (var cIdx = 0; cIdx < candidates.length; cIdx++) {
        var c = candidates[cIdx];
        var searchQueries = [
          'name:' + encodeURIComponent('"' + c + '"'),
          'name:' + encodeURIComponent(c),
          encodeURIComponent(c)
        ];

        for (var qIdx = 0; qIdx < searchQueries.length; qIdx++) {
          var pSearchUrl = API_BASE + '/platform/places/search?q=' + searchQueries[qIdx];
          var pRes = await fetch(pSearchUrl, { headers: authHeader });
          if (pRes.ok) {
            var pData = await pRes.json();
            var entries = pData.entries || [];
            if (entries.length > 0 && entries[0].content && entries[0].content.gedcomx && entries[0].content.gedcomx.places) {
              var matchedPlace = entries[0].content.gedcomx.places[0];
              var rawDescHref = (matchedPlace.links && matchedPlace.links.description && matchedPlace.links.description.href)
                ? matchedPlace.links.description.href
                : (matchedPlace.id ? (API_BASE + '/platform/places/description/' + matchedPlace.id) : null);

              // Strip query params like ?flag=fsh from place description URI for standard GEDCOM X compliance
              var descHref = rawDescHref ? rawDescHref.replace(/\?.*$/, '') : null;

              var fullName = (matchedPlace.display && matchedPlace.display.fullName)
                ? matchedPlace.display.fullName
                : (matchedPlace.names && matchedPlace.names[0] ? matchedPlace.names[0].value : null);
              return {
                id: matchedPlace.id,
                descriptionUrl: descHref,
                fullName: fullName
              };
            }
          }
        }
      }
    } catch (placeErr) {
      console.warn('Place description resolution notice:', placeErr);
    }
    return null;
  }

  function isNameMatch(a, b) {
    if (!a || !b) return false;
    var s1 = a.trim().toLowerCase();
    var s2 = b.trim().toLowerCase();
    if (s1 === s2) return true;
    if (s1.indexOf(s2) !== -1 || s2.indexOf(s1) !== -1) return true;
    var p1 = s1.split(/\s+/).filter(Boolean);
    var p2 = s2.split(/\s+/).filter(Boolean);
    if (p1.length >= 2 && p2.length >= 2) {
      if (p1[0] === p2[0] && p1[p1.length - 1] === p2[p2.length - 1]) return true;
    }
    if (typeof KNOWN_FAMILY !== 'undefined' && Array.isArray(KNOWN_FAMILY)) {
      var k1 = KNOWN_FAMILY.find(function (k) {
        return (k.name && k.name.toLowerCase() === s1) || (k.aliases && k.aliases.includes(s1));
      });
      var k2 = KNOWN_FAMILY.find(function (k) {
        return (k.name && k.name.toLowerCase() === s2) || (k.aliases && k.aliases.includes(s2));
      });
      if (k1 && k2 && k1.id === k2.id) return true;
    }
    return false;
  }

  function isPidValidForPersonName(pid, personName) {
    if (!pid || !personName) return false;
    var cleanPid = String(pid).trim().toUpperCase();
    if (!/^[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}$/.test(cleanPid)) return false;
    var pLower = String(personName).trim().toLowerCase();
    if (!pLower || /^face\s*#?\d+/i.test(pLower) || /^unidentified/i.test(pLower)) return false;

    // Check against KNOWN_FAMILY
    if (typeof KNOWN_FAMILY !== 'undefined' && Array.isArray(KNOWN_FAMILY)) {
      var kf = KNOWN_FAMILY.find(function (k) { return k.id && k.id.toUpperCase() === cleanPid; });
      if (kf) {
        var kName = (kf.name || '').toLowerCase();
        var kGiven = kName.split(/\s+/)[0] || '';
        var pGiven = pLower.split(/\s+/)[0] || '';
        var kAliases = (kf.aliases || []).map(function (a) { return a.toLowerCase(); });
        var match = (kName === pLower) ||
          (kAliases.indexOf(pLower) !== -1) ||
          (kAliases.indexOf(pGiven) !== -1) ||
          (kGiven && pGiven && (kGiven === pGiven || kGiven.startsWith(pGiven) || pGiven.startsWith(kGiven)));
        if (!match) return false; // Known PID strictly belongs to someone else!
      }
    }
    return true;
  }

  /**
   * Upload an image to FamilySearch Beta Memories, link to Person, and attach persona tags
   */
  async function uploadMemory(options) {
    var token = getStoredToken();
    if (!token) {
      throw new Error('Not signed in to FamilySearch. Please click Sign In first.');
    }

    var photo = options.photo || {};
    var imageBlob = options.imageBlob;
    if (!imageBlob) {
      throw new Error('No image data available for upload.');
    }

    var title = options.title || photo.title || 'Family Memory';
    var story = options.story || photo.story || '';
    var isoDate = options.isoDate || photo.isoDate || '';
    var place = options.place || photo.place || '';
    var people = options.people || photo.people || [];
    var rawTargetIds = (options.targetPersonId || photo.fsId || '').trim().toUpperCase();
    var firstPidMatch = rawTargetIds.match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
    var targetPersonId = firstPidMatch ? firstPidMatch[0].toUpperCase() : '';
    var onProgress = options.onProgress || function () { };

    onProgress({ step: 'preparing', message: 'Preparing photo artifact for FamilySearch...' });

    // If replacing older copy requested, delete prior memory from FamilySearch first
    // and refresh image blob hash so FamilySearch creates a live 201 Created memory
    if (options.replaceMemoryId) {
      onProgress({ step: 'replacing', message: 'Removing older copy (Memory #' + options.replaceMemoryId + ') from FamilySearch...' });
      try {
        await deleteMemory(options.replaceMemoryId);
      } catch (delErr) {
        console.warn('Could not delete old memory before replace:', delErr);
      }
      imageBlob = await createFreshUploadBlob(imageBlob);
    }

    // Parse date into ISO, normalized (e.g. "30 March 2003"), and formal (e.g. "+2003-03-30")
    var dateInfo = parseFamilySearchDate(isoDate || photo.date || '', photo);
    var normalizedDate = dateInfo.normalized;
    var formalDate = dateInfo.formal;
    var effectiveIso = dateInfo.iso || isoDate;

    // Resolve authoritative Place Description and canonical place name
    var placeInfo = await resolvePlaceDescription(place, token, story, photo.lat, photo.lng);
    var placeDescUrl = placeInfo ? placeInfo.descriptionUrl : null;
    var effectivePlaceName = (placeInfo && placeInfo.fullName) ? placeInfo.fullName : (place || '');

    // Format rich descriptive summary for FamilySearch Memories description
    var descLines = [];
    if (story) descLines.push(story);
    if (normalizedDate || isoDate) descLines.push('Date: ' + (normalizedDate || isoDate));
    if (effectivePlaceName) descLines.push('Location: ' + effectivePlaceName);
    if (people && people.length > 0) {
      var names = people.map(function (p) {
        return typeof p === 'string' ? p : (p.name + (p.rel ? ' (' + p.rel + ')' : ''));
      });
      descLines.push('People: ' + names.join(', '));
    }
    descLines.push('Preserved with Family History Photos');
    var fullDescription = descLines.join('\n\n');

    // Build filename
    var cleanSlug = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    var filename = (effectiveIso ? effectiveIso + '_' : '') + (cleanSlug || 'family_memory') + '.jpg';

    // 1. Determine upload endpoint
    var uploadUrl = API_BASE + '/platform/memories/memories';
    var qParams = [];
    if (title) qParams.push('title=' + encodeURIComponent(title));
    if (fullDescription) qParams.push('description=' + encodeURIComponent(fullDescription));
    if (normalizedDate) {
      qParams.push('date=' + encodeURIComponent(normalizedDate));
      qParams.push('coverageDate=' + encodeURIComponent(normalizedDate));
    }
    if (effectivePlaceName) {
      qParams.push('place=' + encodeURIComponent(effectivePlaceName));
      qParams.push('coveragePlace=' + encodeURIComponent(effectivePlaceName));
    }
    if (qParams.length > 0) {
      uploadUrl += '?' + qParams.join('&');
    }

    function buildUploadFormData(blobToSend) {
      var fd = new FormData();
      fd.append('artifact', blobToSend, filename);
      fd.append('title', title);
      if (fullDescription) {
        fd.append('description', fullDescription);
      }
      if (normalizedDate) {
        fd.append('date', normalizedDate);
        fd.append('coverageDate', normalizedDate);
        fd.append('temporal', normalizedDate);
      }
      if (effectivePlaceName) {
        fd.append('place', effectivePlaceName);
        fd.append('coveragePlace', effectivePlaceName);
        fd.append('spatial', effectivePlaceName);
      }
      return fd;
    }

    onProgress({ step: 'uploading', message: 'Uploading photo to FamilySearch Beta Memories...' });

    var uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token.accessToken,
        'Accept': 'application/json'
      },
      body: buildUploadFormData(imageBlob)
    });

    var memoryId = null;

    if (!uploadRes.ok) {
      if (uploadRes.status === 409) {
        // Conflict - memory hash seen on FamilySearch before; verify it wasn't deleted!
        onProgress({ step: 'conflict', message: 'Checking existing FamilySearch memory record...' });
        var loc = uploadRes.headers.get('Location') || '';
        var xId = uploadRes.headers.get('X-entity-id') || '';
        var candidateId = xId || (loc ? loc.replace(/\/+$/, '').split('/').pop() : null) || options.memoryId;
        if (candidateId && String(candidateId).indexOf('mem_') === 0) candidateId = null;

        if (!candidateId) {
          candidateId = await resolveExistingMemoryId(targetPersonId, title, filename, token);
        }

        var isMemoryAlive = candidateId ? await checkMemoryExists(candidateId, token) : false;

        if (candidateId && isMemoryAlive) {
          memoryId = candidateId;
        } else {
          // Previous upload was deleted on FamilySearch (tombstoned SHA-256)!
          // Upload a fresh JPEG blob so FamilySearch issues a brand-new working Memory ID.
          onProgress({ step: 'recreating', message: 'Previous memory was removed on FamilySearch. Uploading fresh photo record...' });
          var freshBlob = await createFreshUploadBlob(imageBlob);
          imageBlob = freshBlob;
          var retryRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Accept': 'application/json'
            },
            body: buildUploadFormData(freshBlob)
          });
          if (retryRes.ok) {
            var rLoc = retryRes.headers.get('Location') || '';
            var rXId = retryRes.headers.get('X-entity-id') || '';
            memoryId = rXId || (rLoc ? rLoc.replace(/\/+$/, '').split('/').pop() : null);
          } else {
            var rErrText = await retryRes.text();
            throw new Error('FamilySearch fresh re-upload failed (' + retryRes.status + '): ' + rErrText);
          }
        }
      } else if (targetPersonId && (uploadRes.status === 404 || uploadRes.status === 400 || uploadRes.status === 405 || uploadRes.status === 415)) {
        // Fallback attempt to person memories endpoint if universal rejected
        onProgress({ step: 'fallback', message: 'Posting to Person Memories endpoint...' });
        var personUrl = API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId) + '/memories';
        var personRes = await fetch(personUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/json'
          },
          body: buildUploadFormData(imageBlob)
        });
        if (!personRes.ok && personRes.status !== 409) {
          var pErr = await personRes.text();
          throw new Error('FamilySearch upload failed (' + personRes.status + '): ' + pErr);
        }
        var pLoc = personRes.headers.get('Location') || '';
        var pXId = personRes.headers.get('X-entity-id') || '';
        memoryId = pXId || (pLoc ? pLoc.replace(/\/+$/, '').split('/').pop() : null);
      } else {
        var errText = await uploadRes.text();
        throw new Error('FamilySearch upload failed (' + uploadRes.status + '): ' + errText);
      }
    } else {
      var resLoc = uploadRes.headers.get('Location') || '';
      var resXId = uploadRes.headers.get('X-entity-id') || '';
      memoryId = resXId || (resLoc ? resLoc.replace(/\/+$/, '').split('/').pop() : null);
    }

    if (!memoryId && targetPersonId) {
      memoryId = await resolveExistingMemoryId(targetPersonId, title, filename, token);
    }

    if (!memoryId || String(memoryId).indexOf('mem_') === 0) {
      throw new Error('FamilySearch did not return a valid Memory ID. Please try syncing again.');
    }

    // 1b. Update Memory Date & Place Coverage metadata
    if (memoryId && (normalizedDate || effectivePlaceName)) {
      onProgress({ step: 'coverage', message: 'Saving memory Date (' + (normalizedDate || 'N/A') + ') and Place (' + (effectivePlaceName || 'N/A') + ') to FamilySearch...' });
      try {
        // Build cleanly typed GEDCOM X Coverage entries
        var covClean = {};
        if (normalizedDate) {
          covClean.temporal = {
            original: normalizedDate
          };
          if (formalDate) {
            covClean.temporal.formal = formalDate;
          }
        }
        if (effectivePlaceName) {
          covClean.spatial = {
            original: effectivePlaceName
          };
          if (placeDescUrl) {
            covClean.spatial.description = placeDescUrl;
          }
        }

        var covWithNormalized = {};
        if (normalizedDate) {
          covWithNormalized.temporal = {
            original: normalizedDate,
            normalized: [{ value: normalizedDate }]
          };
          if (formalDate) {
            covWithNormalized.temporal.formal = formalDate;
          }
        }
        if (effectivePlaceName) {
          covWithNormalized.spatial = {
            original: effectivePlaceName
          };
          if (placeDescUrl) {
            covWithNormalized.spatial.description = placeDescUrl;
          }
          if (placeInfo && placeInfo.fullName) {
            covWithNormalized.spatial.normalized = [{ value: placeInfo.fullName }];
          }
        }

        var covMinimal = {};
        if (normalizedDate) {
          covMinimal.temporal = { original: normalizedDate };
        }
        if (effectivePlaceName) {
          covMinimal.spatial = { original: effectivePlaceName };
        }

        // Query live source description from FamilySearch to inspect links and artifact references
        var liveSd = null;
        var coverageHref = null;
        var artifactHref = null;
        try {
          var memRes = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
            }
          });
          if (memRes.ok) {
            var memData = await memRes.json();
            if (memData && memData.sourceDescriptions && memData.sourceDescriptions[0]) {
              liveSd = memData.sourceDescriptions[0];
              if (liveSd.links) {
                if (liveSd.links.coverage && liveSd.links.coverage.href) coverageHref = liveSd.links.coverage.href;
                if (liveSd.links.artifact && liveSd.links.artifact.href) artifactHref = liveSd.links.artifact.href;
              }
            }
          }
        } catch (getErr) {
          console.warn('Could not read existing memory description:', getErr);
        }

        var targetSdId = (liveSd && liveSd.id) || memoryId;
        var memoryAbout = (liveSd && liveSd.about) || (API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId));

        // Target endpoints: non-destructive POST to SourceDescription first, then dedicated coverage sub-resources
        var targetEndpoints = [];
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), isCoverageOnly: false });
        if (coverageHref) targetEndpoints.push({ url: coverageHref, isCoverageOnly: true });
        if (artifactHref) {
          targetEndpoints.push({ url: artifactHref + '/coverage', isCoverageOnly: true });
        }
        targetEndpoints.push({ url: API_BASE + '/platform/memories/artifacts/' + encodeURIComponent(memoryId) + '/description', isCoverageOnly: false });

        var coverageSaved = false;

        // Dispatch coverage updates cleanly via POST (never partial PUT on memory container)
        for (var tIdx = 0; tIdx < targetEndpoints.length; tIdx++) {
          var target = targetEndpoints[tIdx];
          var epUrl = target.url;
          var payloads = [];

          if (target.isCoverageOnly) {
            var covVariants = [covClean, covWithNormalized, covMinimal];
            for (var cvIdx = 0; cvIdx < covVariants.length; cvIdx++) {
              var cv = covVariants[cvIdx];
              payloads.push({ method: 'POST', body: { coverage: [cv] } });
              payloads.push({ method: 'POST', body: [cv] });
            }
          } else {
            var covVariants2 = [covClean, covWithNormalized, covMinimal];
            for (var cv2Idx = 0; cv2Idx < covVariants2.length; cv2Idx++) {
              var cv2 = covVariants2[cv2Idx];
              payloads.push({
                method: 'POST',
                body: {
                  sourceDescriptions: [{
                    id: targetSdId,
                    about: memoryAbout,
                    titles: title ? [{ value: title }] : undefined,
                    descriptions: fullDescription ? [{ value: fullDescription }] : undefined,
                    coverage: [cv2]
                  }]
                }
              });
            }
          }

          for (var pIdx = 0; pIdx < payloads.length; pIdx++) {
            var item = payloads[pIdx];
            var contentTypes = ['application/x-fs-v1+json', 'application/x-gedcomx-v1+json'];
            for (var cIdx = 0; cIdx < contentTypes.length; cIdx++) {
              var cType = contentTypes[cIdx];
              try {
                var pRes = await fetch(epUrl, {
                  method: item.method,
                  headers: {
                    'Authorization': 'Bearer ' + token.accessToken,
                    'Content-Type': cType,
                    'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
                  },
                  body: JSON.stringify(item.body)
                });
                if (pRes.ok) {
                  coverageSaved = true;
                  break;
                }
              } catch (pErr) {
                console.warn('FS coverage dispatch error:', pErr);
              }
            }
            if (coverageSaved) break;
          }
          if (coverageSaved) break;
        }
        if (coverageSaved) {
          onProgress({ step: 'coverage', message: 'Memory Date & Place coverage saved to FamilySearch.' });
        }
      } catch (covErr) {
        console.warn('Memory coverage date/place update notice:', covErr);
      }
    }

    // 2. Auto-scan faces if not yet scanned
    var faces = options.faces || (photo && photo.faces) || [];
    if ((!faces || faces.length === 0) && typeof window !== 'undefined' && window.FaceDetectorEngine) {
      try {
        onProgress({ step: 'faces', message: 'Detecting & recognizing faces on photo for FamilySearch tags...' });
        faces = await window.FaceDetectorEngine.detectFaces(imageBlob || (photo && photo.file));
        if (faces && faces.length > 0 && typeof window.FaceDetectorEngine.recognizeFaces === 'function') {
          await window.FaceDetectorEngine.recognizeFaces(imageBlob || (photo && photo.file), faces, people);
        }
        if (photo && faces && faces.length > 0) {
          photo.faces = faces;
        }
      } catch (scanErr) {
        console.warn('Auto face scan notice:', scanErr);
      }
    }

    // 3. Query any existing personas on this memory artifact
    var existingPersonas = [];
    if (memoryId) {
      try {
        var listRes = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/personas?includeTreeIdentifier=true', {
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
          }
        });
        if (listRes.ok) {
          var listJson = await listRes.json();
          if (listJson && listJson.persons) {
            existingPersonas = listJson.persons;
          }
        }
      } catch (listErr) {
        console.warn('Could not list existing personas on memory:', listErr);
      }
    }

    // 4. Attach Persona tags to the memory with face bounding box coordinates & link Tree persons
    var linkedPersonas = [];
    var tagTargets = [];
    var seenTargetNames = new Set();

    // A. Add all faces that have names or box coordinates (matching fsId strictly by person name, NEVER array index!)
    if (faces && faces.length > 0) {
      faces.forEach(function (f, fIdx) {
        var fName = (f.name || '').trim();
        if (!fName && faces.length === 1 && people && people.length === 1) {
          fName = (typeof people[0] === 'string' ? people[0] : people[0].name || '').trim();
        }
        if (fName) {
          var matchedPersonObj = (people || []).find(function (pRel) {
            var pRelName = typeof pRel === 'string' ? pRel : (pRel && pRel.name ? pRel.name : '');
            return isNameMatch(pRelName, fName);
          });
          var matchedPersonFsId = (matchedPersonObj && typeof matchedPersonObj === 'object' && matchedPersonObj.fsId)
            ? matchedPersonObj.fsId
            : null;

          tagTargets.push({
            name: fName,
            fsId: f.fsId || matchedPersonFsId || null,
            box: f.box || (f.left !== undefined ? f : null),
            faceIdx: fIdx
          });
          seenTargetNames.add(fName.toLowerCase());
        }
      });
    }

    // B. Add any relatives from the people list who aren't already represented in tagTargets
    if (people && people.length > 0) {
      people.forEach(function (pRel) {
        var pName = (typeof pRel === 'string' ? pRel : pRel.name || '').trim();
        if (!pName) return;
        var existing = tagTargets.find(function (t) {
          return isNameMatch(t.name, pName);
        });
        if (!existing) {
          tagTargets.push({
            name: pName,
            fsId: (typeof pRel === 'object' ? pRel.fsId : null) || null,
            box: null,
            faceIdx: -1
          });
          seenTargetNames.add(pName.toLowerCase());
        } else if (!existing.fsId && typeof pRel === 'object' && pRel.fsId) {
          existing.fsId = pRel.fsId;
        }
      });
    }

    // C. Fallback: if no faces and no people, but targetPersonId is provided
    if (tagTargets.length === 0 && targetPersonId) {
      tagTargets.push({
        name: title || 'Relative',
        fsId: targetPersonId,
        box: (faces && faces.length === 1 && (faces[0].box || faces[0])) || null,
        faceIdx: (faces && faces.length === 1) ? 0 : -1
      });
    }

    if (memoryId && tagTargets.length > 0) {
      var claimedPersonaIds = new Set();
      onProgress({ step: 'tagging', message: 'Tagging ' + tagTargets.length + ' relative(s) and face positions on FamilySearch memory...' });

      // Strict PID verification & photo uniqueness:
      // A FamilyTree PID can only belong to ONE person in a single photo.
      // If a PID's given name does not match the person's given name, discard the PID and upload as a named persona.
      var claimedPidsInPhoto = new Map();
      tagTargets.forEach(function (tgt) {
        var tName = (tgt.name || '').trim();
        var rawPid = tgt.fsId ? String(tgt.fsId).trim().toUpperCase() : null;
        var directMatch = rawPid ? rawPid.match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/) : null;
        var candPid = directMatch ? directMatch[0] : null;

        if (candPid) {
          if (!isPidValidForPersonName(candPid, tName)) {
            console.warn('[FamilySearch] Stripping mismatched PID ' + candPid + ' from "' + tName + '" — persona will be tagged with real name without wrong tree link');
            candPid = null;
            tgt.fsId = null;
          } else if (claimedPidsInPhoto.has(candPid) && claimedPidsInPhoto.get(candPid).toLowerCase() !== tName.toLowerCase()) {
            console.warn('[FamilySearch] Stripping duplicate PID ' + candPid + ' from second relative "' + tName + '" (already linked to "' + claimedPidsInPhoto.get(candPid) + '")');
            candPid = null;
            tgt.fsId = null;
          } else {
            claimedPidsInPhoto.set(candPid, tName);
          }
        }
        tgt.validatedPid = candPid;
      });

      for (var tIdx2 = 0; tIdx2 < tagTargets.length; tIdx2++) {
        var target = tagTargets[tIdx2];
        var personName = target.name;
        if (!personName) continue;

        var personPid = target.validatedPid || null;
        if (!personPid && target.fsId) {
          var directPidMatch = String(target.fsId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
          if (directPidMatch && isPidValidForPersonName(directPidMatch[0], personName)) {
            var dpMatch = directPidMatch[0].toUpperCase();
            if (!claimedPidsInPhoto.has(dpMatch) || claimedPidsInPhoto.get(dpMatch).toLowerCase() === personName.toLowerCase()) {
              personPid = dpMatch;
              claimedPidsInPhoto.set(personPid, personName);
            }
          }
        }

        if (!personPid) {
          var kfMatches = rankMatches(KNOWN_FAMILY, personName);
          if (kfMatches && kfMatches.length > 0) {
            var cand = kfMatches[0];
            var candLower = (cand.name || '').toLowerCase();
            var targetLower = personName.toLowerCase();
            var cGiven = candLower.split(/\s+/)[0] || '';
            var tGiven = targetLower.split(/\s+/)[0] || '';
            // Strictly check given name AND surname/alias match - NEVER attach someone solely by surname!
            var candPid = cand.id.toUpperCase();
            if (isPidValidForPersonName(candPid, personName) && (!claimedPidsInPhoto.has(candPid) || claimedPidsInPhoto.get(candPid).toLowerCase() === personName.toLowerCase())) {
              if (candLower === targetLower || (cand.aliases && cand.aliases.includes(targetLower))) {
                personPid = candPid;
                claimedPidsInPhoto.set(personPid, personName);
              } else if (cGiven && tGiven && (cGiven === tGiven || cGiven.startsWith(tGiven) || tGiven.startsWith(cGiven))) {
                if (isNameMatch(candLower, targetLower)) {
                  personPid = candPid;
                  claimedPidsInPhoto.set(personPid, personName);
                }
              }
            }
          }
        }

        if (!personPid && targetPersonId && tagTargets.length === 1) {
          var targetPidMatch = String(targetPersonId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
          if (targetPidMatch && isPidValidForPersonName(targetPidMatch[0], personName)) {
            personPid = targetPidMatch[0].toUpperCase();
          }
        }

        try {
          var hasBox = false;
          var regionBox = null;
          var b = target.box;

          if (b) {
            var bx = (b.x !== undefined) ? b.x : (b.left !== undefined ? b.left : 0);
            var by = (b.y !== undefined) ? b.y : (b.top !== undefined ? b.top : 0);
            var bw = (b.width !== undefined) ? b.width : (b.w !== undefined ? b.w : 0.2);
            var bh = (b.height !== undefined) ? b.height : (b.h !== undefined ? b.h : 0.2);

            if (typeof bx === 'string' && bx.includes('%')) bx = parseFloat(bx) / 100;
            if (typeof by === 'string' && by.includes('%')) by = parseFloat(by) / 100;
            if (typeof bw === 'string' && bw.includes('%')) bw = parseFloat(bw) / 100;
            if (typeof bh === 'string' && bh.includes('%')) bh = parseFloat(bh) / 100;

            var x = Math.max(0, Math.min(0.99, Number(bx) || 0));
            var y = Math.max(0, Math.min(0.99, Number(by) || 0));
            var w = Math.max(0.01, Math.min(1 - x, Number(bw) || 0.15));
            var h = Math.max(0.01, Math.min(1 - y, Number(bh) || 0.15));
            hasBox = true;

            // FamilySearch Memories tag viewer expects x,y,width,height (0.0000 - 1.0000)
            regionBox = x.toFixed(4) + ',' + y.toFixed(4) + ',' + w.toFixed(4) + ',' + h.toFixed(4);
          }

          var qualifiers = hasBox ? [
            { name: 'http://gedcomx.org/RectangleRegion', value: regionBox },
            { name: 'http://familysearch.org/v1/RectangleRegion', value: regionBox }
          ] : undefined;

          var media = hasBox ? [
            {
              resource: API_BASE + '/platform/memories/memories/' + memoryId,
              description: 'http://gedcomx.org/Photograph',
              qualifiers: qualifiers
            }
          ] : undefined;

          var personNames = [
            {
              type: 'http://gedcomx.org/Preferred',
              nameForms: [{ fullText: personName }]
            }
          ];

          var identifiers = {};
          if (personPid) {
            identifiers['http://gedcomx.org/Persistent'] = [
              API_BASE + '/platform/tree/persons/' + personPid
            ];
            identifiers['http://familysearch.org/v1/FamilyTreePerson'] = [
              'https://familysearch.org/ark:/61903/4:1:' + personPid
            ];
          }
          var hasIdentifiers = Object.keys(identifiers).length > 0;

          // Check if an unclaimed existing persona on the memory matches this person
          var matchedExisting = existingPersonas.find(function (p) {
            if (!p.id || claimedPersonaIds.has(p.id)) return false;
            if (personPid && p.identifiers && p.identifiers['http://familysearch.org/v1/FamilyTreePerson']) {
              var arks = p.identifiers['http://familysearch.org/v1/FamilyTreePerson'];
              if (Array.isArray(arks) && arks.some(function (ark) { return ark.indexOf(personPid) !== -1; })) {
                return true;
              }
            }
            if (personPid && Array.isArray(p.identifiers)) {
              if (p.identifiers.some(function (idObj) { return idObj.value && idObj.value.indexOf(personPid) !== -1; })) {
                return true;
              }
            }
            var pName = p.names && p.names[0] && (
              (p.names[0].nameForms && p.names[0].nameForms[0] && p.names[0].nameForms[0].fullText) ||
              (p.names[0].forms && p.names[0].forms[0] && p.names[0].forms[0].fullText)
            );
            if (pName && isNameMatch(pName, personName)) {
              return true;
            }
            return false;
          });

          // ONLY for the first target (tIdx2 === 0), if there is an unclaimed initial placeholder persona on the memory, we can adopt it
          if (!matchedExisting && tIdx2 === 0 && existingPersonas.length === 1 && !claimedPersonaIds.has(existingPersonas[0].id)) {
            matchedExisting = existingPersonas[0];
          }

          var personaId = matchedExisting ? matchedExisting.id : null;
          var opSuccess = false;

          if (matchedExisting) {
            // UPDATE existing persona with bounding box coordinates
            var updatePerson = {
              id: matchedExisting.id,
              extracted: true,
              names: personNames
            };
            if (media) updatePerson.media = media;
            if (hasIdentifiers) updatePerson.identifiers = identifiers;

            var updateRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + matchedExisting.id, {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token.accessToken,
                'Content-Type': 'application/x-gedcomx-v1+json',
                'Accept': 'application/x-gedcomx-v1+json, application/json'
              },
              body: JSON.stringify({ persons: [updatePerson] })
            });

            if (updateRes.ok || updateRes.status === 204) {
              opSuccess = true;
              personaId = matchedExisting.id;
              claimedPersonaIds.add(matchedExisting.id);
            } else {
              var updateRetry = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + matchedExisting.id, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify({ persons: [updatePerson] })
              });
              if (updateRetry.ok || updateRetry.status === 204) {
                opSuccess = true;
                personaId = matchedExisting.id;
                claimedPersonaIds.add(matchedExisting.id);
              }
            }
          }

          if (!opSuccess) {
            // CREATE new persona with bounding box coordinates (handles baby Kira and all group members)
            var createPerson = {
              extracted: true,
              names: personNames
            };
            if (media) createPerson.media = media;
            if (hasIdentifiers) createPerson.identifiers = identifiers;

            // Attempt 1: Standard GEDCOM X
            var personaRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token.accessToken,
                'Content-Type': 'application/x-gedcomx-v1+json',
                'Accept': 'application/x-gedcomx-v1+json, application/json'
              },
              body: JSON.stringify({ persons: [createPerson] })
            });

            // Attempt 2: If rejected with identifiers, retry without identifiers (link Tree PID afterwards)
            if (!personaRes.ok && hasIdentifiers) {
              var fallbackPerson = {
                extracted: true,
                names: createPerson.names
              };
              if (media) fallbackPerson.media = media;
              personaRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-gedcomx-v1+json',
                  'Accept': 'application/x-gedcomx-v1+json, application/json'
                },
                body: JSON.stringify({ persons: [fallbackPerson] })
              });
            }

            // Attempt 3: Retry with application/x-fs-v1+json if GEDCOM X was rejected
            if (!personaRes.ok) {
              personaRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify({ persons: [createPerson] })
              });
            }

            if (personaRes.ok || personaRes.status === 201) {
              var entId = personaRes.headers.get('X-entity-id') || personaRes.headers.get('x-entity-id');
              var loc = personaRes.headers.get('Location') || personaRes.headers.get('location') || '';
              personaId = entId || (loc ? loc.replace(/\/+$/, '').split('/').pop() : null);
              if (personaId) claimedPersonaIds.add(personaId);
              opSuccess = true;
            }
          }

          // Link persona to Tree Person
          if (personPid && personaId) {
            linkedPersonas.push({ personPid: personPid, personaId: personaId });

            try {
              // 1. Link persona to Tree Person ARK
              await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + personaId, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify({
                  persons: [
                    {
                      id: personaId,
                      identifiers: {
                        'http://familysearch.org/v1/FamilyTreePerson': [
                          'https://familysearch.org/ark:/61903/4:1:' + personPid
                        ]
                      }
                    }
                  ]
                })
              });
            } catch (pidLinkErr) {
              console.warn('Persona ARK link notice:', pidLinkErr);
            }

            try {
              // 2. Attach persona specifically as evidence on the Tree Person
              var evidencePersonaUri = API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + personaId;
              await fetch(API_BASE + '/platform/tree/persons/' + encodeURIComponent(personPid), {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify({
                  persons: [
                    {
                      id: personPid,
                      evidence: [
                        { resource: evidencePersonaUri }
                      ]
                    }
                  ]
                })
              });
            } catch (evErr) {
              console.warn('Tree person evidence link notice:', evErr);
            }

            try {
              // 3. Attach persona as memory reference on Tree Person
              await fetch(API_BASE + '/platform/tree/persons/' + encodeURIComponent(personPid) + '/memory-references', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-gedcomx-v1+json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  persons: [
                    {
                      evidence: [
                        { resource: API_BASE + '/platform/memories/memories/' + memoryId }
                      ]
                    }
                  ]
                })
              });
            } catch (refErr) {
              console.warn('Tree person memory-reference notice:', refErr);
            }
          }
        } catch (tagErr) {
          console.warn('Persona tag creation notice:', tagErr);
        }
      }

      // Clean up any stale/old personas on an updated memory that weren't claimed by current tags
      if (existingPersonas && existingPersonas.length > 0) {
        for (var epIdx = 0; epIdx < existingPersonas.length; epIdx++) {
          var ep = existingPersonas[epIdx];
          if (ep && ep.id && !claimedPersonaIds.has(ep.id)) {
            try {
              await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/personas/' + encodeURIComponent(ep.id), {
                method: 'DELETE',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken
                }
              });
            } catch (staleDelErr) {
              console.warn('Stale persona cleanup notice:', staleDelErr);
            }
          }
        }
      }
    }

    // 5. Ensure EVERY person PID associated with this photo is linked to the single memory artifact
    var allUniquePids = new Set();
    if (tagTargets && tagTargets.length > 0) {
      tagTargets.forEach(function (pr) {
        var pid = pr.fsId;
        if (!pid && pr.name) {
          var ranked = rankMatches(KNOWN_FAMILY, pr.name);
          if (ranked && ranked.length > 0) pid = ranked[0].id;
        }
        if (pid) {
          var matched = String(pid).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/g);
          if (matched) matched.forEach(function (id) { allUniquePids.add(id.toUpperCase()); });
        }
      });
    }
    if (linkedPersonas && linkedPersonas.length > 0) {
      linkedPersonas.forEach(function (lp) {
        if (lp.personPid) {
          var matched = String(lp.personPid).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/g);
          if (matched) matched.forEach(function (id) { allUniquePids.add(id.toUpperCase()); });
        }
      });
    }
    if (rawTargetIds) {
      var rMatched = String(rawTargetIds).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/g);
      if (rMatched) rMatched.forEach(function (id) { allUniquePids.add(id.toUpperCase()); });
    }
    if (photo && photo.fsId) {
      var pMatched = String(photo.fsId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/g);
      if (pMatched) pMatched.forEach(function (id) { allUniquePids.add(id.toUpperCase()); });
    }

    if (memoryId && allUniquePids.size > 0) {
      onProgress({ step: 'linking', message: 'Linking memory to ' + allUniquePids.size + ' family member(s) in Family Tree...' });
      var memoryUri = API_BASE + '/platform/memories/memories/' + memoryId;

      for (var treePid of allUniquePids) {
        // 1. Link memory directly via memory-references on Tree Person
        try {
          await fetch(API_BASE + '/platform/tree/persons/' + encodeURIComponent(treePid) + '/memory-references', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Content-Type': 'application/x-gedcomx-v1+json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              persons: [
                {
                  evidence: [{ resource: memoryUri }]
                }
              ]
            })
          });
        } catch (refErr) {
          console.warn('Memory reference link for ' + treePid + ' notice:', refErr);
        }

        // 2. Link memory as evidence on Tree Person
        try {
          var updatePersonUrl = API_BASE + '/platform/tree/persons/' + encodeURIComponent(treePid);
          await fetch(updatePersonUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Content-Type': 'application/x-fs-v1+json',
              'Accept': 'application/x-fs-v1+json, application/json'
            },
            body: JSON.stringify({
              persons: [
                {
                  id: treePid,
                  evidence: [{ resource: memoryUri }]
                }
              ]
            })
          });
        } catch (evErr) {
          console.warn('Tree person evidence link for ' + treePid + ' notice:', evErr);
        }
      }
    }

    var memoryWebUrl = memoryId ? WEB_BASE + '/en/memories/memory/' + memoryId : WEB_BASE + '/en/memories/gallery';
    var primaryPid = Array.from(allUniquePids)[0] || targetPersonId;
    var personMemoriesUrl = primaryPid ? WEB_BASE + '/en/tree/person/memories/' + primaryPid : null;

    onProgress({ step: 'done', message: '✓ 1 memory saved & linked to ' + (allUniquePids.size || 1) + ' relative(s) on FamilySearch Beta!' });

    return {
      success: true,
      memoryId: memoryId,
      memoryUrl: memoryWebUrl,
      personMemoriesUrl: personMemoriesUrl,
      linkedPids: Array.from(allUniquePids),
      targetPersonId: targetPersonId,
      title: title,
      placeInfo: placeInfo,
      dateInfo: dateInfo
    };
  }

  /**
   * Delete an existing memory from FamilySearch Beta
   */
  async function deleteMemory(memoryId) {
    var token = getStoredToken();
    if (!token) {
      throw new Error('Not signed in to FamilySearch.');
    }
    if (!memoryId) return false;

    try {
      var res = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token.accessToken
        }
      });
      if (res.status === 204 || res.ok) {
        return true;
      }
      if (res.status === 404) {
        return true;
      }
      var errText = await res.text();
      console.warn('FamilySearch deleteMemory notice (' + res.status + '):', errText);
      return false;
    } catch (e) {
      console.warn('FamilySearch deleteMemory error:', e);
      return false;
    }
  }

  var KNOWN_FAMILY = [
    { id: 'BM6T-WQ5', name: 'Patricia Josephine Gill', lifespan: 'Living', gender: 'Female', aliases: ['patricia', 'mom', 'patricia gill', 'patricia josephine gill'] },
    { id: 'BM6T-QXX', name: 'Jeffrey Alan Viola', lifespan: '1960-Living', gender: 'Male', aliases: ['jeff', 'jeffrey', 'jeff viola', 'jeffrey alan viola'] },
    { id: 'BM6T-HYB', name: 'Rayna Lee Baber', lifespan: 'Living', gender: 'Female', aliases: ['rayna', 'rayna baber', 'rayna lee baber'] },
    { id: 'BM6T-68V', name: 'Brittany Denae Viola', lifespan: 'Living', gender: 'Female', aliases: ['brittany', 'brittany viola'] },
    { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola', lifespan: 'Living', gender: 'Female', aliases: ['kourtnie', 'barnes', 'kourtnie viola'] },
    { id: 'BM6T-8QC', name: 'Makinzie Rae Viola', lifespan: 'Living', gender: 'Female', aliases: ['makinzie', 'makinzie viola'] }
  ];

  function rankMatches(candidates, query) {
    if (!candidates || candidates.length === 0) return [];
    var q = query.trim().toLowerCase();
    var qParts = q.split(/\s+/).filter(Boolean);
    var qGiven = qParts[0] || '';
    var qSur = qParts.length > 1 ? qParts[qParts.length - 1] : '';

    var scored = candidates.map(function (c) {
      var cName = (c.name || '').toLowerCase();
      var cParts = cName.split(/\s+/).filter(Boolean);
      var cGiven = cParts[0] || '';
      var cSur = cParts.length > 1 ? cParts[cParts.length - 1] : '';

      var score = 0;
      if (c.id && c.id.toLowerCase() === q) score += 100;
      if (cName === q) score += 100;
      else if (cName.startsWith(q) || q.startsWith(cName)) score += 90;
      else if (cName.includes(q) || q.includes(cName)) score += 80;
      else {
        // A candidate only scores if the given name matches or starts with the query given name!
        if (qGiven && cGiven && (qGiven === cGiven || cGiven.startsWith(qGiven) || qGiven.startsWith(cGiven))) {
          score += 45;
          if (qSur && cSur && qSur === cSur) score += 40;
        }
        if (c.aliases && c.aliases.some(function (a) { return a.toLowerCase() === q; })) score += 60;
        else if (c.aliases && c.aliases.some(function (a) { return qGiven && a.toLowerCase() === qGiven; })) score += 35;
      }
      return { candidate: c, score: score };
    });

    return scored
      .filter(function (item) {
        if (item.score < 50) return false;
        if (qParts.length >= 2 && item.candidate && item.candidate.id) {
          return isPidValidForPersonName(item.candidate.id, query);
        }
        return true;
      })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (item) { return item.candidate; });
  }

  async function searchPersons(query) {
    if (!query || !query.trim()) return [];
    var trimmed = query.trim();

    // If query contains multiple comma or semicolon separated names, search each and combine
    if (trimmed.includes(',') && !trimmed.includes('-') && !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}$/.test(trimmed)) {
      var subQueries = trimmed.split(/[,;&]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (subQueries.length > 1) {
        var combinedMatches = [];
        var seenIds = new Set();
        for (var sqIdx = 0; sqIdx < subQueries.length; sqIdx++) {
          var sqMatches = await searchPersons(subQueries[sqIdx]);
          for (var mIdx = 0; mIdx < sqMatches.length; mIdx++) {
            if (!seenIds.has(sqMatches[mIdx].id)) {
              seenIds.add(sqMatches[mIdx].id);
              combinedMatches.push(sqMatches[mIdx]);
            }
          }
        }
        return combinedMatches;
      }
    }

    // 1. Check local seeds with intelligent ranking
    var localMatches = rankMatches(KNOWN_FAMILY, query);

    var token = getStoredToken();
    if (!token) {
      return localMatches;
    }

    // 2. Direct PID lookup
    var isPid = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}$/.test(trimmed);
    if (isPid) {
      try {
        var pidRes = await fetch(API_BASE + '/platform/tree/persons/' + trimmed.toUpperCase(), {
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/x-gedcomx-v1+json'
          }
        });
        if (pidRes.ok) {
          var pData = await pidRes.json();
          var pItem = pData && pData.persons && pData.persons[0];
          if (pItem) {
            var d = pItem.display || {};
            var pName = d.name;
            if (!pName && pItem.names && pItem.names[0] && pItem.names[0].nameForms && pItem.names[0].nameForms[0]) {
              pName = pItem.names[0].nameForms[0].fullText;
            }
            return [{
              id: pItem.id || trimmed.toUpperCase(),
              name: pName || trimmed.toUpperCase(),
              lifespan: d.lifespan || '',
              gender: d.gender || ''
            }];
          }
        }
      } catch (e) {
        console.warn('Direct PID lookup notice:', e);
      }
    }

    // 3. Search Family Tree REST API
    try {
      var searchParams = new URLSearchParams();
      var parts = trimmed.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        searchParams.set('q.surname', parts[0]);
      } else {
        searchParams.set('q.givenName', parts.slice(0, -1).join(' '));
        searchParams.set('q.surname', parts[parts.length - 1]);
      }
      searchParams.set('count', '8');

      var searchRes = await fetch(API_BASE + '/platform/tree/search?' + searchParams.toString(), {
        headers: {
          'Authorization': 'Bearer ' + token.accessToken,
          'Accept': 'application/x-gedcomx-atom+json'
        }
      });

      if (searchRes.ok) {
        var sData = await searchRes.json();
        var entries = sData.entries || [];
        var serverResults = entries.map(function (e) {
          var g = e.content && e.content.gedcomx;
          var pers = g && g.persons && g.persons[0];
          var disp = pers && pers.display || {};
          var id = pers && pers.id || (e.id ? e.id.split('/').pop() : null);
          var name = disp.name || (pers && pers.names && pers.names[0] && pers.names[0].nameForms && pers.names[0].nameForms[0] && pers.names[0].nameForms[0].fullText) || e.title;
          return {
            id: id,
            name: name,
            lifespan: disp.lifespan || '',
            gender: disp.gender || ''
          };
        }).filter(function (r) { return Boolean(r.id); });

        var seen = new Set();
        var combined = [];
        localMatches.forEach(function (m) { seen.add(m.id); combined.push(m); });
        serverResults.forEach(function (r) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            combined.push(r);
          }
        });
        return rankMatches(combined, query);
      }
    } catch (searchErr) {
      console.warn('FamilySearch tree search notice:', searchErr);
    }

    return localMatches;
  }

  global.FamilySearchClient = {
    getClientId: getClientId,
    setClientId: setClientId,
    getRedirectUri: getRedirectUri,
    setRedirectUri: setRedirectUri,
    showConnectionDialog: showConnectionDialog,
    getStoredToken: getStoredToken,
    saveToken: saveToken,
    clearToken: clearToken,
    startLogin: startLogin,
    handleCallbackCode: handleCallbackCode,
    getCurrentUser: getCurrentUser,
    uploadMemory: uploadMemory,
    deleteMemory: deleteMemory,
    checkMemoryExists: checkMemoryExists,
    createFreshUploadBlob: createFreshUploadBlob,
    searchPersons: searchPersons,
    isPidValidForPersonName: isPidValidForPersonName,
    KNOWN_FAMILY: KNOWN_FAMILY,
    parseFamilySearchDate: parseFamilySearchDate,
    formatNormalizedDate: formatNormalizedDate,
    resolvePlaceDescription: resolvePlaceDescription,
    AUTH_URL: AUTH_URL,
    API_BASE: API_BASE,
    WEB_BASE: WEB_BASE
  };
})(typeof window !== 'undefined' ? window : this);

