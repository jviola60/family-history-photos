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
   * Helper to convert ISO date (YYYY-MM-DD) into FamilySearch normalized date string (e.g. "2 March 2003")
   */
  function formatNormalizedDate(iso) {
    if (!iso) return '';
    var clean = String(iso).trim();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var parts = clean.split(/[-_\s./]+/);
    if (parts.length === 3) {
      var y = parts[0];
      var m = parseInt(parts[1], 10);
      var d = parseInt(parts[2], 10);
      if (m >= 1 && m <= 12 && !isNaN(d)) {
        return d + ' ' + months[m - 1] + ' ' + y;
      }
    } else if (parts.length === 2 && parts[0].length === 4) {
      var ym = parseInt(parts[1], 10);
      if (ym >= 1 && ym <= 12) {
        return months[ym - 1] + ' ' + parts[0];
      }
    }
    return clean;
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
  async function resolvePlaceDescription(placeText, token) {
    if (!placeText || !token) return null;
    try {
      // Strip street number if present so Place Authority matches the jurisdiction (e.g. "Bowling Green, OH")
      var query = placeText.replace(/^\d+[^,]+,\s*/, '').trim() || placeText;
      var pSearchUrl = API_BASE + '/platform/places/search?q=name:' + encodeURIComponent(query);
      var pRes = await fetch(pSearchUrl, {
        headers: {
          'Authorization': 'Bearer ' + token.accessToken,
          'Accept': 'application/x-gedcomx-atom+json, application/json'
        }
      });
      if (pRes.ok) {
        var pData = await pRes.json();
        var entries = pData.entries || [];
        if (entries.length > 0 && entries[0].content && entries[0].content.gedcomx && entries[0].content.gedcomx.places) {
          var matchedPlace = entries[0].content.gedcomx.places[0];
          if (matchedPlace.links && matchedPlace.links.description && matchedPlace.links.description.href) {
            return matchedPlace.links.description.href;
          }
          if (matchedPlace.id) {
            return API_BASE + '/platform/places/description/' + matchedPlace.id;
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

    // Format rich descriptive summary for FamilySearch Memories description
    var descLines = [];
    if (story) descLines.push(story);
    if (isoDate) descLines.push('Date: ' + isoDate);
    if (place) descLines.push('Location: ' + place);
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
    var filename = (isoDate ? isoDate + '_' : '') + (cleanSlug || 'family_memory') + '.jpg';

    // 1. Determine upload endpoint
    var normalizedDate = formatNormalizedDate(isoDate);
    var uploadUrl = API_BASE + '/platform/memories/memories';
    var qParams = [];
    if (title) qParams.push('title=' + encodeURIComponent(title));
    if (fullDescription) qParams.push('description=' + encodeURIComponent(fullDescription));
    if (normalizedDate) {
      qParams.push('date=' + encodeURIComponent(normalizedDate));
      qParams.push('coverageDate=' + encodeURIComponent(normalizedDate));
    }
    if (place) {
      qParams.push('place=' + encodeURIComponent(place));
      qParams.push('coveragePlace=' + encodeURIComponent(place));
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
    if (place) {
      formData.append('place', place);
      formData.append('coveragePlace', place);
      formData.append('spatial', place);
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
    if (memoryId && (isoDate || place)) {
      onProgress({ step: 'coverage', message: 'Saving memory Date (' + (normalizedDate || isoDate || 'N/A') + ') and Place (' + (place || 'N/A') + ') to FamilySearch...' });
      try {
        var formalDate = (isoDate.startsWith('+') || isoDate.startsWith('-')) ? isoDate : ('+' + isoDate);

        // Resolve FamilySearch Place Authority reference URL if available
        var placeDescUrl = await resolvePlaceDescription(place, token);

        var coverageEntry = {};
        if (isoDate) {
          coverageEntry.temporal = {
            original: normalizedDate || isoDate,
            normalized: normalizedDate,
            formal: formalDate
          };
        }
        if (place) {
          coverageEntry.spatial = {
            original: place
          };
          if (placeDescUrl) {
            coverageEntry.spatial.description = placeDescUrl;
          }
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

        // Target endpoints: coverage sub-resource, artifact endpoint, and memory container
        var targetEndpoints = [];
        if (coverageHref) targetEndpoints.push({ url: coverageHref, isCoverageOnly: true });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/artifacts/0/coverage', isCoverageOnly: true });
        if (artifactHref) {
          targetEndpoints.push({ url: artifactHref + '/coverage', isCoverageOnly: true });
          targetEndpoints.push({ url: artifactHref, isCoverageOnly: false });
        }
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId) + '/artifacts/0', isCoverageOnly: false });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/artifacts/' + encodeURIComponent(memoryId) + '/description', isCoverageOnly: false });
        targetEndpoints.push({ url: API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), isCoverageOnly: false });

        // Dispatch coverage updates to all endpoints (do not break early so all necessary targets receive the update)
        for (var tIdx = 0; tIdx < targetEndpoints.length; tIdx++) {
          var target = targetEndpoints[tIdx];
          var epUrl = target.url;
          var payloads = [];

          if (target.isCoverageOnly) {
            // Direct coverage payloads (tried with POST and PUT)
            payloads = [
              { method: 'POST', body: coverageEntry },
              { method: 'PUT', body: coverageEntry },
              { method: 'POST', body: { coverage: coverageEntry } },
              { method: 'PUT', body: { coverage: coverageEntry } }
            ];
          } else {
            // Container / description payloads (SourceDescriptions)
            var sd1 = {
              id: (liveSd && liveSd.id) || '1',
              about: API_BASE + '/platform/memories/memories/' + memoryId,
              resourceType: 'http://gedcomx.org/DigitalArtifact',
              titles: title ? [{ value: title }] : undefined,
              descriptions: fullDescription ? [{ value: fullDescription }] : undefined,
              coverage: coverageEntry
            };
            var sd2 = Object.assign({}, sd1, { id: memoryId });
            var sd3 = Object.assign({}, sd1, { coverage: [coverageEntry] });
            payloads = [
              { method: 'POST', body: { sourceDescriptions: [sd1] } },
              { method: 'POST', body: { sourceDescriptions: [sd2] } },
              { method: 'POST', body: { sourceDescriptions: [sd3] } }
            ];
          }

          for (var pIdx = 0; pIdx < payloads.length; pIdx++) {
            var item = payloads[pIdx];
            try {
              var pRes = await fetch(epUrl, {
                method: item.method,
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/x-fs-v1+json, application/json'
                },
                body: JSON.stringify(item.body)
              });
              if (!pRes.ok) {
                await fetch(epUrl, {
                  method: item.method,
                  headers: {
                    'Authorization': 'Bearer ' + token.accessToken,
                    'Content-Type': 'application/x-gedcomx-v1+json',
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(item.body)
                });
              }
            } catch (pErr) {}
          }
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

        var personPid = (targetPersonId && (pIdx === 0 || peopleList.length === 1))
          ? targetPersonId
          : (person.fsId || null);

        if (!personPid) {
          var kfMatch = KNOWN_FAMILY.find(function (kf) {
            return kf.name.toLowerCase() === personName.toLowerCase() ||
              (kf.aliases && kf.aliases.some(function (a) { return personName.toLowerCase().includes(a); }));
          });
          if (kfMatch) personPid = kfMatch.id;
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

    // 5. Fallback link of memory to targetPersonId if no personas could be linked
    if (targetPersonId && memoryId && linkedPersonas.length === 0) {
      try {
        var updatePersonUrl = API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId);
        var memoryUri = API_BASE + '/platform/memories/memories/' + memoryId;
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
                id: targetPersonId,
                evidence: [{ resource: memoryUri }]
              }
            ]
          })
        });
      } catch (fallbackLinkErr) {
        console.warn('Fallback tree evidence link notice:', fallbackLinkErr);
      }
    }

    var memoryWebUrl = memoryId ? WEB_BASE + '/memories/memory/' + memoryId : WEB_BASE + '/memories/gallery';
    var personMemoriesUrl = targetPersonId ? WEB_BASE + '/en/tree/person/memories/' + targetPersonId : null;

    onProgress({ step: 'done', message: '✓ Memory saved to FamilySearch Beta!' });

    return {
      success: true,
      memoryId: memoryId,
      memoryUrl: memoryWebUrl,
      personMemoriesUrl: personMemoriesUrl,
      targetPersonId: targetPersonId,
      title: title
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

  async function searchPersons(query) {
    if (!query || !query.trim()) return [];
    var trimmed = query.trim();
    var lower = trimmed.toLowerCase();

    // 1. Check local seeds
    var localMatches = KNOWN_FAMILY.filter(function (f) {
      if (f.id.toLowerCase() === lower) return true;
      if (f.name.toLowerCase().includes(lower) || lower.includes(f.name.toLowerCase())) return true;
      if (f.aliases && f.aliases.some(function (a) { return lower.includes(a) || a.includes(lower); })) return true;
      return false;
    });

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
        return combined;
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
    AUTH_URL: AUTH_URL,
    API_BASE: API_BASE,
    WEB_BASE: WEB_BASE
  };
})(typeof window !== 'undefined' ? window : this);
