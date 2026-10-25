/**
 * FamilySearch Memories & Persona Linking Service
 * Handles uploading JPEG artifacts, setting descriptions, and attaching memories to family tree persons.
 */

import { getStoredFamilySearchToken, getFamilySearchConfig } from './familySearchAuth';
import { generateFamilySearchFilename, formatFamilySearchSummary } from './photoMetadata';

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

  return entries.map(entry => {
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
    const errorText = await uploadRes.text();
    throw new Error(`FamilySearch upload failed (${uploadRes.status}): ${errorText}`);
  }

  // Location header or X-entity-id contains the ID of the created memory object
  const memoryLocation = uploadRes.headers.get('Location') || '';
  const entityIdHeader = uploadRes.headers.get('X-entity-id') || '';
  const memoryId = entityIdHeader || (memoryLocation ? memoryLocation.split('/').pop() : null);

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
export async function attachMemoryToFamilySearchPerson(personId, memoryId) {
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('Not logged in to FamilySearch');
  if (!personId || !memoryId) throw new Error('Missing person ID or memory ID');

  const config = getFamilySearchConfig();
  const attachUrl = `${config.apiBase}/platform/tree/persons/${personId}/memory-references`;

  const payload = {
    persons: [
      {
        evidence: [
          {
            resource: `${config.apiBase}/platform/memories/memories/${memoryId}`
          }
        ]
      }
    ]
  };

  const response = await fetch(attachUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.accessToken}`,
      'Content-Type': 'application/x-gedcomx-v1+json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Could not attach memory to person ${personId} (${response.status}): ${errText}`);
  }

  return true;
}

/**
 * Creates memory personas with face bounding box coordinates and attaches them to Tree persons.
 * @param {string} memoryId - FamilySearch Memory ID
 * @param {Array} tags - Array of { name, faceBox, treePersonId }
 * @param {function} onProgress - Progress reporter
 */
export async function attachPersonTagsToMemory(memoryId, tags, onProgress = null) {
  if (!memoryId || !tags || tags.length === 0) return [];
  const token = getStoredFamilySearchToken();
  if (!token) throw new Error('Not logged in to FamilySearch');
  const config = getFamilySearchConfig();

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
      // 1. Create persona with bounding box on the memory artifact
      const personaPayload = {
        persons: [
          {
            names: [
              {
                nameForms: [
                  {
                    fullText: tag.name || 'Relative'
                  }
                ]
              }
            ]
          }
        ]
      };

      if (tag.treePersonId) {
        personaPayload.persons[0].identifiers = {
          'http://gedcomx.org/Persistent': [
            `${config.apiBase}/platform/tree/persons/${tag.treePersonId}`
          ]
        };
      }

      if (tag.faceBox) {
        personaPayload.persons[0].media = [
          {
            resource: `${config.apiBase}/platform/memories/memories/${memoryId}`,
            qualifiers: [
              { name: 'http://familysearch.org/v1/x', value: String(Number(tag.faceBox.x || 0).toFixed(4)) },
              { name: 'http://familysearch.org/v1/y', value: String(Number(tag.faceBox.y || 0).toFixed(4)) },
              { name: 'http://familysearch.org/v1/width', value: String(Number(tag.faceBox.width || 0.1).toFixed(4)) },
              { name: 'http://familysearch.org/v1/height', value: String(Number(tag.faceBox.height || 0.1).toFixed(4)) }
            ]
          }
        ];
      }

      const personaRes = await fetch(`${config.apiBase}/platform/memories/memories/${memoryId}/personas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/x-gedcomx-v1+json',
          'Accept': 'application/x-gedcomx-v1+json, application/json'
        },
        body: JSON.stringify(personaPayload)
      });

      const personaLocation = personaRes.headers.get('Location') || '';
      const personaId = personaLocation ? personaLocation.split('/').pop() : null;

      // 2. Attach memory to Tree Person if treePersonId provided
      if (tag.treePersonId) {
        try {
          await attachMemoryToFamilySearchPerson(tag.treePersonId, memoryId);
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
      console.warn(`Could not tag ${tag.name}:`, err);
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
