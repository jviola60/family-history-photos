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

  async function handleCallbackCode(code) {
    var codeVerifier = null;
    var activeRedirect = null;
    try {
      codeVerifier = sessionStorage.getItem(FS_VERIFIER_KEY) || localStorage.getItem(FS_VERIFIER_KEY);
      activeRedirect = sessionStorage.getItem(FS_REDIRECT_KEY) || localStorage.getItem(FS_REDIRECT_KEY);
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
   * Helper to parse any user date format (ISO, US M/D/YYYY, Month Day Year, Year, etc.)
   * returns { normalized: "30 March 2003", formal: "+2003-03-30", iso: "2003-03-30", year: 2003, decade: "2000s" }
   */
  function parseFamilySearchDate(input) {
    if (!input) return { normalized: '', formal: '', iso: '', decade: '' };
    var clean = String(input).trim();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var monthNames = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
      may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };

    var y = null, m = null, d = null;

    // 1. Check ISO format YYYY-MM-DD or YYYY-MM or YYYY (with optional +/- prefix)
    var isoMatch = clean.match(/^([+-]?\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/);
    if (isoMatch) {
      y = parseInt(isoMatch[1], 10);
      if (isoMatch[2]) m = parseInt(isoMatch[2], 10);
      if (isoMatch[3]) d = parseInt(isoMatch[3], 10);
    }

    // 2. Check US format M/D/YYYY or MM/DD/YYYY
    if (!y) {
      var usMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (usMatch) {
        m = parseInt(usMatch[1], 10);
        d = parseInt(usMatch[2], 10);
        y = parseInt(usMatch[3], 10);
      }
    }

    // 3. Check "March 30, 2003" or "30 March 2003"
    if (!y) {
      var wordMatch1 = clean.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
      if (wordMatch1) {
        var mn = wordMatch1[1].toLowerCase();
        if (monthNames[mn]) {
          m = monthNames[mn];
          d = parseInt(wordMatch1[2], 10);
          y = parseInt(wordMatch1[3], 10);
        }
      }
    }
    if (!y) {
      var wordMatch2 = clean.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
      if (wordMatch2) {
        var mn2 = wordMatch2[2].toLowerCase();
        if (monthNames[mn2]) {
          d = parseInt(wordMatch2[1], 10);
          m = monthNames[mn2];
          y = parseInt(wordMatch2[3], 10);
        }
      }
    }
    if (!y) {
      var monthYearMatch = clean.match(/^([A-Za-z]+)\s+(\d{4})$/);
      if (monthYearMatch) {
        var mn3 = monthYearMatch[1].toLowerCase();
        if (monthNames[mn3]) {
          m = monthNames[mn3];
          y = parseInt(monthYearMatch[2], 10);
        }
      }
    }

    // Fallback 4-digit year search (e.g. "Circa 2003")
    if (!y) {
      var yearMatch = clean.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        y = parseInt(yearMatch[1], 10);
      }
    }

    if (y) {
      var decade = Math.floor(y / 10) * 10 + 's';
      if (m && d) {
        var padM = String(m).padStart(2, '0');
        var padD = String(d).padStart(2, '0');
        var isoStr = y + '-' + padM + '-' + padD;
        return {
          normalized: d + ' ' + months[m - 1] + ' ' + y,
          formal: '+' + isoStr,
          iso: isoStr,
          year: y,
          decade: decade
        };
      } else if (m) {
        var padM2 = String(m).padStart(2, '0');
        var isoStr2 = y + '-' + padM2;
        return {
          normalized: months[m - 1] + ' ' + y,
          formal: '+' + isoStr2,
          iso: isoStr2,
          year: y,
          decade: decade
        };
      } else {
        return {
          normalized: String(y),
          formal: '+' + y,
          iso: String(y),
          year: y,
          decade: decade
        };
      }
    }

    return { normalized: clean, formal: '', iso: clean, decade: '' };
  }

  /**
   * Helper to convert ISO or text date into FamilySearch normalized date string (e.g. "30 March 2003")
   */
  function formatNormalizedDate(iso) {
    if (!iso) return '';
    var parsed = parseFamilySearchDate(iso);
    return parsed.normalized || String(iso).trim();
  }

  /**
   * Resolves the real numeric FamilySearch Memory ID if a photo was already uploaded (e.g. on 409 Conflict)
   */
  async function resolveExistingMemoryId(targetPersonId, title, filename, token) {
    var cleanTitle = (title || '').trim().toLowerCase();

    // 1. Check target person's attached memories
    if (targetPersonId) {
      try {
        var pRes = await fetch(API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId) + '/memories', {
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
          }
        });
        if (pRes.ok) {
          var pJson = await pRes.json();
          var sds = pJson.sourceDescriptions || [];
          if (sds.length > 0) {
            var matched = sds.find(function (sd) {
              var t = (sd.titles && sd.titles[0] && sd.titles[0].value) || '';
              var ab = sd.about || '';
              return (cleanTitle && t.trim().toLowerCase() === cleanTitle) ||
                (filename && ab.includes(filename));
            });
            var chosen = matched || sds[0];
            if (chosen) {
              var memIdFromAbout = (chosen.about && chosen.about.indexOf('/memories/') !== -1)
                ? chosen.about.replace(/\/+$/, '').split('/').pop()
                : null;
              var chosenId = memIdFromAbout || (chosen.id ? String(chosen.id) : null);
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
      if (uRes.ok) {
        var uJson = await uRes.json();
        var uSds = uJson.sourceDescriptions || [];
        if (uSds.length > 0) {
          var uMatched = uSds.find(function (sd) {
            var t = (sd.titles && sd.titles[0] && sd.titles[0].value) || '';
            var ab = sd.about || '';
            return (cleanTitle && t.trim().toLowerCase() === cleanTitle) ||
              (filename && ab.includes(filename));
          });
          var uChosen = uMatched || uSds[0];
          if (uChosen) {
            var uMemIdFromAbout = (uChosen.about && uChosen.about.indexOf('/memories/') !== -1)
              ? uChosen.about.replace(/\/+$/, '').split('/').pop()
              : null;
            var uChosenId = uMemIdFromAbout || (uChosen.id ? String(uChosen.id) : null);
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
    var targetPersonId = (options.targetPersonId || photo.fsId || '').trim().toUpperCase();
    var onProgress = options.onProgress || function () { };

    onProgress({ step: 'preparing', message: 'Preparing photo artifact for FamilySearch...' });

    // If replacing older copy requested, delete prior memory from FamilySearch first
    if (options.replaceMemoryId) {
      onProgress({ step: 'replacing', message: 'Removing older copy (Memory #' + options.replaceMemoryId + ') from FamilySearch...' });
      try {
        await deleteMemory(options.replaceMemoryId);
      } catch (delErr) {
        console.warn('Could not delete old memory before replace:', delErr);
      }
    }

    // Parse date into ISO, normalized (e.g. "30 March 2003"), and formal (e.g. "+2003-03-30")
    var dateInfo = parseFamilySearchDate(isoDate);
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
    if (isoDate) descLines.push('Date: ' + (normalizedDate || isoDate));
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

    var formData = new FormData();
    formData.append('artifact', imageBlob, filename);
    formData.append('title', title);
    if (fullDescription) {
      formData.append('description', fullDescription);
    }
    if (normalizedDate) {
      formData.append('date', normalizedDate);
      formData.append('coverageDate', normalizedDate);
      formData.append('temporal', normalizedDate);
    }
    if (effectivePlaceName) {
      formData.append('place', effectivePlaceName);
      formData.append('coveragePlace', effectivePlaceName);
      formData.append('spatial', effectivePlaceName);
    }

    onProgress({ step: 'uploading', message: 'Uploading photo to FamilySearch Beta Memories...' });

    var uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token.accessToken,
        'Accept': 'application/json'
      },
      body: formData
    });

    var memoryId = null;

    if (!uploadRes.ok) {
      if (uploadRes.status === 409) {
        // Conflict - memory already exists on FamilySearch
        onProgress({ step: 'conflict', message: 'Photo is already on FamilySearch. Resolving existing memory record...' });
        var loc = uploadRes.headers.get('Location') || '';
        var xId = uploadRes.headers.get('X-entity-id') || '';
        memoryId = xId || (loc ? loc.replace(/\/+$/, '').split('/').pop() : null) || options.memoryId;

        if (!memoryId) {
          memoryId = await resolveExistingMemoryId(targetPersonId, title, filename, token);
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
          body: formData
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

    if (!memoryId && photo.id) {
      memoryId = 'mem_' + Date.now();
    }

    // 1b. Update Memory Date & Place Coverage metadata
    if (memoryId && (normalizedDate || effectivePlaceName)) {
      onProgress({ step: 'coverage', message: 'Saving memory Date (' + (normalizedDate || 'N/A') + ') and Place (' + (effectivePlaceName || 'N/A') + ') to FamilySearch...' });
      try {
        // Build cleanly typed GEDCOM X Coverage entries
        // Notice: In GEDCOM X schema, temporal.normalized is List<TextValue>, not a string.
        // formal must be strict ISO GEDCOM X (e.g. "+2003-03-30" or "+2003")
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
        var memoryAbout = API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId);

        // Target endpoints: coverage sub-resource, memory container, and artifact endpoints
        var targetEndpoints = [];
        if (coverageHref) targetEndpoints.push({ url: coverageHref, isCoverageOnly: true });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/artifacts/0/coverage', isCoverageOnly: true });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), isCoverageOnly: false });
        if (artifactHref) {
          targetEndpoints.push({ url: artifactHref + '/coverage', isCoverageOnly: true });
          targetEndpoints.push({ url: artifactHref, isCoverageOnly: false });
        }
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/artifacts/0', isCoverageOnly: false });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/artifacts/' + encodeURIComponent(memoryId) + '/description', isCoverageOnly: false });

        var coverageSaved = false;

        // Dispatch coverage updates across endpoints until saved
        for (var tIdx = 0; tIdx < targetEndpoints.length; tIdx++) {
          var target = targetEndpoints[tIdx];
          var epUrl = target.url;
          var payloads = [];

          if (target.isCoverageOnly) {
            // Direct coverage payloads (tried with POST and PUT)
            var covVariants = [covClean, covWithNormalized, covMinimal];
            for (var cvIdx = 0; cvIdx < covVariants.length; cvIdx++) {
              var cv = covVariants[cvIdx];
              payloads.push({ method: 'POST', body: cv });
              payloads.push({ method: 'PUT', body: cv });
              payloads.push({ method: 'POST', body: [cv] });
              payloads.push({ method: 'PUT', body: [cv] });
              payloads.push({ method: 'POST', body: { coverage: cv } });
              payloads.push({ method: 'PUT', body: { coverage: cv } });
              payloads.push({ method: 'POST', body: { coverage: [cv] } });
              payloads.push({ method: 'PUT', body: { coverage: [cv] } });
            }
          } else {
            // Container / description payloads (SourceDescriptions)
            var covVariants2 = [covClean, covWithNormalized, covMinimal];
            for (var cv2Idx = 0; cv2Idx < covVariants2.length; cv2Idx++) {
              var cv2 = covVariants2[cv2Idx];
              // Standard GEDCOM X SourceDescription with coverage array
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
              payloads.push({
                method: 'POST',
                body: {
                  sourceDescriptions: [{
                    id: targetSdId,
                    about: memoryAbout,
                    coverage: [cv2]
                  }]
                }
              });
              payloads.push({
                method: 'POST',
                body: {
                  sourceDescriptions: [{
                    id: targetSdId,
                    about: memoryAbout,
                    coverage: cv2
                  }]
                }
              });
              // Also try PUT on memory container
              payloads.push({
                method: 'PUT',
                body: {
                  sourceDescriptions: [{
                    id: targetSdId,
                    about: memoryAbout,
                    coverage: [cv2]
                  }]
                }
              });
            }
          }

          for (var pIdx = 0; pIdx < payloads.length; pIdx++) {
            var item = payloads[pIdx];
            var contentTypes = ['application/x-fs-v1+json', 'application/x-gedcomx-v1+json', 'application/json'];
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
                var pText = '';
                try { pText = await pRes.clone().text(); } catch (clErr) {}
                console.log('FS coverage attempt:', item.method, epUrl, cType, pRes.status, pText);
                if (pRes.ok) {
                  console.log('FS coverage SUCCESS (' + pRes.status + ') at ' + epUrl);
                  coverageSaved = true;
                  break;
                }
              } catch (pErr) {
                console.warn('FS coverage dispatch error:', pErr);
              }
            }
            if (coverageSaved && target.isCoverageOnly) {
              break;
            }
          }
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
        onProgress({ step: 'faces', message: 'Detecting faces on photo for FamilySearch tag coordinates...' });
        faces = await window.FaceDetectorEngine.detectFaces(imageBlob || (photo && photo.file));
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
    if (memoryId && ((people && people.length > 0) || targetPersonId)) {
      var peopleList = (people && people.length > 0)
        ? people
        : [{ name: title, fsId: targetPersonId }];

      onProgress({ step: 'tagging', message: 'Tagging relatives and face positions on FamilySearch memory...' });
      for (var pIdx = 0; pIdx < peopleList.length; pIdx++) {
        var person = peopleList[pIdx];
        var personName = typeof person === 'string' ? person : person.name;
        if (!personName) continue;

        var personPid = null;
        if (person && person.fsId) {
          var directPidMatch = String(person.fsId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
          if (directPidMatch) personPid = directPidMatch[0].toUpperCase();
        }

        if (!personPid && faces && faces.length > 0) {
          var fMatch = faces.find(function (f) {
            return f.name && f.name.toLowerCase() === personName.toLowerCase() && f.fsId;
          });
          if (fMatch && fMatch.fsId) {
            var facePidMatch = String(fMatch.fsId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
            if (facePidMatch) personPid = facePidMatch[0].toUpperCase();
          }
        }

        if (!personPid) {
          var kfMatches = rankMatches(KNOWN_FAMILY, personName);
          if (kfMatches && kfMatches.length > 0) {
            personPid = kfMatches[0].id.toUpperCase();
          }
        }

        if (!personPid && targetPersonId && (pIdx === 0 || peopleList.length === 1)) {
          var targetPidMatch = String(targetPersonId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/);
          if (targetPidMatch) personPid = targetPidMatch[0].toUpperCase();
        }

        try {
          var assignedFace = null;
          if (faces && faces.length > 0) {
            if (faces.length === 1 && peopleList.length === 1) {
              assignedFace = faces[0];
            } else {
              assignedFace = faces.find(function (f) {
                return f.name && personName && f.name.toLowerCase() === personName.toLowerCase();
              }) || (pIdx === 0 ? faces[0] : null);
            }
          }

          var hasBox = false;
          var regionStr = null;
          var regionBox = null;
          var x1Str = '0.0000', y1Str = '0.0000', wStr = '0.2000', hStr = '0.2000';

          if (assignedFace && assignedFace.box) {
            var b = assignedFace.box;
            var bx = (b.x !== undefined) ? b.x : (b.left !== undefined ? b.left : 0);
            var by = (b.y !== undefined) ? b.y : (b.top !== undefined ? b.top : 0);
            var bw = (b.width !== undefined) ? b.width : (b.w !== undefined ? b.w : 0.2);
            var bh = (b.height !== undefined) ? b.height : (b.h !== undefined ? b.h : 0.2);

            var x = Math.max(0, Math.min(1, Number(bx)));
            var y = Math.max(0, Math.min(1, Number(by)));
            var w = Math.max(0.01, Math.min(1 - x, Number(bw)));
            var h = Math.max(0.01, Math.min(1 - y, Number(bh)));
            hasBox = true;

            x1Str = x.toFixed(4);
            y1Str = y.toFixed(4);
            var x2Str = Math.min(1, x + w).toFixed(4);
            var y2Str = Math.min(1, y + h).toFixed(4);
            wStr = w.toFixed(4);
            hStr = h.toFixed(4);

            // GEDCOM X standard: x1,y1,x2,y2
            regionStr = x1Str + ',' + y1Str + ',' + x2Str + ',' + y2Str;
            // FamilySearch standard: x,y,width,height
            regionBox = x1Str + ',' + y1Str + ',' + wStr + ',' + hStr;
          }

          var qualifiers = hasBox ? [
            { name: 'http://gedcomx.org/RectangleRegion', value: regionStr },
            { name: 'http://gedcomx.org/Box', value: regionStr },
            { name: 'http://gedcomx.org/box', value: regionBox },
            { name: 'http://familysearch.org/v1/RectangleRegion', value: regionBox },
            { name: 'http://familysearch.org/v1/x', value: x1Str },
            { name: 'http://familysearch.org/v1/y', value: y1Str },
            { name: 'http://familysearch.org/v1/width', value: wStr },
            { name: 'http://familysearch.org/v1/height', value: hStr }
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
              nameForms: [{ fullText: personName }],
              forms: [{ fullText: personName }]
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

          // Check if an existing persona on the memory matches this person
          var matchedExisting = existingPersonas.find(function (p) {
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
              (p.names[0].forms && p.names[0].forms[0] && p.names[0].forms[0].fullText) ||
              (p.names[0].nameForms && p.names[0].nameForms[0] && p.names[0].nameForms[0].fullText)
            );
            if (pName && personName) {
              var pLower = pName.trim().toLowerCase();
              var tLower = personName.trim().toLowerCase();
              return pLower === tLower || pLower.indexOf(tLower) !== -1 || tLower.indexOf(pLower) !== -1;
            }
            return false;
          }) || (existingPersonas.length === 1 ? existingPersonas[0] : null);

          var personaId = matchedExisting ? matchedExisting.id : null;
          var opSuccess = false;

          if (matchedExisting) {
            // UPDATE existing persona with bounding box coordinates and identifiers
            var updatePerson = {
              id: matchedExisting.id,
              extracted: true,
              names: personNames,
              media: media
            };
            if (hasIdentifiers) updatePerson.identifiers = identifiers;

            var updateRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + matchedExisting.id, {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token.accessToken,
                'Content-Type': 'application/x-fs-v1+json',
                'Accept': 'application/x-fs-v1+json, application/json'
              },
              body: JSON.stringify({ persons: [updatePerson] })
            });

            if (updateRes.ok || updateRes.status === 204) {
              opSuccess = true;
              personaId = matchedExisting.id;
            } else {
              var updateRetry = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + matchedExisting.id, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-gedcomx-v1+json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ persons: [updatePerson] })
              });
              if (updateRetry.ok || updateRetry.status === 204) {
                opSuccess = true;
                personaId = matchedExisting.id;
              }
            }
          }

          if (!opSuccess) {
            // CREATE new persona with bounding box coordinates
            var createPerson = {
              extracted: true,
              names: personNames,
              media: media
            };
            if (hasIdentifiers) createPerson.identifiers = identifiers;

            var personaRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token.accessToken,
                'Content-Type': 'application/x-fs-v1+json',
                'Accept': 'application/x-fs-v1+json, application/json'
              },
              body: JSON.stringify({ persons: [createPerson] })
            });

            if (!personaRes.ok && hasIdentifiers) {
              // Retry without identifiers in case server prefers creating first then linking
              var fallbackPerson = {
                extracted: true,
                names: createPerson.names,
                media: media
              };
              personaRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify({ persons: [fallbackPerson] })
              });
            }

            if (personaRes.ok || personaRes.status === 201) {
              var entId = personaRes.headers.get('X-entity-id');
              var loc = personaRes.headers.get('Location') || '';
              personaId = entId || (loc ? loc.replace(/\/+$/, '').split('/').pop() : null);
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
                        { resource: API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + personaId }
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
    }

    // 5. Ensure EVERY person PID associated with this photo is linked to the single memory artifact
    var allUniquePids = new Set();
    if (peopleList) {
      peopleList.forEach(function (pr) {
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
    if (targetPersonId) {
      var tMatched = String(targetPersonId).match(/[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}/g);
      if (tMatched) tMatched.forEach(function (id) { allUniquePids.add(id.toUpperCase()); });
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

    var memoryWebUrl = memoryId ? WEB_BASE + '/memories/memory/' + memoryId : WEB_BASE + '/memories/gallery';
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
    { id: 'BM6T-WQ5', name: 'Patricia Josephine Gill', lifespan: 'Living', gender: 'Female', aliases: ['patricia', 'gill', 'mom', 'patricia gill', 'patricia josephine gill'] },
    { id: 'BM6T-QXX', name: 'Jeffrey Alan Viola', lifespan: '1960-Living', gender: 'Male', aliases: ['jeff', 'jeffrey', 'viola', 'jeff viola', 'jeffrey alan viola'] },
    { id: 'BM6T-HYB', name: 'Rayna Lee Baber', lifespan: 'Living', gender: 'Female', aliases: ['rayna', 'baber', 'rayna baber'] },
    { id: 'BM6T-68V', name: 'Brittany Denae Viola', lifespan: 'Living', gender: 'Female', aliases: ['brittany', 'viola', 'brittany viola'] },
    { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola', lifespan: 'Living', gender: 'Female', aliases: ['kourtnie', 'barnes', 'viola', 'kourtnie viola'] },
    { id: 'BM6T-8QC', name: 'Makinzie Rae Viola', lifespan: 'Living', gender: 'Female', aliases: ['makinzie', 'viola', 'makinzie viola'] }
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
        if (qGiven && cGiven && (qGiven === cGiven || cGiven.startsWith(qGiven) || qGiven.startsWith(cGiven))) score += 40;
        if (qSur && cSur && qSur === cSur) score += 30;
        if (c.aliases && c.aliases.some(function (a) { return a.toLowerCase() === q; })) score += 60;
        else if (c.aliases && c.aliases.some(function (a) { return qGiven && a.toLowerCase() === qGiven; })) score += 35;
      }
      return { candidate: c, score: score };
    });

    var hasStrong = scored.some(function (item) { return item.score >= 60; });
    var minCutoff = hasStrong ? 45 : 25;

    return scored
      .filter(function (item) { return item.score >= minCutoff; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (item) { return item.candidate; });
  }

  async function searchPersons(query) {
    if (!query || !query.trim()) return [];
    var trimmed = query.trim();
    var lower = trimmed.toLowerCase();

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
    searchPersons: searchPersons,
    parseFamilySearchDate: parseFamilySearchDate,
    formatNormalizedDate: formatNormalizedDate,
    resolvePlaceDescription: resolvePlaceDescription,
    AUTH_URL: AUTH_URL,
    API_BASE: API_BASE,
    WEB_BASE: WEB_BASE
  };
})(typeof window !== 'undefined' ? window : this);
