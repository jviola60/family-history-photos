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

function normalizeFileStem(filename) {
  return stripExt(filename)
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/(?:[-_\s]+(?:copy|edited|restored|4k|scan|crop|\d+))+\s*$/gi, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const NOISE_WORDS = new Set([
  'img', 'dsc', 'pxl', 'vid', 'mov', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp',
  'heic', 'tif', 'tiff', 'scan', 'scanned', 'photo', 'pic', 'pics', 'picture',
  'pictures', 'image', 'images', 'copy', 'edited', 'restored', '4k', 'final',
  'thumb', 'thumbs', 'thumbnail', 'screenshot', 'screenshots', 'generated',
  'backup', 'family', 'photos', 'drive', 'my', 'users', 'documents', 'desktop',
  'other', 'computers', 'untitled', 'document', 'page', 'unnamed', 'download',
  'downloads', 'archive', 'edited1', 'hdr', 'raw', 'orig', 'original', 'new'
]);

const NICKNAME_GROUPS = [
  ['jeff', 'jeffrey', 'geoff', 'geoffrey'],
  ['bill', 'william', 'will', 'billy', 'willie'],
  ['bob', 'robert', 'rob', 'bobby', 'bert'],
  ['jim', 'james', 'jimmy', 'jamie'],
  ['mike', 'michael', 'mick'],
  ['dick', 'richard', 'rick', 'rich', 'ricky'],
  ['jack', 'john', 'johnny', 'jon', 'jonathan'],
  ['ed', 'edward', 'eddie', 'ted', 'teddy', 'edwin', 'edgar'],
  ['chuck', 'charlie', 'charles', 'chas'],
  ['tom', 'thomas', 'tommy'],
  ['joe', 'joseph', 'joey', 'jos'],
  ['dan', 'daniel', 'danny'],
  ['dave', 'david', 'davy'],
  ['greg', 'gregory'],
  ['steve', 'steven', 'stephen'],
  ['chris', 'christopher', 'christine', 'christina', 'kristen', 'kristin'],
  ['matt', 'matthew'],
  ['tony', 'anthony'],
  ['liz', 'beth', 'betty', 'elizabeth', 'lisa', 'eliza', 'libby', 'betsy'],
  ['peggy', 'maggie', 'margaret', 'meg', 'marge', 'margie'],
  ['sue', 'susie', 'susan', 'suzanne', 'suzy'],
  ['kate', 'katie', 'kathy', 'katherine', 'catherine', 'cathy', 'kaye', 'kathleen'],
  ['pat', 'patty', 'patti', 'patricia', 'patrick', 'tricia'],
  ['becky', 'rebecca'],
  ['jen', 'jenny', 'jennifer'],
  ['deb', 'debbie', 'deborah', 'debra'],
  ['cindy', 'cynthia'],
  ['sandy', 'sandra'],
  ['barb', 'barbara'],
  ['judy', 'judith'],
  ['nancy', 'ann', 'anne', 'anna', 'annie'],
  ['sally', 'sarah', 'sadie'],
  ['polly', 'molly', 'mary', 'marie', 'mamie'],
  ['harry', 'henry', 'hank'],
  ['frank', 'francis', 'franklin'],
  ['ray', 'raymond'],
  ['ron', 'ronald', 'ronnie'],
  ['don', 'donald', 'donnie'],
  ['ken', 'kenneth', 'kenny'],
  ['larry', 'lawrence', 'laurence'],
  ['jerry', 'gerald', 'jerome'],
  ['terry', 'teresa', 'theresa', 'terrence'],
  ['al', 'albert', 'alan', 'allan', 'allen', 'alfred'],
  ['ben', 'benjamin', 'benny'],
  ['sam', 'samuel', 'samantha', 'sammy'],
  ['alex', 'alexander', 'alexandra'],
  ['nick', 'nicholas'],
  ['tim', 'timothy', 'timmy'],
  ['andy', 'andrew', 'drew'],
  ['phil', 'philip', 'phillip'],
  ['walt', 'walter'],
  ['art', 'arthur'],
  ['fred', 'frederick', 'freddie'],
  ['leo', 'leonard'],
  ['lou', 'louis', 'lewis'],
  ['dot', 'dotty', 'dorothy'],
  ['gene', 'eugene'],
  ['pete', 'peter'],
  ['stan', 'stanley'],
  ['vic', 'victor', 'victoria', 'vicki', 'vicky'],
  ['wendy', 'gwendolyn'],
  ['bev', 'beverly'],
  ['val', 'valerie'],
  ['carol', 'carolyn', 'caroline'],
  ['marty', 'martin', 'martha'],
  ['norm', 'norman'],
  ['herb', 'herbert'],
  ['cliff', 'clifford'],
  ['russ', 'russell'],
  ['doug', 'douglas'],
  ['brad', 'bradley'],
  ['scott', 'scotty'],
  ['josh', 'joshua'],
  ['zach', 'zachary'],
  ['nate', 'nathan', 'nathaniel']
];

const NICKNAME_TO_CANON = new Map();
for (let gi = 0; gi < NICKNAME_GROUPS.length; gi++) {
  const grp = NICKNAME_GROUPS[gi];
  const canon = grp[0];
  for (let wi = 0; wi < grp.length; wi++) {
    NICKNAME_TO_CANON.set(grp[wi], canon);
  }
}

function getNicknameCanon(word) {
  return NICKNAME_TO_CANON.get(String(word || '').toLowerCase()) || '';
}

function extractFilenameParts(rawFileName) {
  const base = extractBasename(rawFileName).replace(/\.[^.]+$/, '');
  if (!base) return { words: [], initials: [], rawTokens: [] };
  const splitCamel = base.replace(/([a-z])([A-Z])/g, '$1 $2');
  const rawTokens = splitCamel
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const words = [];
  const initials = [];
  const seenW = new Set();
  const seenI = new Set();
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if (t.length === 1) {
      if (!seenI.has(t)) {
        seenI.add(t);
        initials.push(t);
      }
    } else if (t.length >= 2 && !NOISE_WORDS.has(t)) {
      if (!seenW.has(t)) {
        seenW.add(t);
        words.push(t);
      }
    }
  }
  return { words, initials, rawTokens };
}

