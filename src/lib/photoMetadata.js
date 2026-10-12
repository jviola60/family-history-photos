/**
 * photoMetadata.js
 * 
 * Standards-compliant XMP & IPTC metadata embedding and extraction for JPEG photos.
 * Conforms to Family History Metadata Working Group (FHMWG) and FamilySearch.org standards:
 * - Title (dc:title)
 * - Description & Memories (dc:description)
 * - Date Created (photoshop:DateCreated / dc:date)
 * - Location (Iptc4xmpCore:Location)
 * - People in Photo (iptcExt:PersonInImage & dc:subject)
 * - Family Branch / Submitter (photoshop:Credit)
 */

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an ISO-standard XMP packet for genealogical preservation
 */
export function generateXmpPacket({ title, story, people = [], date, location, familyBranch, decade }) {
  const safeTitle = escapeXml(title || '');
  const safeStory = escapeXml(story || '');
  const safeDate = escapeXml(date || decade || '');
  const safeLocation = escapeXml(location || '');
  const safeBranch = escapeXml(familyBranch || '');

  const subjects = [...new Set([
    ...people,
    decade,
    familyBranch
  ].filter(Boolean))];

  const subjectXml = subjects.map(s => `<rdf:li>${escapeXml(s)}</rdf:li>`).join('\n     ');
  const peopleXml = people.map(p => `<rdf:li>${escapeXml(p)}</rdf:li>`).join('\n     ');

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Family History Photos">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://photoshop.com/s/1.0/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
    xmlns:iptcExt="http://iptc.org/std/iptc-extension/2008-02-29/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${safeTitle}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${safeStory}</rdf:li>
    </rdf:Alt>
   </dc:description>
   ${subjects.length > 0 ? `<dc:subject>
    <rdf:Bag>
     ${subjectXml}
    </rdf:Bag>
   </dc:subject>` : ''}
   ${people.length > 0 ? `<iptcExt:PersonInImage>
    <rdf:Bag>
     ${peopleXml}
    </rdf:Bag>
   </iptcExt:PersonInImage>` : ''}
   ${safeDate ? `<photoshop:DateCreated>${safeDate}</photoshop:DateCreated>` : ''}
   ${safeLocation ? `<Iptc4xmpCore:Location>${safeLocation}</Iptc4xmpCore:Location>` : ''}
   ${safeBranch ? `<photoshop:Credit>${safeBranch}</photoshop:Credit>` : ''}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Embeds XMP metadata packet into a JPEG Uint8Array without altering pixels
 */
export function embedXmpInJpeg(uint8Array, metadata) {
  if (uint8Array[0] !== 0xFF || uint8Array[1] !== 0xD8) {
    throw new Error('Not a valid JPEG file (missing SOI 0xFFD8 marker)');
  }

  const encoder = new TextEncoder();
  const xmpPacketStr = generateXmpPacket(metadata);
  const xmpBytes = encoder.encode(xmpPacketStr);
  
  // XMP namespace identifier: "http://ns.adobe.com/xap/1.0/\0" (29 bytes)
  const nsString = 'http://ns.adobe.com/xap/1.0/\0';
  const nsBytes = encoder.encode(nsString);
  
  const payloadLen = 2 + nsBytes.length + xmpBytes.length; // includes 2 bytes for length
  if (payloadLen > 65535) {
    throw new Error('XMP metadata packet exceeds maximum JPEG segment size (64KB)');
  }

  const xmpSegment = new Uint8Array(2 + payloadLen);
  xmpSegment[0] = 0xFF;
  xmpSegment[1] = 0xE1;
  xmpSegment[2] = (payloadLen >> 8) & 0xFF;
  xmpSegment[3] = payloadLen & 0xFF;
  xmpSegment.set(nsBytes, 4);
  xmpSegment.set(xmpBytes, 4 + nsBytes.length);

  // Scan JPEG segments and skip any existing XMP APP1 segments
  const chunks = [];
  chunks.push(uint8Array.subarray(0, 2)); // SOI (0xFF 0xD8)
  
  let pos = 2;
  const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);

  while (pos < uint8Array.length - 1) {
    if (uint8Array[pos] !== 0xFF) break;
    const marker = uint8Array[pos + 1];

    // SOS (Start of Scan) or EOI: start of compressed pixel data
    if (marker === 0xDA || marker === 0xD9) {
      break;
    }

    // Standalone markers without length: RST, SOI, TEM
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      pos += 2;
      continue;
    }

    const segLen = view.getUint16(pos + 2, false);
    const segEnd = pos + 2 + segLen;

    let isExistingXmp = false;
    if (marker === 0xE1 && segLen >= 31) {
      // Check namespace: "http://ns.adobe.com/xap/1.0/"
      const headerBytes = uint8Array.subarray(pos + 4, pos + 4 + 28);
      const headerStr = new TextDecoder().decode(headerBytes);
      if (headerStr === 'http://ns.adobe.com/xap/1.0/') {
        isExistingXmp = true;
      }
    }

    if (!isExistingXmp) {
      chunks.push(uint8Array.subarray(pos, segEnd));
    }

    pos = segEnd;
  }

  // Insert xmpSegment after SOI or after existing JFIF/Exif segment
  if (chunks.length > 1 && (chunks[1][1] === 0xE0 || chunks[1][1] === 0xE1)) {
    chunks.splice(2, 0, xmpSegment);
  } else {
    chunks.splice(1, 0, xmpSegment);
  }

  // Remainder of file (from SOS to EOI)
  chunks.push(uint8Array.subarray(pos));

  // Assemble resulting Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Extracts raw XMP XML string from a JPEG Uint8Array if present
 */
