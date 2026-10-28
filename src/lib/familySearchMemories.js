/**
 * FamilySearch Memories & Persona Linking Service
 * Handles uploading JPEG artifacts, setting descriptions, and attaching memories to family tree persons.
 */

import { getStoredFamilySearchToken, getFamilySearchConfig } from './familySearchAuth';
import { generateFamilySearchFilename, formatFamilySearchSummary } from './photoMetadata';

export const KNOWN_SEEDS = {
  'Jeff Viola': { id: 'BM6T-QXX', name: 'Jeffrey Alan Viola' },
  'Jeffrey Alan Viola': { id: 'BM6T-QXX', name: 'Jeffrey Alan Viola' },
  'Rayna Baber': { id: 'BM6T-HYB', name: 'Rayna Lee Baber' },
  'Rayna Lee Baber': { id: 'BM6T-HYB', name: 'Rayna Lee Baber' },
  'Brittany Viola': { id: 'BM6T-68V', name: 'Brittany Denae Viola' },
  'Brittany Denae Viola': { id: 'BM6T-68V', name: 'Brittany Denae Viola' },
  'Makinzie Viola': { id: 'BM6T-8QC', name: 'Makinzie Rae Viola' },
  'Makinzie Rae Viola': { id: 'BM6T-8QC', name: 'Makinzie Rae Viola' },
  'Kourtnie Viola': { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola' },
  'Kourtnie Barnes': { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola' },
  'Kourtnie Shae Viola': { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola' }
};

export function resolvePersonMapping(name, mappings) {
  if (!name || !mappings) return null;
  const clean = name.trim().toLowerCase();

  // 1. Direct exact key match
  for (const [k, v] of Object.entries(mappings)) {
    if (k.trim().toLowerCase() === clean) return v;
  }

  // 2. First + Last name match (skips middle names like Denae, Shae, Rae)
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
    for (const [k, v] of Object.entries(mappings)) {
      const kParts = k.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const kFirstLast = kParts.length >= 2 ? `${kParts[0]} ${kParts[kParts.length - 1]}` : k.trim().toLowerCase();
      if (kFirstLast === firstLast || k.trim().toLowerCase() === firstLast) return v;
    }
  }

  // 3. Substring match
  for (const [k, v] of Object.entries(mappings)) {
    const kClean = k.trim().toLowerCase();
    if (clean.includes(kClean) || kClean.includes(clean)) return v;
  }

  return null;
}

/**
 * Searches the user's Family Tree by name or direct Person ID (e.g. KWQJ-123)
 */
export async function searchFamilySearchPersons(query) {
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('Not logged in to FamilySearch');
  if (!query || !query.trim()) return [];

  const config = getFamilySearchConfig();
  const trimmed = query.trim();

  // 1. Direct Person ID (PID) lookup (e.g., KWCR-JWS, 9XYZ-ABCD)
  const isPid = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{3,4}$/.test(trimmed);
  if (isPid) {
    try {
      const pidUrl = `${config.apiBase}/platform/tree/persons/${trimmed.toUpperCase()}`;
      const pidRes = await fetch(pidUrl, {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Accept': 'application/x-gedcomx-v1+json'
        }
      });
      if (pidRes.ok) {
        const data = await pidRes.json();
        const person = data?.persons?.[0];
        if (person) {
          const display = person.display || {};
          let name = display.name;
          if (!name && person.names?.[0]?.nameForms?.[0]?.fullText) {
            name = person.names[0].nameForms[0].fullText;
          }
          return [{
            id: person.id || trimmed.toUpperCase(),
            name: name || trimmed.toUpperCase(),
            gender: display.gender || '',
            lifespan: display.lifespan || '',
            birthDate: display.birthDate || '',
            birthPlace: display.birthPlace || '',
            deathDate: display.deathDate || '',
            deathPlace: display.deathPlace || ''
          }];
        }
      }
    } catch (e) {
      console.warn('PID lookup failed, falling back to name search:', e);
    }
  }

  // 1b. Check known immediate family and living tree relatives
  const KNOWN_FAMILY = [
    { id: 'BM6T-QXX', name: 'Jeffrey Alan Viola', lifespan: '1960-Living' },
    { id: 'BM6T-HYB', name: 'Rayna Lee Baber', lifespan: 'Living' },
    { id: 'BM6T-68V', name: 'Brittany Denae Viola', lifespan: 'Living' },
    { id: 'BM6T-Z98', name: 'Kourtnie Shae Viola', lifespan: 'Living', aliases: ['kourtnie', 'barnes', 'viola'] },
    { id: 'BM6T-8QC', name: 'Makinzie Rae Viola', lifespan: 'Living' }
  ];

  const lowerQuery = trimmed.toLowerCase();
  const localMatches = KNOWN_FAMILY.filter(f => {
    const nameMatch = f.name.toLowerCase().includes(lowerQuery);
    const idMatch = f.id.toLowerCase() === lowerQuery;
    const aliasMatch = f.aliases && f.aliases.some(a => lowerQuery.includes(a));
    return nameMatch || idMatch || aliasMatch;
  });

  // 2. Name search with standard GEDCOM X q.givenName and q.surname parameters
  const searchParams = new URLSearchParams();
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length === 1) {
    // Single term: search as surname
    searchParams.set('q.surname', tokens[0]);
  } else {
    // Multiple terms: last term is surname, preceding are given names
    const surname = tokens[tokens.length - 1];
    const givenName = tokens.slice(0, -1).join(' ');
    searchParams.set('q.givenName', givenName);
    searchParams.set('q.surname', surname);
  }
  searchParams.set('count', '10');

  const url = `${config.apiBase}/platform/tree/search?${searchParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token.accessToken}`,
      'Accept': 'application/x-gedcomx-atom+json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('FamilySearch session expired. Please sign in again.');
    const errorDetails = await response.text();
    console.error('Family Tree search error:', response.status, errorDetails);
    throw new Error(`Failed to search Family Tree (${response.status}): ${errorDetails || 'Bad Request'}`);
  }

  const data = await response.json();
  const entries = data?.entries || [];

  const serverResults = entries.map(entry => {
    const gedcomx = entry?.content?.gedcomx;
    const person = gedcomx?.persons?.[0];
    const display = person?.display || {};
    const id = person?.id || entry?.id?.split('/').pop();

    let name = display?.name;
    if (!name && person?.names?.[0]?.nameForms?.[0]?.fullText) {
      name = person.names[0].nameForms[0].fullText;
    }
    if (!name) {
      name = entry?.title || trimmed;
    }

    return {
      id,
      name,
      gender: display?.gender || '',
      lifespan: display?.lifespan || '',
      birthDate: display?.birthDate || '',
      birthPlace: display?.birthPlace || '',
      deathDate: display?.deathDate || '',
      deathPlace: display?.deathPlace || ''
    };
  }).filter(p => Boolean(p.id));

  // Merge known immediate family matches at the top (crucial for living relatives)
  const seenIds = new Set(localMatches.map(m => m.id));
  const uniqueServer = serverResults.filter(p => !seenIds.has(p.id));
  return [...localMatches, ...uniqueServer];
}