function extractPathWords(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s) return [];
  const parts = s.split(/[\\/]/).filter(Boolean);
  const words = [];
  const seen = new Set();
  for (let p = 0; p < parts.length; p++) {
    const toks = parts[p]
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !NOISE_WORDS.has(t));
    for (let i = 0; i < toks.length; i++) {
      if (!seen.has(toks[i])) {
        seen.add(toks[i]);
        words.push(toks[i]);
      }
    }
  }
  return words;
}

function boundedEditDistance(a, b, maxDist = 2) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb];
}

function getPersonSurnameList(person) {
  const out = [];
  const add = (raw) => {
    const toks = extractNameTokens(raw);
    for (let i = 0; i < toks.length; i++) {
      if (!out.includes(toks[i])) out.push(toks[i]);
    }
  };
  if (person.surname) add(person.surname);
  const nameToks = extractNameTokens(person.name);
  if (nameToks.length >= 2) {
    const last = nameToks[nameToks.length - 1];
    if (!out.includes(last)) out.push(last);
  }
  if (Array.isArray(person.marriedSurnames)) {
    for (let i = 0; i < person.marriedSurnames.length; i++) {
      add(person.marriedSurnames[i]);
    }
  }
  if (Array.isArray(person.altNames)) {
    for (let i = 0; i < person.altNames.length; i++) {
      const altToks = extractNameTokens(person.altNames[i]);
      if (altToks.length >= 2) {
        const altLast = altToks[altToks.length - 1];
        if (!out.includes(altLast)) out.push(altLast);
      }
    }
  }
  return out;
}

function getPersonGivenTokens(person, surnames) {
  const toks = extractNameTokens(person.name);
  const givToks = extractNameTokens(person.given);
  const combined = [];
  for (let i = 0; i < givToks.length; i++) {
    if (!combined.includes(givToks[i])) combined.push(givToks[i]);
  }
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i === toks.length - 1 && surnames.includes(t) && toks.length > 1) continue;
    if (!combined.includes(t)) combined.push(t);
  }
  if (Array.isArray(person.altNames)) {
    for (let ai = 0; ai < person.altNames.length; ai++) {
      const aToks = extractNameTokens(person.altNames[ai]);
      for (let i = 0; i < aToks.length; i++) {
        const t = aToks[i];
        if (i === aToks.length - 1 && surnames.includes(t) && aToks.length > 1) continue;
        if (!combined.includes(t)) combined.push(t);
      }
    }
  }
  return combined;
}

function extractNameTokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 2);
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