export function extractXmpFromJpeg(uint8Array) {
  if (uint8Array[0] !== 0xFF || uint8Array[1] !== 0xD8) return null;
  let pos = 2;
  const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);

  while (pos < uint8Array.length - 1) {
    if (uint8Array[pos] !== 0xFF) break;
    const marker = uint8Array[pos + 1];
    if (marker === 0xDA || marker === 0xD9) break;
    if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      pos += 2;
      continue;
    }
    const segLen = view.getUint16(pos + 2, false);
    const segEnd = pos + 2 + segLen;

    if (marker === 0xE1 && segLen >= 31) {
      const headerBytes = uint8Array.subarray(pos + 4, pos + 4 + 28);
      const headerStr = new TextDecoder().decode(headerBytes);
      if (headerStr === 'http://ns.adobe.com/xap/1.0/') {
        const xmpBytes = uint8Array.subarray(pos + 4 + 29, segEnd);
        return new TextDecoder().decode(xmpBytes);
      }
    }
    pos = segEnd;
  }
  return null;
}

/**
 * Parses XMP XML into structured JavaScript metadata object
 */
export function parseXmpXml(xmpXmlString) {
  if (!xmpXmlString) return null;

  try {
    if (typeof window !== 'undefined' && window.DOMParser) {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(xmpXmlString, 'application/xml');

      const getText = (selector) => {
        const el = doc.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };

      const getList = (selector) => {
        const els = doc.querySelectorAll(selector);
        return Array.from(els).map(el => el.textContent.trim()).filter(Boolean);
      };

      const title = getText('title li, dc\\:title li');
      const story = getText('description li, dc\\:description li');
      const date = getText('DateCreated, photoshop\\:DateCreated, date li, dc\\:date li');
      const location = getText('Location, Iptc4xmpCore\\:Location');
      const familyBranch = getText('Credit, photoshop\\:Credit');
      
      let people = getList('PersonInImage li, iptcExt\\:PersonInImage li');
      const subjects = getList('subject li, dc\\:subject li');
      
      // If people list was empty but subjects has items, check subjects
      if (people.length === 0 && subjects.length > 0) {
        // filter out decades like 1970s
        people = subjects.filter(s => !/^\d{4}s?$/.test(s));
      }

      // Check decade
      let decade = '';
      const decadeMatch = (date || subjects.join(' ')).match(/\b(18\d0|19\d0|20\d0)s?\b/);
      if (decadeMatch) {
        decade = `${decadeMatch[1]}s`;
      }

      return {
        title,
        story,
        people,
        date,
        decade,
        location,
        familyBranch,
        tags: subjects
      };
    }
  } catch (err) {
    console.warn('DOMParser failed on XMP, falling back to regex:', err);
  }

  // Regex fallback
  const extractText = (tag) => {
    const m = xmpXmlString.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (!m) return '';
    const liMatch = m[1].match(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i);
    return (liMatch ? liMatch[1] : m[1]).trim();
  };

  const extractList = (tag) => {
    const m = xmpXmlString.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (!m) return [];
    const items = [];
    const regex = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi;
    let match;
    while ((match = regex.exec(m[1])) !== null) {
      if (match[1]) items.push(match[1].trim());
    }
    return items;
  };

  return {
    title: extractText('(?:dc:)?title'),
    story: extractText('(?:dc:)?description'),
    date: extractText('(?:photoshop:)?DateCreated'),
    location: extractText('(?:Iptc4xmpCore:)?Location'),
    people: extractList('(?:iptcExt:)?PersonInImage'),
    tags: extractList('(?:dc:)?subject')
  };
}

/**
 * Extracts metadata from a File object by reading only its header slice (fast & lightweight)
 */
export async function extractMetadataFromFile(file) {
  if (!file) return null;
  try {
    // Read first 128 KB where JPEG headers (APP0, APP1 XMP) reside
    const slice = file.slice(0, Math.min(file.size, 131072));
    const arrayBuffer = await slice.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const xmpStr = extractXmpFromJpeg(uint8);
    if (!xmpStr) return null;
    return parseXmpXml(xmpStr);
  } catch (err) {
    console.warn('Could not extract metadata from file slice:', err);
    return null;
  }
}

