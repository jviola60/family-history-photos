/* Shared sample data + helpers for the UI preview pages. Preview only - no real app logic. */
window.FH = {
  photo: 'sample.jpg',
  file: '2003-07-19-10-39-45-17239-b_103945.jpg',
  data: {
    people: [{ name: 'Josephine Helen Costello', rel: 'Grandmother' }],
    group: 'Grandmother', branch: 'Gill', decade: '2000s', date: '7/19/2003',
    place: 'Gill Family Reunion',
    story: 'Every year, we would have a Gill family reunion. Grandma loved to get together with her family. She loved to have her photo taken and be the center of attention.'
  },
  groups: ['Grandmother', 'Grandfather', 'Parents', 'Siblings', 'Cousins', 'Wedding', 'Reunion', 'Other'],
  decades: ['1900s', '1910s', '1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
  rels: ['Grandmother', 'Grandfather', 'Mother', 'Father', 'Aunt', 'Uncle', 'Cousin', 'Friend'],
  tools: [['✨', 'Fix Quality (4K)'], ['🔍', 'Magnify'], ['⤢', 'Make Bigger'], ['✂️', 'Crop & Erase'], ['👤', 'Re-scan Faces'], ['👁️', 'Remove Red Eyes']],
  share: [['📋', 'Copy for FamilySearch'], ['📤', 'Send to FamilySearch'], ['🗂️', 'Move to Review']],
  opts(list, sel) { return list.map(o => `<option${o === sel ? ' selected' : ''}>${o}</option>`).join(''); },
  toast(msg) {
    let t = document.getElementById('fh-toast');
    if (!t) { t = document.createElement('div'); t.id = 'fh-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
};
/* Any element with data-act shows a demo toast so every button feels clickable. */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  FH.toast(a === 'Save' ? '✔ Saved (preview only)' : `Preview only: "${a}" would run here.`);
});
document.addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('a');
  b.href = 'index.html'; b.className = 'fh-back'; b.textContent = '← All previews';
  document.body.appendChild(b);
});