export async function parseGedcomText(text, fileName = 'family-tree.ged', onProgress = null) {
  if (onProgress) onProgress({ stage: 'Reading GEDCOM data...', pct: 5 });
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/);
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
          marriedSurnames: [],
          altNames: [],
          sex: '',
          birthDate: '',
          birthPlace: '',
          deathDate: '',
          deathPlace: '',
          notes: '',
          objeIds: [],
          inlineObje: [],
          photoFileNames: [],
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
        if (tag === 'NAME') {
          if (!curRec.name) {
            curRec.name = stripGedSlashes(val);
            const slashMatch = val.match(/\/([^/]*)\//);
            if (slashMatch) curRec.surname = slashMatch[1].trim();
          } else {
            const altClean = stripGedSlashes(val);
            if (altClean && !curRec.altNames.includes(altClean)) curRec.altNames.push(altClean);
            const slashMatch = val.match(/\/([^/]*)\//);
            if (slashMatch && slashMatch[1].trim() && !curRec.marriedSurnames.includes(slashMatch[1].trim())) {
              curRec.marriedSurnames.push(slashMatch[1].trim());
            }
          }
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
          else if ((tag === '_MARNM' || tag === 'ROMN') && val) {
            const sn = stripGedSlashes(val);
            if (sn && !curRec.marriedSurnames.includes(sn)) curRec.marriedSurnames.push(sn);
          } else if (tag === 'NICK' && val) {
            if (!curRec.altNames.includes(val)) curRec.altNames.push(val);
          }
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
  const fileIndexByNorm = new Map();
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

    const norm = normalizeFileStem(base);
    if (norm && norm.length >= 4) {
      if (!fileIndexByNorm.has(norm)) fileIndexByNorm.set(norm, []);
      fileIndexByNorm.get(norm).push(entry);
    }
  };

  const pushPersonPhotoName = (pid, rawPath) => {
    const p = peopleById.get(pid);
    const b = extractBasename(rawPath);
    if (p && b && !p.photoFileNames.includes(b)) {
      p.photoFileNames.push(b);
    }
  };

  for (const person of peopleById.values()) {
    for (const oid of person.objeIds) {
      const obj = objeById.get(oid);
      if (obj && obj.file) {
        pushPersonPhotoName(person.id, obj.file);
        addLink(obj.file, obj.title, obj.note, [person.id], person.birthDate, person.birthPlace);
      }
    }
    for (const inline of person.inlineObje) {
      if (inline.file) {
        pushPersonPhotoName(person.id, inline.file);
        addLink(inline.file, inline.title, inline.note, [person.id], person.birthDate, person.birthPlace);
      }
    }
  }

  for (const fam of famById.values()) {
    const famPids = [fam.husb, fam.wife, ...(fam.chil || [])].filter(Boolean);
    for (const oid of fam.objeIds) {
      const obj = objeById.get(oid);
      if (obj && obj.file) {
        famPids.forEach((fpid) => pushPersonPhotoName(fpid, obj.file));
        addLink(obj.file, obj.title, obj.note, famPids, fam.marrDate, fam.marrPlace);
      }
    }
    for (const inline of fam.inlineObje) {
      if (inline.file) {
        famPids.forEach((fpid) => pushPersonPhotoName(fpid, inline.file));
        addLink(inline.file, inline.title, inline.note, famPids, fam.marrDate, fam.marrPlace);
      }
    }
  }

  // Derive married surnames from FAM spouse links so women match both maiden & married filenames
  for (const fam of famById.values()) {
    const husb = fam.husb ? peopleById.get(fam.husb) : null;
    const wife = fam.wife ? peopleById.get(fam.wife) : null;
    if (husb && wife) {
      const husbSns = [];
      if (husb.surname) husbSns.push(husb.surname);
      const hToks = extractNameTokens(husb.name);
      if (hToks.length >= 2) husbSns.push(hToks[hToks.length - 1]);
      for (let i = 0; i < husbSns.length; i++) {
        const sn = husbSns[i];
        if (sn && !wife.marriedSurnames.includes(sn)) wife.marriedSurnames.push(sn);
      }
      const wifeSns = [];
      if (wife.surname) wifeSns.push(wife.surname);
      const wToks = extractNameTokens(wife.name);
      if (wToks.length >= 2) wifeSns.push(wToks[wToks.length - 1]);
      for (let i = 0; i < wifeSns.length; i++) {
        const sn = wifeSns[i];
        if (sn && !husb.marriedSurnames.includes(sn)) husb.marriedSurnames.push(sn);
      }
    }
  }

  const peopleList = Array.from(peopleById.values());
  const peopleByFullNorm = new Map();
  const peopleByFirstLast = new Map();
  const peopleBySurname = new Map();
  const peopleByLastInitial = new Map();
  const peopleBySurnamePrefix = new Map();
  const peopleBySurnameNick = new Map();
  const surnamesByFirstChar = new Map();
  const seenSurnames = new Set();

  const pushIdx = (map, key, person) => {
    if (!key) return;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    if (!arr.includes(person)) arr.push(person);
  };

  for (const person of peopleList) {
    const toks = extractNameTokens(person.name);
    if (toks.length === 0) continue;
    const fullKey = toks.join(' ');
    pushIdx(peopleByFullNorm, fullKey, person);
    if (toks.length >= 2) {
      pushIdx(peopleByFirstLast, `${toks[0]} ${toks[toks.length - 1]}`, person);
    }

    const surnames = getPersonSurnameList(person);
    const givens = getPersonGivenTokens(person, surnames);
    person._normSurnames = surnames;
    person._normGivens = givens;

    for (let si = 0; si < surnames.length; si++) {
      const sn = surnames[si];
      pushIdx(peopleBySurname, sn, person);
      if (sn.length >= 4 && !seenSurnames.has(sn)) {
        seenSurnames.add(sn);
        const ch = sn[0];
        let sArr = surnamesByFirstChar.get(ch);
        if (!sArr) {
          sArr = [];
          surnamesByFirstChar.set(ch, sArr);
        }
        sArr.push(sn);
      }
      for (let gi = 0; gi < givens.length; gi++) {
        const gv = givens[gi];
        pushIdx(peopleByFirstLast, `${gv} ${sn}`, person);
        pushIdx(peopleByLastInitial, `${sn}:${gv[0]}`, person);
        if (gv.length >= 3) {
          pushIdx(peopleBySurnamePrefix, `${sn}:${gv.slice(0, 3)}`, person);
        }
        const canon = getNicknameCanon(gv);
        if (canon) {
          pushIdx(peopleBySurnameNick, `${sn}:${canon}`, person);
        }
      }
    }
  }

  if (onProgress) onProgress({ stage: 'Complete', pct: 100 });

  return {
    fileName: fileName || 'family-tree.ged',
    peopleById,
    peopleList,
    peopleByFullNorm,
    peopleByFirstLast,
    peopleBySurname,
    peopleByLastInitial,
    peopleBySurnamePrefix,
    peopleBySurnameNick,
    surnamesByFirstChar,
    objeCount: objeById.size,
    famCount: famById.size,
    totalPhotoLinks,
    fileIndexByName,
    fileIndexByStem,
    fileIndexByNorm
  };
}

export async function parseGedcomFile(file, onProgress = null) {
  if (onProgress) onProgress({ stage: 'Reading GEDCOM file...', pct: 5 });
  const text = await file.text();
  const parsed = await parseGedcomText(text, file.name, onProgress);
  return {
    ...parsed,
    rawText: text
  };
}

export function findGedcomPeopleByName(gedData, rawName) {
  if (!gedData || !rawName) return [];
  const toks = extractNameTokens(rawName);
  if (toks.length === 0) return [];
  const fullKey = toks.join(' ');
  const exact = gedData.peopleByFullNorm && gedData.peopleByFullNorm.get(fullKey);
  if (exact && exact.length > 0) return exact;
  if (toks.length >= 2 && gedData.peopleByFirstLast) {
    const flKey = `${toks[0]} ${toks[toks.length - 1]}`;
    const fl = gedData.peopleByFirstLast.get(flKey);
    if (fl && fl.length > 0) return fl;
  }
  return [];
}

function dedupePeopleList(arr) {
  if (!Array.isArray(arr) || arr.length <= 1) return arr || [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

export function matchFilenameToGedcom(gedData, rawFileName, rawPath = '', rawDesc = '') {
  const empty = {
    type: null,
    confidence: null,
    score: 0,
    reason: '',
    matches: [],
    personMatches: [],
    possibleMatches: []
  };
  if (!gedData || !rawFileName) return empty;
  const fileName = extractBasename(rawFileName).toLowerCase();
  if (!fileName) return empty;

  let matches = gedData.fileIndexByName.get(fileName);
  if (matches && matches.length > 0) {
    return {
      type: 'obje_exact',
      confidence: 'exact',
      score: 100,
      reason: `Exact PAF filename match (${fileName})`,
      matches,
      personMatches: [],
      possibleMatches: []
    };
  }

  const stem = stripExt(fileName);
  if (stem) {
    matches = gedData.fileIndexByStem.get(stem);
    if (matches && matches.length > 0) {
      return {
        type: 'obje_stem',
        confidence: 'exact',
        score: 95,
        reason: `PAF filename match (${stem})`,
        matches,
        personMatches: [],
        possibleMatches: []
      };
    }
  }

  const norm = normalizeFileStem(fileName);
  if (norm && gedData.fileIndexByNorm) {
    matches = gedData.fileIndexByNorm.get(norm);
    if (matches && matches.length > 0) {
      return {
        type: 'obje_fuzzy',
        confidence: 'exact',
        score: 90,
        reason: `PAF normalized filename match (${norm})`,
        matches,
        personMatches: [],
        possibleMatches: []
      };
    }
  }

  const fileParts = extractFilenameParts(fileName);
  const descParts = rawDesc ? extractFilenameParts(String(rawDesc) + '.txt') : { words: [], initials: [] };
  const words = fileParts.words.slice();
  for (let i = 0; i < descParts.words.length; i++) {
    if (!words.includes(descParts.words[i])) words.push(descParts.words[i]);
  }
  const initials = fileParts.initials;
  const pathWords = extractPathWords(rawPath);

  // Tier 2a: Full name tokens match in filename
  if (words.length >= 2 && gedData.peopleByFullNorm) {
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const keyA = words.slice(i, j + 1).join(' ');
        const fullHits = gedData.peopleByFullNorm.get(keyA);
        if (fullHits && fullHits.length > 0 && fullHits.length <= 3) {
          return {
            type: 'filename_name',
            confidence: 'strong',
            score: 88,
            reason: `Full name in filename ("${fullHits[0].name}")`,
            matches: [],
            personMatches: fullHits,
            possibleMatches: []
          };
        }
      }
    }
  }

  // Tier 2b: First + Last OR Last + First in filename (collects multi-person hits in group filenames)
  if (words.length >= 2 && gedData.peopleByFirstLast) {
    const multiStrong = [];
    const seenIds = new Set();
    const pairLabels = [];
    let bestAmbiguous = null;
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const candidates = [
          gedData.peopleByFirstLast.get(`${words[i]} ${words[j]}`),
          gedData.peopleByFirstLast.get(`${words[j]} ${words[i]}`)
        ];
        for (let c = 0; c < candidates.length; c++) {
          const hits = candidates[c];
          if (!hits || hits.length === 0) continue;
          if (hits.length <= 3) {
            for (let hi = 0; hi < hits.length; hi++) {
              const p = hits[hi];
              if (p && !seenIds.has(p.id) && multiStrong.length < 6) {
                seenIds.add(p.id);
                multiStrong.push(p);
              }
            }
            const lbl = `"${words[i]}" + "${words[j]}"`;
            if (!pairLabels.includes(lbl) && pairLabels.length < 3) pairLabels.push(lbl);
          } else if (hits.length <= 10 && !bestAmbiguous) {
            bestAmbiguous = {
              type: 'ambiguous_name',
              confidence: 'possible',
              score: 70,
              reason: `Possible: "${words[i]} ${words[j]}" (${hits.length} relatives share name)`,
              matches: [],
              personMatches: [],
              possibleMatches: hits
            };
          }
        }
      }
    }
    if (multiStrong.length > 0) {
      return {
        type: 'filename_name',
        confidence: 'strong',
        score: 84,
        reason: `Name match in filename (${pairLabels.join(', ')})`,
        matches: [],
        personMatches: multiStrong,
        possibleMatches: []
      };
    }
    if (bestAmbiguous) return bestAmbiguous;
  }

  // Tier 2c: Nickname or 3+ char given prefix + exact surname (any order)
  if (words.length >= 2 && gedData.peopleBySurname) {
    const surnameWords = words.filter((w) => gedData.peopleBySurname.has(w));
    if (surnameWords.length > 0) {
      let possibleNick = null;
      for (let si = 0; si < surnameWords.length; si++) {
        const sn = surnameWords[si];
        for (let wi = 0; wi < words.length; wi++) {
          const gw = words[wi];
          if (gw === sn) continue;
          const canon = getNicknameCanon(gw);
          if (canon && gedData.peopleBySurnameNick) {
            const nickHits = gedData.peopleBySurnameNick.get(`${sn}:${canon}`);
            if (nickHits && nickHits.length > 0) {
              if (nickHits.length <= 3) {
                return {
                  type: 'filename_nickname',
                  confidence: 'strong',
                  score: 80,
                  reason: `Nickname + surname match ("${gw}" + "${sn}")`,
                  matches: [],
                  personMatches: nickHits,
                  possibleMatches: []
                };
              }
              if (nickHits.length <= 10 && !possibleNick) {
                possibleNick = {
                  type: 'filename_nickname',
                  confidence: 'possible',
                  score: 68,
                  reason: `Possible: nickname "${gw}" + "${sn}" (${nickHits.length} matches)`,
                  matches: [],
                  personMatches: [],
                  possibleMatches: nickHits
                };
              }
            }
          }
          if (gw.length >= 3 && gedData.peopleBySurnamePrefix) {
            const prefHits = gedData.peopleBySurnamePrefix.get(`${sn}:${gw.slice(0, 3)}`);
            if (prefHits && prefHits.length > 0) {
              const filtered = prefHits.filter((p) =>
                (p._normGivens || []).some((g) => g.startsWith(gw) || gw.startsWith(g))
              );
              if (filtered.length > 0 && filtered.length <= 3) {
                return {
                  type: 'filename_nickname',
                  confidence: 'strong',
                  score: 79,
                  reason: `Short name + surname match ("${gw}" + "${sn}")`,
                  matches: [],
                  personMatches: filtered,
                  possibleMatches: []
                };
              }
              if (filtered.length > 3 && filtered.length <= 10 && !possibleNick) {
                possibleNick = {
                  type: 'filename_nickname',
                  confidence: 'possible',
                  score: 67,
                  reason: `Possible: "${gw}" + "${sn}" (${filtered.length} matches)`,
                  matches: [],
                  personMatches: [],
                  possibleMatches: filtered
                };
              }
            }
          }
        }
      }
      if (possibleNick) return possibleNick;
    }
  }

  // Tier 2d: Folder path contains surname + filename contains given name / nickname / prefix
  if (pathWords.length > 0 && words.length >= 1 && gedData.peopleBySurname) {
    const pathSurnames = pathWords.filter((w) => gedData.peopleBySurname.has(w));
    for (let si = 0; si < pathSurnames.length; si++) {
      const sn = pathSurnames[si];
      for (let wi = 0; wi < words.length; wi++) {
        const gw = words[wi];
        if (gw === sn) continue;
        const exactHits = gedData.peopleByFirstLast && gedData.peopleByFirstLast.get(`${gw} ${sn}`);
        if (exactHits && exactHits.length > 0 && exactHits.length <= 3) {
          return {
            type: 'folder_name',
            confidence: 'strong',
            score: 78,
            reason: `Folder "${sn}" + filename "${gw}"`,
            matches: [],
            personMatches: exactHits,
            possibleMatches: []
          };
        }
        const canon = getNicknameCanon(gw);
        if (canon && gedData.peopleBySurnameNick) {
          const nickHits = gedData.peopleBySurnameNick.get(`${sn}:${canon}`);
          if (nickHits && nickHits.length > 0 && nickHits.length <= 3) {
            return {
              type: 'folder_name',
              confidence: 'strong',
              score: 76,
              reason: `Folder "${sn}" + filename "${gw}"`,
              matches: [],
              personMatches: nickHits,
              possibleMatches: []
            };
          }
        }
        if (gw.length >= 3 && gedData.peopleBySurnamePrefix) {
          const prefHits = gedData.peopleBySurnamePrefix.get(`${sn}:${gw.slice(0, 3)}`);
          if (prefHits && prefHits.length > 0) {
            const filtered = prefHits.filter((p) =>
              (p._normGivens || []).some((g) => g.startsWith(gw) || gw.startsWith(g))
            );
            if (filtered.length > 0 && filtered.length <= 3) {
              return {
                type: 'folder_name',
                confidence: 'strong',
                score: 75,
                reason: `Folder "${sn}" + filename "${gw}"`,
                matches: [],
                personMatches: filtered,
                possibleMatches: []
              };
            }
          }
        }
      }
    }
  }

  // Tier 3a (Possible): Surname + Single-Letter Initial (e.g. "Viola_J-4.jpg", "J_Viola.jpg", "ViolaJ.jpg")
  if (words.length >= 1 && initials.length >= 1 && gedData.peopleByLastInitial) {
    for (let wi = 0; wi < words.length; wi++) {
      const sn = words[wi];
      if (!gedData.peopleBySurname || !gedData.peopleBySurname.has(sn)) continue;
      for (let ii = 0; ii < initials.length; ii++) {
        const init = initials[ii];
        const hits = gedData.peopleByLastInitial.get(`${sn}:${init}`);
        if (hits && hits.length > 0 && hits.length <= 8) {
          return {
            type: 'surname_initial',
            confidence: 'possible',
            score: 68,
            reason: `Possible: "${sn}" + initial "${init.toUpperCase()}"`,
            matches: [],
            personMatches: [],
            possibleMatches: hits
          };
        }
      }
    }
  }

  // Tier 3b (Possible): Fuzzy spelling match on given name (exact surname) or surname (exact given name)
  if (words.length >= 2 && gedData.peopleBySurname) {
    const exactSurnames = words.filter((w) => gedData.peopleBySurname.has(w));
    for (let si = 0; si < exactSurnames.length; si++) {
      const sn = exactSurnames[si];
      const pool = gedData.peopleBySurname.get(sn) || [];
      if (pool.length === 0 || pool.length > 40) continue;
      const fuzzyHits = [];
      for (let wi = 0; wi < words.length; wi++) {
        const gw = words[wi];
        if (gw === sn || gw.length < 4) continue;
        const maxD = gw.length >= 7 ? 2 : 1;
        for (let pi = 0; pi < pool.length; pi++) {
          const person = pool[pi];
          const givens = person._normGivens || [];
          for (let gi = 0; gi < givens.length; gi++) {
            const g = givens[gi];
            if (g.length < 4) continue;
            if (boundedEditDistance(gw, g, maxD) <= maxD) {
              fuzzyHits.push(person);
              break;
            }
          }
        }
      }
      const uniqueHits = dedupePeopleList(fuzzyHits);
      if (uniqueHits.length > 0 && uniqueHits.length <= 6) {
        return {
          type: 'fuzzy_name',
          confidence: 'possible',
          score: 64,
          reason: `Possible spelling match near "${sn}"`,
          matches: [],
          personMatches: [],
          possibleMatches: uniqueHits
        };
      }
    }

    if (exactSurnames.length === 0 && gedData.surnamesByFirstChar) {
      for (let wi = 0; wi < words.length; wi++) {
        const sw = words[wi];
        if (sw.length < 4) continue;
        const maxD = sw.length >= 7 ? 2 : 1;
        const candSurnames = gedData.surnamesByFirstChar.get(sw[0]) || [];
        let matchedSn = '';
        for (let ci = 0; ci < candSurnames.length; ci++) {
          const csn = candSurnames[ci];
          if (Math.abs(csn.length - sw.length) > maxD) continue;
          if (boundedEditDistance(sw, csn, maxD) <= maxD) {
            matchedSn = csn;
            break;
          }
        }
        if (!matchedSn) continue;
        const fuzzyHits = [];
        for (let gi = 0; gi < words.length; gi++) {
          const gw = words[gi];
          if (gi === wi) continue;
          const exactFl = gedData.peopleByFirstLast && gedData.peopleByFirstLast.get(`${gw} ${matchedSn}`);
          if (exactFl) fuzzyHits.push(...exactFl);
          const canon = getNicknameCanon(gw);
          if (canon && gedData.peopleBySurnameNick) {
            const nickHits = gedData.peopleBySurnameNick.get(`${matchedSn}:${canon}`);
            if (nickHits) fuzzyHits.push(...nickHits);
          }
          if (gw.length >= 3 && gedData.peopleBySurnamePrefix) {
            const prefHits = gedData.peopleBySurnamePrefix.get(`${matchedSn}:${gw.slice(0, 3)}`);
            if (prefHits) {
              for (let pi = 0; pi < prefHits.length; pi++) {
                const p = prefHits[pi];
                if ((p._normGivens || []).some((g) => g.startsWith(gw) || gw.startsWith(g))) {
                  fuzzyHits.push(p);
                }
              }
            }
          }
        }
        const uniqueHits = dedupePeopleList(fuzzyHits);
        if (uniqueHits.length > 0 && uniqueHits.length <= 6) {
          return {
            type: 'fuzzy_name',
            confidence: 'possible',
            score: 62,
            reason: `Possible surname spelling match ("${sw}" ≈ "${matchedSn}")`,
            matches: [],
            personMatches: [],
            possibleMatches: uniqueHits
          };
        }
      }
    }
  }

  return empty;
}

