/**
 * Streaming-friendly GEDCOM (.ged) Parser & PAF Photo Link Re-Connector
 * Designed to handle 100,000+ people exported from PAF, RootsMagic, or Ancestral Quest
 * without freezing the browser UI.
 */

function stripGedSlashes(rawName) {
  return String(rawName || '').replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
}

function extractBasename(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s) return '';
  const parts = s.split(/[\\/]/);
  return (parts[parts.length - 1] || '').trim();
}

function stripExt(filename) {
  return String(filename || '').replace(/\.[^.]+$/, '').trim().toLowerCase();
}

function parseGedYear(dateStr) {
  const m = String(dateStr || '').match(/\b(17\d{2}|18\d{2}|19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

const MONTHS = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};

export function gedDateToIso(dateStr) {
  const s = String(dateStr || '').trim().toUpperCase();
  if (!s) return '';
  const full = s.match(/\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(1[789]\d{2}|20\d{2})\b/);
  if (full) {
    const dd = full[1].padStart(2, '0');
    const mm = MONTHS[full[2]] || '01';
    return `${full[3]}-${mm}-${dd}`;
  }
  const monYr = s.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(1[789]\d{2}|20\d{2})\b/);
  if (monYr) {
    return `${monYr[2]}-${MONTHS[monYr[1]] || '01'}-01`;
  }
  const yr = parseGedYear(s);
  return yr ? `${yr}-01-01` : '';
}

export async function parseGedcomFile(file, onProgress = null) {
  if (onProgress) onProgress({ stage: 'Reading GEDCOM file...', pct: 5 });
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;

  const peopleById = new Map();
  const objeById = new Map();
  const famById = new Map();

  let curRec = null;
  let curType = '';
  let curSub = ''; // e.g. 'BIRT', 'DEAT', 'MARR', 'OBJE', 'NOTE'
  let curInlineObje = null;

  const flushInlineObje = () => {
    if (curInlineObje && curInlineObje.file && curRec) {
      if (!curRec.inlineObje) curRec.inlineObje = [];
      curRec.inlineObje.push(curInlineObje);
    }
    curInlineObje = null;
  };

  for (let i = 0; i < totalLines; i++) {
    if (i > 0 && i % 15000 === 0) {
      if (onProgress) {
        onProgress({
          stage: `Parsing GEDCOM (${peopleById.size.toLocaleString()} people)...`,
          pct: Math.min(85, Math.round(10 + (i / totalLines) * 75))
        });
      }
      await new Promise((r) => setTimeout(r, 0));
    }

    const rawLine = lines[i];
    if (!rawLine) continue;
    const m = rawLine.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/);
    if (!m) continue;

    const level = Number(m[1]);
    const xref = m[2] || '';
    const tag = m[3].toUpperCase();
    const val = (m[4] || '').trim();

    if (level === 0) {
      flushInlineObje();
      curSub = '';
      curType = tag;
      if (tag === 'INDI' && xref) {
        curRec = {
          id: xref.replace(/@/g, ''),
          name: '',
          given: '',
          surname: '',
          sex: '',
          birthDate: '',
          birthPlace: '',
          deathDate: '',
          deathPlace: '',
          notes: '',
          objeIds: [],
          inlineObje: [],
          famc: [],
          fams: []
        };
        peopleById.set(curRec.id, curRec);
      } else if (tag === 'OBJE' && xref) {
        curRec = {
          id: xref.replace(/@/g, ''),
          file: '',
          title: '',
          note: ''
        };
        objeById.set(curRec.id, curRec);
      } else if (tag === 'FAM' && xref) {
        curRec = {
          id: xref.replace(/@/g, ''),
          husb: '',
          wife: '',
          chil: [],
          marrDate: '',
          marrPlace: '',
          objeIds: [],
          inlineObje: []
        };
        famById.set(curRec.id, curRec);
      } else {
        curRec = null;
      }
      continue;
    }

    if (!curRec) continue;

    if (level === 1) {
      flushInlineObje();
      curSub = tag;

      if (curType === 'INDI') {
        if (tag === 'NAME' && !curRec.name) {
          curRec.name = stripGedSlashes(val);
          const slashMatch = val.match(/\/([^/]*)\//);
          if (slashMatch) curRec.surname = slashMatch[1].trim();
        } else if (tag === 'SEX') {
          curRec.sex = val.toUpperCase();
        } else if (tag === 'NOTE') {
          curRec.notes = curRec.notes ? `${curRec.notes}\n${val}` : val;
        } else if (tag === 'OBJE') {
          if (val.startsWith('@') && val.endsWith('@')) {
            curRec.objeIds.push(val.replace(/@/g, ''));
          } else {
            curInlineObje = { file: '', title: '', note: '' };
          }
        } else if (tag === 'FAMC' && val) {
          curRec.famc.push(val.replace(/@/g, ''));
        } else if (tag === 'FAMS' && val) {
          curRec.fams.push(val.replace(/@/g, ''));
        }
      } else if (curType === 'OBJE') {
        if (tag === 'FILE' && val) curRec.file = val;
        else if (tag === 'TITL' && val) curRec.title = val;
        else if (tag === 'NOTE' && val) curRec.note = val;
      } else if (curType === 'FAM') {
        if (tag === 'HUSB' && val) curRec.husb = val.replace(/@/g, '');
        else if (tag === 'WIFE' && val) curRec.wife = val.replace(/@/g, '');
        else if (tag === 'CHIL' && val) curRec.chil.push(val.replace(/@/g, ''));
        else if (tag === 'OBJE') {
          if (val.startsWith('@') && val.endsWith('@')) {
            curRec.objeIds.push(val.replace(/@/g, ''));
          } else {
            curInlineObje = { file: '', title: '', note: '' };
          }
        }
      }
      continue;
    }

    if (level === 2) {
      if (tag === 'OBJE' && (curType === 'INDI' || curType === 'FAM')) {
        flushInlineObje();
        if (val.startsWith('@') && val.endsWith('@')) {
          curRec.objeIds.push(val.replace(/@/g, ''));
        } else {
          curInlineObje = { file: '', title: '', note: '', subTag: '' };
        }
        continue;
      }
      if (curType === 'INDI') {
        if (curSub === 'NAME') {
          if (tag === 'GIVN') curRec.given = val;
          else if (tag === 'SURN') curRec.surname = val;
        } else if (curSub === 'BIRT') {
          if (tag === 'DATE') curRec.birthDate = val;
          else if (tag === 'PLAC') curRec.birthPlace = val;
        } else if (curSub === 'DEAT') {
          if (tag === 'DATE') curRec.deathDate = val;
          else if (tag === 'PLAC') curRec.deathPlace = val;
        } else if (curSub === 'NOTE' && (tag === 'CONT' || tag === 'CONC')) {
          curRec.notes += (tag === 'CONT' ? '\n' : '') + val;
        } else if (curSub === 'OBJE' && curInlineObje) {
          curInlineObje.subTag = tag;
          if (tag === 'FILE' && val) curInlineObje.file = val;
          else if (tag === 'TITL' && val) curInlineObje.title = val;
          else if (tag === 'NOTE' && val) curInlineObje.note = curInlineObje.note ? `${curInlineObje.note}\n${val}` : val;
        }
      } else if (curType === 'OBJE') {
        if (curSub === 'FILE' && tag === 'TITL' && val) curRec.title = val;
        else if (curSub === 'NOTE' && (tag === 'CONT' || tag === 'CONC')) {
          curRec.note += (tag === 'CONT' ? '\n' : '') + val;
        } else if (curSub === 'TITL' && (tag === 'CONT' || tag === 'CONC')) {
          curRec.title += (tag === 'CONT' ? '\n' : '') + val;
        }
      } else if (curType === 'FAM') {
        if (curSub === 'MARR') {
          if (tag === 'DATE') curRec.marrDate = val;
          else if (tag === 'PLAC') curRec.marrPlace = val;
        } else if (curSub === 'OBJE' && curInlineObje) {
          curInlineObje.subTag = tag;
          if (tag === 'FILE' && val) curInlineObje.file = val;
          else if (tag === 'TITL' && val) curInlineObje.title = val;
          else if (tag === 'NOTE' && val) curInlineObje.note = curInlineObje.note ? `${curInlineObje.note}\n${val}` : val;
        }
      }
      continue;
    }

    if (level >= 3 && curInlineObje) {
      if (tag === 'FILE' && val) {
        curInlineObje.file = val;
        curInlineObje.subTag = 'FILE';
      } else if (tag === 'TITL' && val) {
        curInlineObje.title = val;
        curInlineObje.subTag = 'TITL';
      } else if (tag === 'NOTE' && val) {
        curInlineObje.note = curInlineObje.note ? `${curInlineObje.note}\n${val}` : val;
        curInlineObje.subTag = 'NOTE';
      } else if ((tag === 'CONT' || tag === 'CONC')) {
        if (curInlineObje.subTag === 'NOTE') curInlineObje.note += (tag === 'CONT' ? '\n' : '') + val;
        else if (curInlineObje.subTag === 'TITL') curInlineObje.title += (tag === 'CONT' ? '\n' : '') + val;
      }
    }
  }
  flushInlineObje();

  if (onProgress) onProgress({ stage: 'Indexing photo links...', pct: 90 });

  // Build O(1) filename lookup index for broken PAF photo paths
  const fileIndexByName = new Map();
  const fileIndexByStem = new Map();
  let totalPhotoLinks = 0;

  const addLink = (rawPath, title, note, personIds, eventDate = '', eventPlace = '') => {
    const base = extractBasename(rawPath).toLowerCase();
    if (!base) return;
    totalPhotoLinks++;
    const entry = { rawPath, title: title || '', note: note || '', personIds, eventDate, eventPlace };
    if (!fileIndexByName.has(base)) fileIndexByName.set(base, []);
    fileIndexByName.get(base).push(entry);

    const stem = stripExt(base);
    if (stem) {
      if (!fileIndexByStem.has(stem)) fileIndexByStem.set(stem, []);
      fileIndexByStem.get(stem).push(entry);
    }
  };

  for (const person of peopleById.values()) {
    for (const oid of person.objeIds) {
      const obj = objeById.get(oid);
      if (obj && obj.file) {
        addLink(obj.file, obj.title, obj.note, [person.id], person.birthDate, person.birthPlace);
      }
    }
    for (const inline of person.inlineObje) {
      if (inline.file) {
        addLink(inline.file, inline.title, inline.note, [person.id], person.birthDate, person.birthPlace);
      }
    }
  }

  for (const fam of famById.values()) {
    const famPids = [fam.husb, fam.wife, ...(fam.chil || [])].filter(Boolean);
    for (const oid of fam.objeIds) {
      const obj = objeById.get(oid);
      if (obj && obj.file) {
        addLink(obj.file, obj.title, obj.note, famPids, fam.marrDate, fam.marrPlace);
      }
    }
    for (const inline of fam.inlineObje) {
      if (inline.file) {
        addLink(inline.file, inline.title, inline.note, famPids, fam.marrDate, fam.marrPlace);
      }
    }
  }

  const peopleList = Array.from(peopleById.values());
  if (onProgress) onProgress({ stage: 'Complete', pct: 100 });

  return {
    fileName: file.name,
    peopleById,
    peopleList,
    objeCount: objeById.size,
    famCount: famById.size,
    totalPhotoLinks,
    fileIndexByName,
    fileIndexByStem
  };
}

export function relinkPhotosWithGedcom(gedData, photoItems) {
  if (!gedData || !Array.isArray(photoItems)) {
    return { matchedPhotos: 0, newlyUpdatedPhotos: 0, totalLinksRestored: 0, matchedIds: [] };
  }
  let matchedPhotos = 0;
  let newlyUpdatedPhotos = 0;
  let totalLinksRestored = 0;
  const matchedIds = [];

  for (const p of photoItems) {
    const fileName = extractBasename(p.file || p.filename || '').toLowerCase();
    if (!fileName) continue;
    let matches = gedData.fileIndexByName.get(fileName);
    if (!matches || matches.length === 0) {
      const stem = stripExt(fileName);
      if (stem) matches = gedData.fileIndexByStem.get(stem);
    }
    if (!matches || matches.length === 0) continue;

    matchedPhotos++;
    matchedIds.push(p.id);
    let photoChanged = false;
    const seenNames = new Set((p.people || []).map((x) => (x.name || '').toLowerCase()));
    const linkedSummaries = [];

    for (const m of matches) {
      for (const pid of m.personIds) {
        const person = gedData.peopleById.get(pid);
        if (!person || !person.name) continue;
        const lifeBits = [
          person.birthDate || person.birthPlace ? `b. ${[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}` : '',
          person.deathDate || person.deathPlace ? `d. ${[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}` : ''
        ].filter(Boolean).join(' · ');
        const summaryLine = `${person.name}${lifeBits ? ` (${lifeBits})` : ''}${person.notes ? ` — ${person.notes}` : ''}`;
        if (!linkedSummaries.includes(summaryLine)) linkedSummaries.push(summaryLine);

        const key = person.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          if (!Array.isArray(p.people)) p.people = [];
          p.people.push({
            name: person.name,
            rel: 'Relative',
            branch: person.surname || p.branch || '',
            gedId: person.id,
            sex: person.sex,
            birthDate: person.birthDate,
            birthPlace: person.birthPlace,
            deathDate: person.deathDate,
            deathPlace: person.deathPlace,
            notes: person.notes
          });
          totalLinksRestored++;
          photoChanged = true;
        }
      }
      if (m.title && (!p.title || p.title === stripExt(p.file) || /^Family Print/i.test(p.title))) {
        p.title = m.title;
        photoChanged = true;
      }
      if (m.note && !p.story) {
        p.story = m.note;
        photoChanged = true;
      }
      if (m.eventPlace && !p.place) {
        p.place = m.eventPlace;
        photoChanged = true;
      }
      if (m.eventDate && !p.isoDate) {
        const iso = gedDateToIso(m.eventDate);
        if (iso) {
          p.isoDate = iso;
          const yr = Number(iso.slice(0, 4));
          if (yr >= 1700 && yr <= 2099) p.decade = `${String(yr).slice(0, 3)}0s`;
          photoChanged = true;
        }
      }
    }

    if (!p.story && linkedSummaries.length > 0) {
      p.story = linkedSummaries.join('\n');
      photoChanged = true;
    }
    if (photoChanged) newlyUpdatedPhotos++;
  }

  return { matchedPhotos, newlyUpdatedPhotos, totalLinksRestored, matchedIds };
}