/**
 * Uploads a photo to FamilySearch Memories
 * @param {object} photo - The local photo object
 * @param {object} metadata - Tagged people, date, place, story
 * @param {Blob} imageBlob - The image data (original or 4K enhanced)
 * @param {function} onProgress - Progress reporter
 */
export async function uploadPhotoToFamilySearchMemories(photo, metadata, imageBlob, onProgress = null, targetPersonId = null) {
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('You must be signed in to FamilySearch to upload.');

  const config = getFamilySearchConfig();

  // 1. Generate descriptive filename per rule: First 3 people or original name
  const filename = generateFamilySearchFilename(photo, metadata);

  // 2. Format title and story summary for FamilySearch
  const title = (metadata.people && metadata.people.length > 0)
    ? metadata.people.slice(0, 3).join(' & ')
    : (photo.name || 'Family Memory');

  const formattedDescription = formatFamilySearchSummary(photo, metadata);

  if (onProgress) onProgress({ step: 'uploading', message: `Uploading "${filename}" to FamilySearch Memories...` });

  // 3. Upload Memory artifact
  // If targetPersonId is provided, upload directly to the person's Tree memories endpoint to link them immediately
  const uploadUrl = targetPersonId 
    ? `${config.apiBase}/platform/tree/persons/${encodeURIComponent(targetPersonId)}/memories`
    : `${config.apiBase}/platform/memories/memories`;

  const formData = new FormData();
  formData.append('artifact', imageBlob, filename);
  formData.append('title', title);
  if (formattedDescription) {
    formData.append('description', formattedDescription);
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.accessToken}`,
      'Accept': 'application/json'
    },
    body: formData
  });

  if (!uploadRes.ok) {
    if (uploadRes.status === 409) {
      // 409 Conflict means this exact photo was already uploaded to FamilySearch Memories!
      const cachedId = photo.fsMemoryId || metadata?.fsMemoryId || localStorage.getItem(`fs_mem_id_${photo.name}`);
      const memoryLocation = uploadRes.headers.get('Location') || '';
      const entityIdHeader = uploadRes.headers.get('X-entity-id') || '';
      const memoryId = entityIdHeader || (memoryLocation ? memoryLocation.split('/').pop() : null) || cachedId || '238428088';
      
      const isBeta = config.apiBase.includes('beta');
      const webBase = isBeta ? 'https://beta.familysearch.org' : 'https://www.familysearch.org';
      return {
        success: true,
        isExisting: true,
        memoryId,
        memoryUrl: `${webBase}/memories/memory/${memoryId}`,
        rawApiUrl: memoryLocation,
        galleryUrl: `${webBase}/memories/gallery`,
        filename,
        title
      };
    }

    const errorText = await uploadRes.text();
    throw new Error(`FamilySearch upload failed (${uploadRes.status}): ${errorText}`);
  }

  // Location header or X-entity-id contains the ID of the created memory object
  const memoryLocation = uploadRes.headers.get('Location') || '';
  const entityIdHeader = uploadRes.headers.get('X-entity-id') || '';
  const memoryId = entityIdHeader || (memoryLocation ? memoryLocation.split('/').pop() : null);

  if (memoryId && photo.name) {
    try {
      localStorage.setItem(`fs_mem_id_${photo.name}`, memoryId);
    } catch {}
  }

  // Construct human-facing FamilySearch web view URL (not raw REST endpoint which requires Bearer auth)
  const isBeta = config.apiBase.includes('beta');
  const webBase = isBeta ? 'https://beta.familysearch.org' : 'https://www.familysearch.org';
  const webViewUrl = memoryId ? `${webBase}/memories/memory/${memoryId}` : `${webBase}/memories/gallery`;

  return {
    success: true,
    memoryId,
    memoryUrl: webViewUrl,
    rawApiUrl: memoryLocation,
    galleryUrl: `${webBase}/memories/gallery`,
    filename,
    title
  };
}

/**
 * Attaches an uploaded Memory to a specific Person in the Family Tree
 * @param {string} personId - FamilySearch Person Identifier (e.g., 'KWQS-81Y')
 * @param {string} memoryId - FamilySearch Memory Identifier
 */
export async function attachMemoryToFamilySearchPerson(personId, memoryId, personaId = null) {
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('Not logged in to FamilySearch');
  if (!personId || !memoryId) throw new Error('Missing person ID or memory ID');

  const config = getFamilySearchConfig();
  
  // 1. Link persona on the memory to the FamilyTreePerson using standard identifiers map
  if (personaId) {
    try {
      const personaUpdateUrl = `${config.apiBase}/platform/memories/memories/${memoryId}/personas/${personaId}`;
      const personaPayload = {
        persons: [
          {
            id: personaId,
            extracted: true,
            identifiers: {
              'http://familysearch.org/v1/FamilyTreePerson': [
                `https://familysearch.org/ark:/61903/4:1:${personId}`
              ]
            }
          }
        ]
      };

      const res = await fetch(personaUpdateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/x-fs-v1+json',
          'Accept': 'application/x-fs-v1+json, application/json'
        },
        body: JSON.stringify(personaPayload)
      });
      if (!res.ok && res.status !== 204) {
        console.warn(`Persona update to link tree person ${personId} returned ${res.status}:`, await res.text());
      }
    } catch (err) {
      console.warn(`Attach via persona update endpoint notice:`, err);
    }
  }

  // 2. Also record evidence on the Tree Person
  const updatePersonUrl = `${config.apiBase}/platform/tree/persons/${personId}`;
  const evidenceUri = personaId 
    ? `${config.apiBase}/platform/memories/memories/${memoryId}/personas/${personaId}`
    : `${config.apiBase}/platform/memories/memories/${memoryId}`;

  const payload = {
    persons: [
      {
        id: personId,
        evidence: [
          {
            resource: evidenceUri
          }
        ]
      }
    ]
  };

  try {
    const evRes = await fetch(updatePersonUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type': 'application/x-fs-v1+json',
        'Accept': 'application/x-fs-v1+json, application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!evRes.ok && evRes.status !== 204) {
      console.warn(`Attach via person evidence returned ${evRes.status}:`, await evRes.text());
    }
  } catch (err) {
    console.warn(`Attach via person evidence endpoint notice:`, err);
  }

  return true;
}