export function scorePhotosForPerson(gedData, person, photoRecords, options = {}) {
  if (!person || !Array.isArray(photoRecords) || photoRecords.length === 0) return [];
  const limit = Number(options.limit) || 150;
  const includeSurnameOnly = options.includeSurnameOnly !== false;

  const pafBases = new Set();
  const pafStems = new Set();
  const pafNorms = new Set();
  if (Array.isArray(person.photoFileNames)) {
    for (let i = 0; i < person.photoFileNames.length; i++) {
      const raw = person.photoFileNames[i];
      const base = extractBasename(raw).toLowerCase();
      if (!base) continue;
      pafBases.add(base);
      const st = stripExt(base);
      if (st) pafStems.add(st);
      const nm = normalizeFileStem(base);
      if (nm && nm.length >= 4) pafNorms.add(nm);
    }
  }

  const surnames = person._normSurnames || getPersonSurnameList(person);
  const givens = person._normGivens || getPersonGivenTokens(person, surnames);
  const firstGiven = givens[0] || '';
  const givenCanons = new Set();
  const givenInitials = new Set();
  for (let i = 0; i < givens.length; i++) {
    const g = givens[i];
    if (g[0]) givenInitials.add(g[0]);
    const cn = getNicknameCanon(g);
    if (cn) givenCanons.add(cn);
  }
  const birthYear = parseGedYear(person.birthDate);
  const scored = [];

  for (let i = 0; i < photoRecords.length; i++) {
    const rec = photoRecords[i];
    if (!rec) continue;
    const rawName = rec.name || rec.file || '';
    if (!rawName) continue;
    const base = extractBasename(rawName).toLowerCase();
    const stem = stripExt(base);
    const norm = normalizeFileStem(base);

    let score = 0;
    let confidence = '';
    let reason = '';

    if (pafBases.has(base)) {
      score = 100;
      confidence = 'exact';
      reason = 'Exact PAF filename match';
    } else if (stem && pafStems.has(stem)) {
      score = 94;
      confidence = 'exact';
      reason = 'PAF filename stem match';
    } else if (norm && pafNorms.has(norm)) {
      score = 90;
      confidence = 'exact';
      reason = 'PAF normalized filename match';
    } else {
      const fileParts = extractFilenameParts(base);
      const descParts = rec.description ? extractFilenameParts(String(rec.description) + '.txt') : { words: [], initials: [] };
      const words = fileParts.words.slice();
      for (let di = 0; di < descParts.words.length; di++) {
        if (!words.includes(descParts.words[di])) words.push(descParts.words[di]);
      }
      const initials = fileParts.initials;
      const pathWords = extractPathWords(rec.path || rec.webkitRelativePath || '');

      let hasSurnameInFile = false;
      let matchedSurname = '';
      for (let wi = 0; wi < words.length; wi++) {
        if (surnames.includes(words[wi])) {
          hasSurnameInFile = true;
          matchedSurname = words[wi];
          break;
        }
      }
      let hasSurnameInPath = false;
      if (!hasSurnameInFile && pathWords.length > 0) {
        for (let pi = 0; pi < pathWords.length; pi++) {
          if (surnames.includes(pathWords[pi])) {
            hasSurnameInPath = true;
            matchedSurname = pathWords[pi];
            break;
          }
        }
      }

      let matchedGivenCount = 0;
      let hasFirstGiven = false;
      let hasNickOrPrefix = false;
      let hasFuzzyGiven = false;
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        if (surnames.includes(w)) continue;
        if (givens.includes(w)) {
          matchedGivenCount++;
          if (w === firstGiven) hasFirstGiven = true;
          continue;
        }
        const wc = getNicknameCanon(w);
        if (wc && givenCanons.has(wc)) {
          hasNickOrPrefix = true;
          continue;
        }
        if (w.length >= 3 && givens.some((g) => g.startsWith(w) || w.startsWith(g))) {
          hasNickOrPrefix = true;
          continue;
        }
        if (w.length >= 4 && givens.some((g) => g.length >= 4 && boundedEditDistance(w, g, w.length >= 7 ? 2 : 1) <= (w.length >= 7 ? 2 : 1))) {
          hasFuzzyGiven = true;
        }
      }

      let hasInitial = false;
      for (let ii = 0; ii < initials.length; ii++) {
        if (givenInitials.has(initials[ii])) {
          hasInitial = true;
          break;
        }
      }

      if (hasSurnameInFile && givens.length >= 2 && matchedGivenCount >= 2) {
        score = 88;
        confidence = 'strong';
        reason = 'Full name match in filename';
      } else if (hasSurnameInFile && hasFirstGiven) {
        score = 82;
        confidence = 'strong';
        reason = `First + last name match (${firstGiven} ${matchedSurname})`;
      } else if (hasSurnameInFile && matchedGivenCount >= 1) {
        score = 80;
        confidence = 'strong';
        reason = `Name match in filename`;
      } else if (hasSurnameInFile && hasNickOrPrefix) {
        score = 76;
        confidence = 'strong';
        reason = `Nickname / short name + ${matchedSurname}`;
      } else if (hasSurnameInPath && (hasFirstGiven || matchedGivenCount >= 1 || hasNickOrPrefix)) {
        score = 72;
        confidence = 'strong';
        reason = `Folder "${matchedSurname}" + given name`;
      } else if (hasSurnameInFile && hasInitial) {
        score = 68;
        confidence = 'possible';
        reason = `Possible: "${matchedSurname}" + initial`;
      } else if (hasSurnameInFile && hasFuzzyGiven) {
        score = 62;
        confidence = 'possible';
        reason = `Possible spelling match + ${matchedSurname}`;
      } else if (!hasSurnameInFile && (hasFirstGiven || hasNickOrPrefix) && surnames.some((sn) => sn.length >= 4 && words.some((w) => w.length >= 4 && boundedEditDistance(w, sn, sn.length >= 7 ? 2 : 1) <= (sn.length >= 7 ? 2 : 1)))) {
        score = 61;
        confidence = 'possible';
        reason = 'Possible surname spelling match';
      } else if (includeSurnameOnly && hasSurnameInFile) {
        score = 45;
        confidence = 'possible';
        reason = `Same surname (${matchedSurname})`;
      } else if (firstGiven.length >= 5 && words.includes(firstGiven)) {
        score = 40;
        confidence = 'possible';
        reason = `First name match ("${firstGiven}")`;
      }
    }

    if (score > 0) {
      if (birthYear) {
        const ym = rawName.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
        if (ym) {
          const py = Number(ym[1]);
          if (py >= birthYear && py <= birthYear + 100) score += 2;
        }
      }
      scored.push({ record: rec, score, confidence, reason });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export async function batchMatchPhotosToGedcom(gedData, photoRecords, onProgress = null, options = {}) {
  const strongMatches = [];
  const possibleMatches = [];
  const byPersonId = new Map();
  if (!gedData || !Array.isArray(photoRecords) || photoRecords.length === 0) {
    return { strongMatches, possibleMatches, byPersonId, totalScanned: 0, stopped: false };
  }

  const total = photoRecords.length;
  const CHUNK = 3000;
  let stopped = false;

  const pushPersonSuggestion = (person, rec, res) => {
    if (!person || !person.id) return;
    let arr = byPersonId.get(person.id);
    if (!arr) {
      arr = [];
      byPersonId.set(person.id, arr);
    }
    if (arr.length < 40) {
      arr.push({
        record: rec,
        score: res.score || 60,
        confidence: res.confidence || 'possible',
        reason: res.reason || '',
        type: res.type || ''
      });
    }
  };

  for (let i = 0; i < total; i += CHUNK) {
    if (options.shouldStop && options.shouldStop()) {
      stopped = true;
      break;
    }
    const end = Math.min(i + CHUNK, total);
    for (let j = i; j < end; j++) {
      const rec = photoRecords[j];
      if (!rec) continue;
      const rawName = rec.name || rec.file || '';
      const rawPath = rec.path || rec.webkitRelativePath || '';
      const rawDesc = rec.description || '';
      const res = matchFilenameToGedcom(gedData, rawName, rawPath, rawDesc);
      if (!res || !res.type) continue;

      if (res.confidence === 'exact' || res.confidence === 'strong') {
        const people = [];
        const seenPids = new Set();
        if (Array.isArray(res.matches)) {
          for (let mi = 0; mi < res.matches.length; mi++) {
            const m = res.matches[mi];
            for (let pi = 0; pi < (m.personIds || []).length; pi++) {
              const p = gedData.peopleById.get(m.personIds[pi]);
              if (p && !seenPids.has(p.id)) {
                seenPids.add(p.id);
                people.push(p);
              }
            }
          }
        }
        if (Array.isArray(res.personMatches)) {
          for (let pi = 0; pi < res.personMatches.length; pi++) {
            const p = res.personMatches[pi];
            if (p && !seenPids.has(p.id)) {
              seenPids.add(p.id);
              people.push(p);
            }
          }
        }
        if (people.length > 0 || (res.matches && res.matches.length > 0)) {
          strongMatches.push({
            record: rec,
            type: res.type,
            confidence: res.confidence,
            score: res.score,
            reason: res.reason,
            people,
            objeMatches: res.matches || []
          });
          for (let pi = 0; pi < people.length; pi++) {
            pushPersonSuggestion(people[pi], rec, res);
          }
        }
      } else if (res.confidence === 'possible' && Array.isArray(res.possibleMatches) && res.possibleMatches.length > 0) {
        possibleMatches.push({
          record: rec,
          type: res.type,
          confidence: 'possible',
          score: res.score,
          reason: res.reason,
          people: res.possibleMatches
        });
        for (let pi = 0; pi < res.possibleMatches.length; pi++) {
          pushPersonSuggestion(res.possibleMatches[pi], rec, res);
        }
      }
    }
    if (onProgress) {
      onProgress({
        scanned: end,
        total,
        strongCount: strongMatches.length,
        possibleCount: possibleMatches.length
      });
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  return {
    strongMatches,
    possibleMatches,
    byPersonId,
    totalScanned: stopped ? strongMatches.length + possibleMatches.length : total,
    stopped
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

  const attachPersonToPhoto = (p, person, seenNames, linkedSummaries) => {
    if (!person || !person.name) return false;
    const lifeBits = [
      person.birthDate || person.birthPlace ? `b. ${[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}` : '',
      person.deathDate || person.deathPlace ? `d. ${[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}` : ''
    ].filter(Boolean).join(' · ');
    const summaryLine = `${person.name}${lifeBits ? ` (${lifeBits})` : ''}${person.notes ? ` — ${person.notes}` : ''}`;
    if (!linkedSummaries.includes(summaryLine)) linkedSummaries.push(summaryLine);

    const key = person.name.toLowerCase();
    const existing = (p.people || []).find((x) => (x.name || '').toLowerCase() === key);
    if (existing) {
      let enriched = false;
      if (!existing.gedId && person.id) { existing.gedId = person.id; enriched = true; }
      if (!existing.birthDate && person.birthDate) { existing.birthDate = person.birthDate; enriched = true; }
      if (!existing.birthPlace && person.birthPlace) { existing.birthPlace = person.birthPlace; enriched = true; }
      if (!existing.deathDate && person.deathDate) { existing.deathDate = person.deathDate; enriched = true; }
      if (!existing.deathPlace && person.deathPlace) { existing.deathPlace = person.deathPlace; enriched = true; }
      if (!existing.notes && person.notes) { existing.notes = person.notes; enriched = true; }
      return enriched;
    }
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
      return true;
    }
    return false;
  };

  for (const p of photoItems) {
    const rawFile = p.file || p.filename || '';
    const fnMatch = matchFilenameToGedcom(gedData, rawFile, p.subfolder || p.path || '');
    const matches = fnMatch.matches || [];
    const personMatches = fnMatch.personMatches || [];

    // Also check existing tagged people/faces on this photo (matches even without middle name)
    const tagPeople = [];
    const existingTags = [
      ...(Array.isArray(p.people) ? p.people.map((x) => x.name) : []),
      ...(Array.isArray(p.faces) ? p.faces.map((f) => f.name) : [])
    ].filter(Boolean);
    for (const tagName of existingTags) {
      const found = findGedcomPeopleByName(gedData, tagName);
      if (found.length === 1) {
        tagPeople.push(found[0]);
      } else if (found.length > 1) {
        const exact = found.find((x) => (x.name || '').toLowerCase() === tagName.toLowerCase());
        if (exact) tagPeople.push(exact);
      }
    }

    if (matches.length === 0 && personMatches.length === 0 && tagPeople.length === 0) continue;

    matchedPhotos++;
    matchedIds.push(p.id);
    let photoChanged = false;
    const seenNames = new Set((p.people || []).map((x) => (x.name || '').toLowerCase()));
    const linkedSummaries = [];

    for (const m of matches) {
      for (const pid of m.personIds) {
        const person = gedData.peopleById.get(pid);
        if (attachPersonToPhoto(p, person, seenNames, linkedSummaries)) photoChanged = true;
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

    for (const pm of personMatches) {
      if (attachPersonToPhoto(p, pm, seenNames, linkedSummaries)) photoChanged = true;
    }
    for (const tp of tagPeople) {
      if (attachPersonToPhoto(p, tp, seenNames, linkedSummaries)) photoChanged = true;
    }

    if (!p.story && linkedSummaries.length > 0) {
      p.story = linkedSummaries.join('\n');
      photoChanged = true;
    }
    if (photoChanged) newlyUpdatedPhotos++;
  }

  return { matchedPhotos, newlyUpdatedPhotos, totalLinksRestored, matchedIds };
}