/**
 * Directly writes embedded XMP metadata into the physical file on disk via FileSystemFileHandle
 */
export async function writeMetadataToPhotoHandle(fileHandle, metadata) {
  if (!fileHandle || typeof fileHandle.createWritable !== 'function') return false;
  try {
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const updated = embedXmpInJpeg(uint8, metadata);
    const writable = await fileHandle.createWritable();
    await writable.write(updated);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Could not write embedded metadata to file handle:', err);
    return false;
  }
}

/**
 * Downloads a JPEG with embedded metadata baked in
 */
export async function downloadPhotoWithEmbeddedMetadata(photo, metadata) {
  try {
    let arrayBuffer = null;
    if (photo.handle && typeof photo.handle.getFile === 'function') {
      const file = await photo.handle.getFile();
      arrayBuffer = await file.arrayBuffer();
    } else if (photo.objectUrl) {
      const resp = await fetch(photo.objectUrl);
      arrayBuffer = await resp.arrayBuffer();
    }

    if (!arrayBuffer) {
      throw new Error('Unable to read photo data to embed metadata');
    }

    const uint8 = new Uint8Array(arrayBuffer);
    const updated = embedXmpInJpeg(uint8, {
      title: photo.name,
      story: metadata.story,
      people: metadata.people,
      date: metadata.date,
      decade: metadata.decade,
      location: metadata.location,
      familyBranch: metadata.familyBranch
    });

    const blob = new Blob([updated], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Auto-generate descriptive name for FamilySearch (e.g. Arthur_Viola_Rose_Viola_1974.jpg)
    a.download = generateFamilySearchFilename(photo, metadata);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to download photo with embedded metadata:', err);
    return false;
  }
}

/**
 * Creates clean, descriptive filename suitable for FamilySearch "Use file names as titles"
 */
export function generateFamilySearchFilename(photo, metadata = {}) {
  const parts = [];
  
  if (metadata.people && metadata.people.length > 0) {
    // Up to 3 names
    const names = metadata.people.slice(0, 3).map(p => p.trim().replace(/[^a-zA-Z0-9]/g, '_'));
    parts.push(names.join('_and_'));
  }
  
  if (metadata.date || metadata.decade) {
    const d = (metadata.date || metadata.decade).trim().replace(/[^a-zA-Z0-9]/g, '_');
    parts.push(d);
  }
  
  if (metadata.location) {
    const loc = metadata.location.split(',')[0].trim().replace(/[^a-zA-Z0-9]/g, '_');
    if (loc) parts.push(loc);
  }

  if (parts.length > 0) {
    return `${parts.filter(Boolean).join('_')}.jpg`;
  }

  const cleanBase = (photo.name || 'family_photo').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cleanBase}_FamilySearch.jpg`;
}

/**
 * Formats a clean summary ready for 1-click clipboard paste into FamilySearch Memories Description box
 */
export function formatFamilySearchSummary(photo, metadata = {}) {
  const sections = [];

  const details = [];
  if (metadata.people && metadata.people.length > 0) {
    details.push(`People: ${metadata.people.join(', ')}`);
  }
  if (metadata.date || metadata.decade) {
    details.push(`Date: ${metadata.date || metadata.decade}`);
  }
  if (metadata.location) {
    details.push(`Location: ${metadata.location}`);
  }
  if (metadata.familyBranch) {
    details.push(`Family Branch: ${metadata.familyBranch}`);
  }

  if (details.length > 0) {
    sections.push(details.join('\n'));
  }

  if (metadata.story && metadata.story.trim()) {
    sections.push(`Memories & Story:\n${metadata.story.trim()}`);
  }

  return sections.join('\n\n');
}

/**
 * Creates a lightweight compressed JPEG thumbnail data URL (~12-18KB)
 * for instant previewing in directory modals and offline caching.
 */
export async function createPhotoThumbnail(photo, maxDimension = 200) {
  try {
    let url = photo.enhancedUrl || photo.objectUrl;
    let revokeNeeded = false;
    if (!url && photo.handle && typeof photo.handle.getFile === 'function') {
      try {
        const file = await photo.handle.getFile();
        url = URL.createObjectURL(file);
        revokeNeeded = true;
      } catch {}
    }
    if (!url) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          if (revokeNeeded) {
            try { URL.revokeObjectURL(url); } catch {}
          }
          resolve(dataUrl);
        } catch {
          if (revokeNeeded) {
            try { URL.revokeObjectURL(url); } catch {}
          }
          resolve(null);
        }
      };
      img.onerror = () => {
        if (revokeNeeded) {
          try { URL.revokeObjectURL(url); } catch {}
        }
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

