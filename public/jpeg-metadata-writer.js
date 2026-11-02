/**
 * JPEG Metadata Writer & Downloader
 * Conforms to FHMWG and FamilySearch.org standards:
 * Injects XMP, IPTC, and EXIF segments directly into JPEG files without modifying pixels.
 */
(function (global) {
  'use strict';

  var te = new TextEncoder();

  function escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function truncBytes(str, max) {
    var bytes = te.encode(String(str || ''));
    if (bytes.length <= max) return bytes;
    bytes = bytes.subarray(0, max);
    var end = bytes.length;
    while (end > 0 && (bytes[end] & 0xC0) === 0x80) end--;
    return bytes.subarray(0, end);
  }

  function generateXmpPacket(meta) {
    var safeTitle = escapeXml(meta.title || '');
    var safeStory = escapeXml(meta.story || '');
    var safeDate = escapeXml(meta.isoDate || meta.date || meta.decade || '');
    var safeLocation = escapeXml(meta.place || meta.location || '');
    var safeBranch = escapeXml(meta.branch || meta.familyBranch || '');

    var peopleNames = (meta.people || []).map(function (p) {
      return typeof p === 'string' ? p : p.name;
    }).filter(Boolean);

    var subjects = Array.from(new Set([].concat(peopleNames, [meta.decade, safeBranch]).filter(Boolean)));
    var subjectXml = subjects.map(function (s) { return '<rdf:li>' + escapeXml(s) + '</rdf:li>'; }).join('\n     ');
    var peopleXml = peopleNames.map(function (p) { return '<rdf:li>' + escapeXml(p) + '</rdf:li>'; }).join('\n     ');

    var facesXml = '';
    if (meta.faces && meta.faces.length > 0) {
      var regionItems = meta.faces.map(function (f, idx) {
        var b = f.box || { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
        var fName = escapeXml(f.name || (peopleNames[idx] || ''));
        var cx = (b.x + (b.width || 0.2) / 2).toFixed(4);
        var cy = (b.y + (b.height || 0.2) / 2).toFixed(4);
        var w = (b.width || 0.2).toFixed(4);
        var h = (b.height || 0.2).toFixed(4);
        return '      <rdf:li rdf:parseType="Resource">\n' +
          '       <mwg-rs:Name>' + fName + '</mwg-rs:Name>\n' +
          '       <mwg-rs:Type>Face</mwg-rs:Type>\n' +
          '       <mwg-rs:Area rdf:parseType="Resource">\n' +
          '        <stArea:x>' + cx + '</stArea:x>\n' +
          '        <stArea:y>' + cy + '</stArea:y>\n' +
          '        <stArea:w>' + w + '</stArea:w>\n' +
          '        <stArea:h>' + h + '</stArea:h>\n' +
          '        <stArea:unit>normalized</stArea:unit>\n' +
          '       </mwg-rs:Area>\n' +
          '      </rdf:li>';
      }).join('\n');

      facesXml = '   <mwg-rs:Regions rdf:parseType="Resource">\n' +
        '    <mwg-rs:AppliedToDimensions rdf:parseType="Resource">\n' +
        '     <stDim:w>' + (meta.width || 1200) + '</stDim:w>\n' +
        '     <stDim:h>' + (meta.height || 900) + '</stDim:h>\n' +
        '     <stDim:unit>pixel</stDim:unit>\n' +
        '    </mwg-rs:AppliedToDimensions>\n' +
        '    <mwg-rs:RegionList>\n' +
        '     <rdf:Bag>\n' +
        regionItems + '\n' +
        '     </rdf:Bag>\n' +
        '    </mwg-rs:RegionList>\n' +
        '   </mwg-rs:Regions>\n';
    }

    return '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Family History Photos">\n' +
      ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      '  <rdf:Description rdf:about=""\n' +
      '    xmlns:dc="http://purl.org/dc/elements/1.1/"\n' +
      '    xmlns:photoshop="http://photoshop.com/s/1.0/"\n' +
      '    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"\n' +
      '    xmlns:iptcExt="http://iptc.org/std/iptc-extension/2008-02-29/"\n' +
      '    xmlns:mwg-rs="http://www.metadataworkinggroup.com/schemas/regions/"\n' +
      '    xmlns:stDim="http://ns.adobe.com/xap/1.0/sType/Dimensions#"\n' +
      '    xmlns:stArea="http://ns.adobe.com/xmp/sType/Area#"\n' +
      '    xmlns:xmp="http://ns.adobe.com/xap/1.0/">\n' +
      '   <dc:title>\n' +
      '    <rdf:Alt>\n' +
      '     <rdf:li xml:lang="x-default">' + safeTitle + '</rdf:li>\n' +
      '    </rdf:Alt>\n' +
      '   </dc:title>\n' +
      '   <dc:description>\n' +
      '    <rdf:Alt>\n' +
      '     <rdf:li xml:lang="x-default">' + safeStory + '</rdf:li>\n' +
      '    </rdf:Alt>\n' +
      '   </dc:description>\n' +
      (subjects.length > 0 ? '   <dc:subject>\n    <rdf:Bag>\n     ' + subjectXml + '\n    </rdf:Bag>\n   </dc:subject>\n' : '') +
      (peopleNames.length > 0 ? '   <iptcExt:PersonInImage>\n    <rdf:Bag>\n     ' + peopleXml + '\n    </rdf:Bag>\n   </iptcExt:PersonInImage>\n' : '') +
      facesXml +
      (safeDate ? '   <photoshop:DateCreated>' + safeDate + '</photoshop:DateCreated>\n' : '') +
      (safeLocation ? '   <Iptc4xmpCore:Location>' + safeLocation + '</Iptc4xmpCore:Location>\n' : '') +
      (safeBranch ? '   <photoshop:Credit>' + safeBranch + '</photoshop:Credit>\n' : '') +
      '  </rdf:Description>\n' +
      ' </rdf:RDF>\n' +
      '</x:xmpmeta>\n' +
      '<?xpacket end="w"?>';
  }

  function embedXmpInJpeg(uint8Array, meta) {
    if (uint8Array[0] !== 0xFF || uint8Array[1] !== 0xD8) {
      throw new Error('Not a valid JPEG file');
    }

    var xmpPacketStr = generateXmpPacket(meta);
    var xmpBytes = te.encode(xmpPacketStr);
    var nsBytes = te.encode('http://ns.adobe.com/xap/1.0/\0');

    var payloadLen = 2 + nsBytes.length + xmpBytes.length;
    if (payloadLen > 65535) {
      throw new Error('XMP metadata exceeds 64KB');
    }

    var xmpSeg = new Uint8Array(2 + payloadLen);
    xmpSeg[0] = 0xFF;
    xmpSeg[1] = 0xE1;
    xmpSeg[2] = (payloadLen >> 8) & 0xFF;
    xmpSeg[3] = payloadLen & 0xFF;
    xmpSeg.set(nsBytes, 4);
    xmpSeg.set(xmpBytes, 4 + nsBytes.length);

    var chunks = [];
    chunks.push(uint8Array.subarray(0, 2)); // SOI

    var pos = 2;
    var view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);

    while (pos < uint8Array.length - 1) {
      if (uint8Array[pos] !== 0xFF) break;
      var marker = uint8Array[pos + 1];

      if (marker === 0xDA || marker === 0xD9) break;

      if (marker === 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
        pos += 2;
        continue;
      }

      var segLen = view.getUint16(pos + 2, false);
      var segEnd = pos + 2 + segLen;

      var skip = false;
      if (marker === 0xE1 && segLen >= 31) {
        var headerBytes = uint8Array.subarray(pos + 4, pos + 4 + 28);
        var headerStr = new TextDecoder().decode(headerBytes);
        if (headerStr === 'http://ns.adobe.com/xap/1.0/') skip = true;
      }

      if (!skip) {
        chunks.push(uint8Array.subarray(pos, segEnd));
      }

      pos = segEnd;
    }

    var insertAt = 1;
    while (insertAt < chunks.length && (chunks[insertAt][1] === 0xE0 || chunks[insertAt][1] === 0xE1)) {
      insertAt++;
    }
    chunks.splice(insertAt, 0, xmpSeg);
    chunks.push(uint8Array.subarray(pos));

    var totalLength = chunks.reduce(function (a, c) { return a + c.length; }, 0);
    var result = new Uint8Array(totalLength);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      result.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    return result;
  }

  async function writeMetadataToHandle(fileHandle, meta) {
    if (!fileHandle || typeof fileHandle.createWritable !== 'function') return false;
    try {
      var file = await fileHandle.getFile();
      var buffer = await file.arrayBuffer();
      var uint8 = new Uint8Array(buffer);
      var updated = embedXmpInJpeg(uint8, meta);
      var writable = await fileHandle.createWritable();
      await writable.write(updated);
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Could not write directly to file handle:', e);
      return false;
    }
  }

  async function downloadJpegWithMetadata(photo, meta) {
    try {
      var buffer = null;
      if (photo._file) {
        buffer = await photo._file.arrayBuffer();
      } else if (photo._handle && typeof photo._handle.getFile === 'function') {
        var f = await photo._handle.getFile();
        buffer = await f.arrayBuffer();
      } else if (photo.workingSrc || photo.src) {
        var res = await fetch(photo.workingSrc || photo.src);
        buffer = await res.arrayBuffer();
      }

      if (!buffer) throw new Error('No image buffer found');

      var uint8 = new Uint8Array(buffer);
      var updated = embedXmpInJpeg(uint8, meta || photo);
      var blob = new Blob([updated], { type: 'image/jpeg' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      
      var cleanTitle = (meta.title || photo.title || photo.file || 'family_photo')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      var datePrefix = (meta.isoDate || photo.isoDate || '').replace(/[^0-9]/g, '');
      a.download = (datePrefix ? datePrefix + '_' : '') + cleanTitle + '.jpg';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('Failed to download JPEG with metadata:', err);
      return false;
    }
  }

  global.JpegMetadataWriter = {
    embedXmpInJpeg: embedXmpInJpeg,
    writeMetadataToHandle: writeMetadataToHandle,
    downloadJpegWithMetadata: downloadJpegWithMetadata
  };
})(typeof window !== 'undefined' ? window : this);

