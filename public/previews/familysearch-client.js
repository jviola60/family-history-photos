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

  function getRedirectUri() {
    try {
      var override = localStorage.getItem(FS_OVERRIDE_REDIRECT_KEY);
      if (override) return override.trim();
    } catch (e) {}

    if (typeof window !== 'undefined' && window.location) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin; // e.g. http://localhost:5173
      }
      // GitHub Pages production URL
      var clean = window.location.origin + window.location.pathname;
      return clean.endsWith('/') ? clean : clean + '/';
    }
    return 'https://jviola60.github.io/family-history-photos/';
  }

  function setRedirectUri(uri) {
    try {
      if (!uri) localStorage.removeItem(FS_OVERRIDE_REDIRECT_KEY);
      else localStorage.setItem(FS_OVERRIDE_REDIRECT_KEY, uri.trim());
    } catch (e) {}
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

    var formData = new FormData();
    formData.append('artifact', imageBlob, filename);
    formData.append('title', title);
    if (fullDescription) {
      formData.append('description', fullDescription);
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
        var fallbackRes = await fetch(API_BASE + '/platform/memories/memories', {
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

    // 3. Attach Persona tags to the memory
    if (people && people.length > 0 && memoryId) {
      onProgress({ step: 'tagging', message: 'Tagging relatives on FamilySearch memory...' });
      for (var pIdx = 0; pIdx < people.length; pIdx++) {
        var person = people[pIdx];
        var personName = typeof person === 'string' ? person : person.name;
        if (!personName) continue;

        try {
          var personaPayload = {
            persons: [
              {
                extracted: true,
                names: [
                  {
                    nameForms: [
                      { fullText: personName }
                    ]
                  }
                ]
              }
            ]
          };

          if (targetPersonId && (pIdx === 0 || people.length === 1)) {
            personaPayload.persons[0].identifiers = {
              'http://familysearch.org/v1/FamilyTreePerson': [
                'https://familysearch.org/ark:/61903/4:1:' + targetPersonId
              ]
            };
          }

          await fetch(API_BASE + '/platform/memories/memories/' + memoryId + '/personas', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token.accessToken,
              'Content-Type': 'application/x-fs-v1+json',
              'Accept': 'application/x-fs-v1+json, application/json'
            },
            body: JSON.stringify(personaPayload)
          });
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
    getRedirectUri: getRedirectUri,
    setRedirectUri: setRedirectUri,
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
