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
    } catch (e) {}
  }

  function getRedirectUri() {
    try {
      var override = localStorage.getItem(FS_OVERRIDE_REDIRECT_KEY);
      if (override) return override.trim();
    } catch (e) {}

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
    } catch (e) {}
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
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(17,17,16,0.75);backdrop-filter:blur(4px);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
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
    } catch (e) {}
  }

  function clearToken() {
    try {
      localStorage.removeItem(FS_TOKEN_KEY);
    } catch (e) {}
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

  async function startLogin(overrideUri) {
    var clientId = getClientId();
    var redirectUri = overrideUri || getRedirectUri();
    var codeVerifier = randomString(64);
    var state = randomString(32);
    var codeChallenge = await sha256Base64Url(codeVerifier);

    try {
      sessionStorage.setItem(FS_VERIFIER_KEY, codeVerifier);
      sessionStorage.setItem(FS_STATE_KEY, state);
      sessionStorage.setItem(FS_REDIRECT_KEY, redirectUri);
    } catch (e) {}

    var params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });

    window.location.href = AUTH_URL + '?' + params.toString();
  }

  async function handleCallbackCode(code) {
    var codeVerifier = null;
    var activeRedirect = null;
    try {
      codeVerifier = sessionStorage.getItem(FS_VERIFIER_KEY);
      activeRedirect = sessionStorage.getItem(FS_REDIRECT_KEY);
      sessionStorage.removeItem(FS_VERIFIER_KEY);
      sessionStorage.removeItem(FS_STATE_KEY);
      sessionStorage.removeItem(FS_REDIRECT_KEY);
    } catch (e) {}

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
    var onProgress = options.onProgress || function () {};

    onProgress({ step: 'preparing', message: 'Preparing photo artifact for FamilySearch...' });

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
    // If targetPersonId is specified, we try direct attachment endpoint first, fallback to standard memories endpoint
    var uploadUrl = targetPersonId 
      ? API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId) + '/memories'
      : API_BASE + '/platform/memories/memories';

    var qParams = [];
    if (title) qParams.push('title=' + encodeURIComponent(title));
    if (isoDate) qParams.push('date=' + encodeURIComponent(isoDate));
    if (place) qParams.push('place=' + encodeURIComponent(place));
    if (qParams.length > 0) {
      uploadUrl += (uploadUrl.includes('?') ? '&' : '?') + qParams.join('&');
    }

    var formData = new FormData();
    formData.append('artifact', imageBlob, filename);
    formData.append('title', title);
    if (fullDescription) {
      formData.append('description', fullDescription);
    }
    if (isoDate) {
      formData.append('date', isoDate);
    }
    if (place) {
      formData.append('place', place);
    }

    onProgress({ step: 'uploading', message: 'Uploading to FamilySearch Beta Memories (' + (targetPersonId || 'Gallery') + ')...' });

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
        // Conflict - memory exists
        var loc = uploadRes.headers.get('Location') || '';
        var xId = uploadRes.headers.get('X-entity-id') || '';
        memoryId = xId || (loc ? loc.split('/').pop() : null);
      } else if (targetPersonId && (uploadRes.status === 404 || uploadRes.status === 400 || uploadRes.status === 405 || uploadRes.status === 415)) {
        // Person endpoint not accepted, fallback to universal memories endpoint
        onProgress({ step: 'fallback', message: 'Posting to universal Memories artifact endpoint...' });
        var fallbackUrl = API_BASE + '/platform/memories/memories';
        if (qParams.length > 0) {
          fallbackUrl += '?' + qParams.join('&');
        }
        var fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Accept': 'application/json'
          },
          body: formData
        });
        if (!fallbackRes.ok && fallbackRes.status !== 409) {
          var fbErr = await fallbackRes.text();
          throw new Error('FamilySearch universal upload failed (' + fallbackRes.status + '): ' + fbErr);
        }
        var fbLoc = fallbackRes.headers.get('Location') || '';
        var fbXId = fallbackRes.headers.get('X-entity-id') || '';
        memoryId = fbXId || (fbLoc ? fbLoc.split('/').pop() : null);
      } else {
        var errText = await uploadRes.text();
        throw new Error('FamilySearch upload failed (' + uploadRes.status + '): ' + errText);
      }
    } else {
      var resLoc = uploadRes.headers.get('Location') || '';
      var resXId = uploadRes.headers.get('X-entity-id') || '';
      memoryId = resXId || (resLoc ? resLoc.split('/').pop() : null);
    }

    if (!memoryId && photo.id) {
      memoryId = 'mem_' + Date.now();
    }

    // 1b. Update Memory Date & Place Coverage metadata
    if (memoryId && (isoDate || place)) {
      onProgress({ step: 'coverage', message: 'Saving memory Date (' + (isoDate || 'N/A') + ') and Place (' + (place || 'N/A') + ') to FamilySearch...' });
      try {
        var coverageEntry = {};
        if (isoDate) {
          coverageEntry.temporal = {
            original: isoDate,
            formal: (isoDate.startsWith('+') || isoDate.startsWith('-')) ? isoDate : ('+' + isoDate)
          };
        }
        if (place) {
          coverageEntry.spatial = {
            original: place
          };
          if (photo && typeof photo.lat === 'number' && typeof photo.lng === 'number') {
            coverageEntry.spatial.latitude = photo.lat;
            coverageEntry.spatial.longitude = photo.lng;
          }
        }

        // First attempt: read existing source description structure
        var existingSd = null;
        try {
          var getMemRes = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Accept': 'application/x-fs-v1+json, application/x-gedcomx-v1+json, application/json'
            }
          });
          if (getMemRes.ok) {
            var getMemJson = await getMemRes.json();
            if (getMemJson && getMemJson.sourceDescriptions && getMemJson.sourceDescriptions[0]) {
              existingSd = getMemJson.sourceDescriptions[0];
            }
          }
        } catch (e) {
          // fallback to manual structure
        }

        var sdToUpdate = existingSd || {
          id: memoryId,
          about: API_BASE + '/platform/memories/memories/' + memoryId,
          titles: [{ value: title }],
          descriptions: fullDescription ? [{ value: fullDescription }] : []
        };
        sdToUpdate.coverage = [coverageEntry];

        var updatePayload = {
          sourceDescriptions: [sdToUpdate]
        };

        var postCovRes = await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Content-Type': 'application/x-fs-v1+json',
            'Accept': 'application/x-fs-v1+json, application/json'
          },
          body: JSON.stringify(updatePayload)
        });

        if (!postCovRes.ok) {
          // Retry with standard GEDCOM X content type
          await fetch(API_BASE + '/platform/memories/memories/' + encodeURIComponent(memoryId), {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Content-Type': 'application/x-gedcomx-v1+json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(updatePayload)
          });
        }
      } catch (covErr) {
        console.warn('Memory coverage date/place update notice:', covErr);
      }
    }

    // 2. Attach memory reference to Family Tree person if specified
    if (targetPersonId && memoryId) {
      onProgress({ step: 'linking', message: 'Linking memory to Tree Person ' + targetPersonId + '...' });
      try {
        var updatePersonUrl = API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId);
        var memoryUri = API_BASE + '/platform/memories/memories/' + memoryId;
        var evidencePayload = {
          persons: [
            {
              id: targetPersonId,
              evidence: [
                { resource: memoryUri }
              ]
            }
          ]
        };
        await fetch(updatePersonUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Content-Type': 'application/x-fs-v1+json',
            'Accept': 'application/x-fs-v1+json, application/json'
          },
          body: JSON.stringify(evidencePayload)
        });
      } catch (linkErr) {
        console.warn('Evidence link to tree person notice:', linkErr);
      }

      // Also try person memory references endpoint
      try {
        var refUrl = API_BASE + '/platform/tree/persons/' + encodeURIComponent(targetPersonId) + '/memory-references';
        var refPayload = {
          persons: [
            {
              evidence: [
                { resource: API_BASE + '/platform/memories/memories/' + memoryId }
              ]
            }
          ]
        };
        await fetch(refUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token.accessToken,
            'Content-Type': 'application/x-gedcomx-v1+json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(refPayload)
        });
      } catch (refErr) {
        console.warn('Memory-reference endpoint notice:', refErr);
      }
    }

    // 2b. Auto-scan faces if not yet scanned
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

    // 3. Attach Persona tags to the memory with face bounding box coordinates
    if (people && people.length > 0 && memoryId) {
      onProgress({ step: 'tagging', message: 'Tagging relatives and face positions on FamilySearch memory...' });
      for (var pIdx = 0; pIdx < people.length; pIdx++) {
        var person = people[pIdx];
        var personName = typeof person === 'string' ? person : person.name;
        if (!personName) continue;

        try {
          var assignedFace = null;
          if (faces && faces.length > 0) {
            if (faces.length === 1 && people.length === 1) {
              assignedFace = faces[0];
            } else {
              assignedFace = faces.find(function (f) {
                return f.name && f.name.toLowerCase() === personName.toLowerCase();
              }) || (pIdx === 0 ? faces[0] : null);
            }
          }

          var regionStr = null;
          if (assignedFace && assignedFace.box) {
            var b = assignedFace.box;
            var x1 = Math.max(0, Math.min(1, b.x || 0));
            var y1 = Math.max(0, Math.min(1, b.y || 0));
            var x2 = Math.max(x1, Math.min(1, (b.x || 0) + (b.width || 0.2)));
            var y2 = Math.max(y1, Math.min(1, (b.y || 0) + (b.height || 0.2)));
            regionStr = x1.toFixed(4) + ',' + y1.toFixed(4) + ',' + x2.toFixed(4) + ',' + y2.toFixed(4);
          }

          var personaObj = {
            extracted: true,
            names: [
              {
                nameForms: [
                  { fullText: personName }
                ]
              }
            ]
          };

          if (regionStr) {
            var memoryUri = API_BASE + '/platform/memories/memories/' + memoryId;
            personaObj.media = [
              {
                description: memoryUri,
                qualifiers: [
                  {
                    name: 'http://gedcomx.org/RectangleRegion',
                    value: regionStr
                  }
                ]
              }
            ];
            personaObj.evidence = [
              {
                resource: memoryUri,
                qualifiers: [
                  {
                    name: 'http://gedcomx.org/RectangleRegion',
                    value: regionStr
                  }
                ]
              }
            ];
          }

          if (targetPersonId && (pIdx === 0 || people.length === 1)) {
            personaObj.identifiers = {
              'http://familysearch.org/v1/FamilyTreePerson': [
                'https://familysearch.org/ark:/61903/4:1:' + targetPersonId
              ]
            };
          }

          var personaPayload = {
            persons: [personaObj]
          };

          var tagRes = await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Content-Type': 'application/x-fs-v1+json',
              'Accept': 'application/x-fs-v1+json, application/json'
            },
            body: JSON.stringify(personaPayload)
          });

          // Also attempt artifact-references tag endpoint if region was specified and persona created
          var personaLocation = tagRes.headers.get('Location') || '';
          var personaId = personaLocation ? personaLocation.split('/').pop() : null;
          if (personaId && regionStr) {
            try {
              var artRefPayload = {
                artifactReferences: [
                  {
                    resource: API_BASE + '/platform/memories/memories/' + memoryId,
                    qualifiers: [
                      {
                        name: 'http://gedcomx.org/RectangleRegion',
                        value: regionStr
                      }
                    ]
                  }
                ]
              };
              await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas/' + personaId + '/artifact-references', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token.accessToken,
                  'Content-Type': 'application/x-fs-v1+json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify(artRefPayload)
              });
            } catch (artErr) {
              console.warn('Artifact reference tag notice:', artErr);
            }
          }
        } catch (tagErr) {
          console.warn('Persona tag creation notice:', tagErr);
        }
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
    searchPersons: searchPersons,
    AUTH_URL: AUTH_URL,
    API_BASE: API_BASE,
    WEB_BASE: WEB_BASE
  };
})(typeof window !== 'undefined' ? window : this);