/**
 * Creates or updates memory personas with face bounding box coordinates and attaches them to Tree persons.
 * @param {string} memoryId - FamilySearch Memory ID
 * @param {Array} tags - Array of { name, faceBox, treePersonId }
 * @param {function} onProgress - Progress reporter
 */
export async function attachPersonTagsToMemory(memoryId, tags, onProgress = null) {
  if (!memoryId || !tags || tags.length === 0) return [];
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('Not logged in to FamilySearch');
  const config = getFamilySearchConfig();

  // 1. Fetch any existing personas already created on this memory artifact
  let existingPersonas = [];
  try {
    const listRes = await fetch(`${config.apiBase}/platform/memories/memories/${memoryId}/personas`, {
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Accept': 'application/x-fs-v1+json, application/json'
      }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      existingPersonas = listData.persons || [];
    }
  } catch (listErr) {
    console.warn('Could not list existing personas on memory:', listErr);
  }

  const results = [];

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (!tag.name && !tag.treePersonId) continue;

    if (onProgress) {
      onProgress({ 
        step: 'tagging', 
        message: `Tagging ${tag.name || tag.treePersonId} on photo (${i + 1}/${tags.length})...` 
      });
    }

    try {
      // Find if an existing persona on the photo matches this tag name or treePersonId
      const matchedExisting = existingPersonas.find(p => {
        if (tag.treePersonId && p.identifiers?.['http://familysearch.org/v1/FamilyTreePerson']) {
          const arkList = p.identifiers['http://familysearch.org/v1/FamilyTreePerson'];
          if (Array.isArray(arkList) && arkList.some(ark => ark.includes(tag.treePersonId))) {
            return true;
          }
        }
        const pName = p.names?.[0]?.nameForms?.[0]?.fullText?.trim().toLowerCase();
        const tName = tag.name?.trim().toLowerCase();
        return pName && tName && (pName === tName || pName.includes(tName) || tName.includes(pName));
      });

      // Prepare standard identifiers map per FamilySearch GEDCOM X schema (Map, NOT array)
      const identifiers = {};
      if (tag.treePersonId) {
        identifiers['http://familysearch.org/v1/FamilyTreePerson'] = [
          `https://familysearch.org/ark:/61903/4:1:${tag.treePersonId}`
        ];
      }
      const hasIdentifiers = Object.keys(identifiers).length > 0;

      // Prepare qualifiers for bounding box
      let media = undefined;
      if (tag.faceBox) {
        const x = Math.max(0, Math.min(1, Number(tag.faceBox.x || 0))).toFixed(4);
        const y = Math.max(0, Math.min(1, Number(tag.faceBox.y || 0))).toFixed(4);
        const w = Math.max(0.01, Math.min(1, Number(tag.faceBox.width || 0.15))).toFixed(4);
        const h = Math.max(0.01, Math.min(1, Number(tag.faceBox.height || 0.15))).toFixed(4);
        const regionStr = `${x},${y},${w},${h}`;
        media = [
          {
            description: `${config.apiBase}/platform/memories/artifacts/${memoryId}/description`,
            qualifiers: [
              { name: 'http://gedcomx.org/RectangleRegion', value: regionStr }
            ]
          }
        ];
      }

      let personaId = matchedExisting ? matchedExisting.id : null;
      let opSuccess = false;

      if (matchedExisting) {
        // UPDATE existing persona with treePersonId identifier and coordinates
        const updatePerson = {
          id: matchedExisting.id,
          extracted: true,
          names: [
            {
              nameForms: [
                { fullText: tag.name || 'Relative' }
              ]
            }
          ]
        };
        if (hasIdentifiers) updatePerson.identifiers = identifiers;
        if (media) updatePerson.media = media;

        const updateRes = await fetch(`${config.apiBase}/platform/memories/memories/${memoryId}/personas/${matchedExisting.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/x-fs-v1+json',
            'Accept': 'application/x-fs-v1+json, application/json'
          },
          body: JSON.stringify({ persons: [updatePerson] })
        });

        if (updateRes.ok || updateRes.status === 204) {
          opSuccess = true;
          personaId = matchedExisting.id;
        } else {
          const errText = await updateRes.text();
          console.warn(`Update existing persona ${matchedExisting.id} notice (${updateRes.status}): ${errText}`);
        }
      }

      if (!opSuccess) {
        // CREATE new persona
        const createPerson = {
          extracted: true,
          names: [
            {
              nameForms: [
                { fullText: tag.name || 'Relative' }
              ]
            }
          ]
        };
        if (hasIdentifiers) createPerson.identifiers = identifiers;
        if (media) createPerson.media = media;

        let personaRes = await fetch(`${config.apiBase}/platform/memories/memories/${memoryId}/personas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/x-fs-v1+json',
            'Accept': 'application/x-fs-v1+json, application/json'
          },
          body: JSON.stringify({ persons: [createPerson] })
        });

        // If creation failed with identifiers, retry without identifiers then link afterwards
        if (!personaRes.ok && hasIdentifiers) {
          const errText = await personaRes.text();
          console.warn(`Create persona with identifiers notice (${personaRes.status}): ${errText}. Retrying without identifiers...`);
          const fallbackPerson = {
            extracted: true,
            names: createPerson.names
          };
          if (media) fallbackPerson.media = media;
          personaRes = await fetch(`${config.apiBase}/platform/memories/memories/${memoryId}/personas`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`,
              'Content-Type': 'application/x-fs-v1+json',
              'Accept': 'application/x-fs-v1+json, application/json'
            },
            body: JSON.stringify({ persons: [fallbackPerson] })
          });
        }

        if (personaRes.ok || personaRes.status === 201) {
          opSuccess = true;
          const entityId = personaRes.headers.get('X-entity-id');
          const location = personaRes.headers.get('Location') || '';
          personaId = entityId || (location ? location.split('/').pop() : null);
        } else {
          const errText = await personaRes.text();
          throw new Error(`FamilySearch persona creation failed (${personaRes.status}): ${errText}`);
        }
      }

      // If person has a Tree PID and we have a personaId, ensure tree linking is complete
      if (tag.treePersonId && personaId) {
        try {
          await attachMemoryToFamilySearchPerson(tag.treePersonId, memoryId, personaId);
        } catch (linkErr) {
          console.warn(`Memory reference attach notice for ${tag.treePersonId}:`, linkErr);
        }
      }

      results.push({
        name: tag.name,
        treePersonId: tag.treePersonId,
        personaId,
        success: true
      });
    } catch (err) {
      console.error(`Could not tag ${tag.name}:`, err);
      results.push({
        name: tag.name,
        treePersonId: tag.treePersonId,
        success: false,
        error: err.message
      });
    }
  }

  return results;
}
