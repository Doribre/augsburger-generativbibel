'use strict';

const BRAND = 'Augsburger GenerativBibel';
const LEVELS = {
  1: { key: 'l1', name: 'Urtextnah', hint: 'ganz nah am Urtext · wörtlich/konkordant' },
  2: { key: 'l2', name: 'mittel', hint: 'genau & natürlich' },
  3: { key: 'l3', name: 'Lesefluss', hint: 'heutiges Alltagsdeutsch' },
};

const state = {
  catalog: null,     // nt_books.json
  manifest: null,    // manifest.json
  lex: null,
  history: { versions: [], changes: [] },
  bookId: null,
  bookData: null,    // aktuelles Buch
  notes: {},
  changeIndex: {},   // "ch:v" -> [change] (aktuelles Buch)
  booksCache: {},
  patternMap: {},    // normalisiert -> bookId
  level: Number(localStorage.getItem('mk_level')) || 2,
  greek: localStorage.getItem('mk_greek') === '1',
  ref: null,         // {bookId, chapter, from, to}
};

const $ = (s) => document.querySelector(s);
const norm = (s) => String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');

/* ---------------- Laden ---------------- */
async function boot() {
  initTheme();
  try {
    const [catalog, manifest, lex] = await Promise.all([
      fetch('data/nt_books.json').then((r) => r.json()),
      fetch('data/manifest.json').then((r) => r.json()),
      fetch('data/lexicon.json').then((r) => r.json()),
    ]);
    state.catalog = catalog;
    state.manifest = manifest;
    state.lex = lex;
  } catch (e) {
    $('#results').innerHTML = '<div class="msg"><b>Daten konnten nicht geladen werden.</b><br>Bitte über den lokalen Server starten: <code>node serve.js</code> → <code>http://localhost:8080</code>.</div>';
    return;
  }
  try { state.history = await fetch('data/history.json').then((r) => r.json()); } catch (e) { state.history = { versions: [], changes: [] }; }

  buildPatternMap();
  populateBookSelect();
  wireControls();
  syncSliderUI();

  // Start: Hash → sonst erstes verfügbares Buch
  const fromHash = parseRef(decodeURIComponent(location.hash.replace(/^#/, '')));
  let startBook = (state.manifest.available && state.manifest.available[0]) || 'markus';
  let startRef = null;
  if (fromHash && !fromHash.error && isAvailable(fromHash.bookId)) {
    startBook = fromHash.bookId; startRef = fromHash;
  }
  await loadBook(startBook);
  state.ref = startRef || { bookId: startBook, chapter: 1, from: 1, to: Math.min(8, maxVerse(1)) };
  buildChangeIndex();
  renderVersionFooter();
  render();
}

function isAvailable(bookId) {
  return !!(state.manifest && state.manifest.available && state.manifest.available.indexOf(bookId) >= 0);
}
function bookMeta(id) { return (state.catalog || []).find((b) => b.id === id) || { name: id, short: id }; }
function bookName(id) { return bookMeta(id).name; }

function buildPatternMap() {
  state.patternMap = {};
  for (const b of state.catalog) {
    const pats = [b.id, b.name, b.short].concat(b.abbr || []);
    for (const p of pats) state.patternMap[norm(p)] = b.id;
  }
}

async function loadBook(id) {
  if (!state.booksCache[id]) {
    state.booksCache[id] = await fetch('data/books/' + id + '.json').then((r) => r.json());
  }
  state.bookId = id;
  state.bookData = state.booksCache[id];
  state.notes = state.bookData.notes || {};
  buildChangeIndex();
  const sel = $('#bookSel'); if (sel) sel.value = id;
}

/* ---------------- Hilfen ---------------- */
function maxVerse(ch) {
  const c = state.bookData && state.bookData.chapters[ch];
  if (!c) return 0;
  let m = 0;
  for (const k in c) if (/^\d+$/.test(k)) m = Math.max(m, Number(k));
  return m;
}

/* ---------------- Referenz-Parser (alle NT-Bücher) ---------------- */
function parseRef(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(.*?)(\d+(?:\s*[,:.]\s*\d+(?:\s*[-–—]\s*\d+)?)?)\s*$/);
  if (!m) return { error: 'format' };
  const bookPhrase = m[1].trim();
  const numPart = m[2].replace(/\s+/g, '');

  let bookId = state.bookId;
  if (bookPhrase) {
    const id = state.patternMap[norm(bookPhrase)];
    if (!id) return { error: 'unknownbook', phrase: bookPhrase };
    bookId = id;
  }
  if (!bookId) return { error: 'format' };

  const nm = numPart.match(/^(\d+)(?:[,:.](\d+)(?:[-–—](\d+))?)?$/);
  if (!nm) return { error: 'format' };
  const chapter = Number(nm[1]);
  const meta = bookMeta(bookId);
  if (chapter < 1 || chapter > meta.chapters) return { error: 'chapter', bookId, max: meta.chapters };

  if (!isAvailable(bookId)) return { error: 'unavailable', bookId };

  // Verszahlen kennen wir sicher nur für das aktuell geladene Buch
  const sameBook = bookId === state.bookId;
  const mv = sameBook ? maxVerse(chapter) : 0;
  if (nm[2] === undefined) return { bookId, chapter, from: 1, to: sameBook ? mv : 1, whole: true };
  let from = Number(nm[2]);
  let to = nm[3] !== undefined ? Number(nm[3]) : from;
  if (sameBook) {
    if (to > mv) to = mv;
    if (from > mv) return { error: 'verse', bookId };
  }
  if (to < from) to = from;
  return { bookId, chapter, from, to };
}

function refToString(ref) {
  if (!ref) return '';
  const name = bookName(ref.bookId);
  if (ref.whole || (ref.from === 1 && ref.to === maxVerse(ref.chapter))) return name + ' ' + ref.chapter;
  if (ref.from === ref.to) return name + ' ' + ref.chapter + ',' + ref.from;
  return name + ' ' + ref.chapter + ',' + ref.from + '-' + ref.to;
}

/* ---------------- Rendering ---------------- */
function render() {
  const ref = state.ref;
  const results = $('#results');
  if (!ref || !state.bookData) { results.innerHTML = ''; return; }
  const lvl = LEVELS[state.level].key;
  const ch = ref.chapter;
  const chap = state.bookData.chapters[ch] || {};

  let html = '<div class="passage-head">';
  html += '<h2>' + escapeHtml(refToString(ref)) + '</h2>';
  html += '<span class="lvl-tag">' + BRAND + ' ' + LEVELS[state.level].name + '</span></div>';
  html += '<div class="reader">';

  for (let v = ref.from; v <= ref.to; v++) {
    const verse = chap[v];
    if (!verse) continue;
    const noteKey = ch + ':' + v;
    const note = state.notes[noteKey];

    if (verse.omitted) {
      const t = note ? note.text : 'Dieser Vers fehlt im zugrunde gelegten Urtext (Tischendorf).';
      html += '<p class="verse omitted" id="v' + v + '"><span class="vnum">' + v + '</span><span class="vtext">[ausgelassen] ' + escapeHtml(t) + '</span></p>';
      continue;
    }
    const histMark = state.changeIndex[ch + ':' + v]
      ? '<button class="vhist" data-ref="' + ch + ':' + v + '" title="Änderungshistorie dieses Verses">↻</button>' : '';
    html += '<p class="verse" id="v' + v + '"><span class="vnum">' + v + '</span>' + histMark + '<span class="vtext">' + escapeHtml(verse[lvl] || '') + '</span></p>';

    if (state.greek && verse.gr) html += '<div class="greek-line">' + renderGreek(verse.gw, verse.gr) + '</div>';
    if (note) {
      const label = note.type === 'variante' ? 'Textvariante' : note.type === 'schluss' ? 'Markusschluss' : note.type === 'perikope' ? 'Umstrittene Stelle' : 'Hinweis';
      html += '<div class="note"><b>' + label + ' (' + ch + ',' + v + '):</b> ' + escapeHtml(note.text) + '</div>';
    }
  }
  html += '</div>';
  results.innerHTML = html;

  updateQuickNav();
  location.hash = refToString(ref);
  $('#search').value = refToString(ref);
}

function renderGreek(gw, gr) {
  if (Array.isArray(gw) && gw.length) {
    return gw.map((p) => '<span class="gw" data-s="' + p[1] + '">' + escapeHtml(p[0]) + '</span>').join(' ');
  }
  return escapeHtml(gr);
}

/* ---------------- Popover (Strong + Historie) ---------------- */
let popoverEl = null;
function closePopover() { if (popoverEl) { popoverEl.remove(); popoverEl = null; } }
function positionPopover(p, targetEl) {
  const r = targetEl.getBoundingClientRect();
  const pw = p.offsetWidth, ph = p.offsetHeight;
  let left = window.scrollX + r.left;
  let top = window.scrollY + r.bottom + 6;
  if (left + pw > window.scrollX + document.documentElement.clientWidth - 8) left = window.scrollX + document.documentElement.clientWidth - pw - 8;
  if (left < window.scrollX + 8) left = window.scrollX + 8;
  if (r.bottom + ph + 12 > document.documentElement.clientHeight) top = window.scrollY + r.top - ph - 6;
  if (top < window.scrollY + 8) top = window.scrollY + 8;
  p.style.left = left + 'px';
  p.style.top = top + 'px';
}
function openPopover(targetEl, innerHtml, extraClass) {
  closePopover();
  const p = document.createElement('div');
  p.className = 'popover' + (extraClass ? ' ' + extraClass : '');
  p.innerHTML = innerHtml;
  document.body.appendChild(p);
  popoverEl = p;
  positionPopover(p, targetEl);
  const cb = p.querySelector('.pclose'); if (cb) cb.addEventListener('click', closePopover);
  return p;
}
function showPopover(targetEl, strong) {
  const e = state.lex[strong];
  let html;
  if (!e) html = '<button class="pclose">×</button><div class="pde">Keine Lexikon-Angabe</div><div class="pst">Strong G' + escapeHtml(String(strong)) + '</div>';
  else html = '<button class="pclose">×</button>' +
    '<div class="pg">' + escapeHtml(e.lemma || '') + '</div>' +
    '<div class="ptr">' + escapeHtml(e.translit || '') + '</div>' +
    '<div class="pde">' + escapeHtml(e.de || '') + '</div>' +
    (e.en ? '<div class="pen">' + escapeHtml(e.en) + '</div>' : '') +
    '<div class="pst">Strong G' + escapeHtml(String(strong)) + '</div>';
  openPopover(targetEl, html);
}

/* ---------------- Versions-Historie ---------------- */
const LVLNUM = { l1: 1, l2: 2, l3: 3 };
function buildChangeIndex() {
  state.changeIndex = {};
  const list = (state.history && state.history.changes) || [];
  for (const c of list) {
    if (c.book && c.book !== state.bookId) continue;
    const k = c.ch + ':' + c.v;
    (state.changeIndex[k] = state.changeIndex[k] || []).push(c);
  }
  for (const k in state.changeIndex) state.changeIndex[k].sort((a, b) => a.version - b.version);
}
function bookVersions(bookId) { return ((state.history && state.history.versions) || []).filter((v) => v.book === bookId); }
function versionOf(bookId, id) { return bookVersions(bookId).find((v) => v.id === id); }
function levelLabel(lvl) { const n = LVLNUM[lvl] || 0; return n ? ('Stufe ' + n + ' · ' + LEVELS[n].name) : lvl; }
function fmtDate(iso) { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }
function diffHtml(c) {
  return '<div class="hc-diff"><span class="d-old">' + escapeHtml(c.old) + '</span><span class="d-arrow">→</span><span class="d-new">' + escapeHtml(c.new) + '</span></div>';
}
function provLine(c) {
  return '<div class="hc-prov">Modell: ' + escapeHtml(c.model || '–') + ' · Grundtext: ' + escapeHtml(c.baseText || '–') + '</div>';
}
function showHistoryPopover(targetEl, ref) {
  const list = state.changeIndex[ref] || [];
  const parts = ref.split(':');
  let html = '<button class="pclose">×</button>';
  html += '<div class="ph">Änderungshistorie · ' + escapeHtml(bookMeta(state.bookId).short) + ' ' + parts[0] + ',' + parts[1] + '</div>';
  const v1 = bookVersions(state.bookId)[0];
  if (v1) html += '<div class="hc-base">Erstfassung: ' + escapeHtml(v1.label) + ' · ' + fmtDate(v1.timestamp) + '<br>Modell: ' + escapeHtml(v1.model || '–') + ' · Grundtext: ' + escapeHtml(v1.baseText || '–') + '</div>';
  for (const c of list) {
    const ver = versionOf(state.bookId, c.version);
    html += '<div class="hc"><div class="hc-top">' + escapeHtml(ver ? ver.label : ('v' + c.version)) + ' · ' + fmtDate(c.timestamp) + ' · ' + escapeHtml(levelLabel(c.level)) + (c.severity ? ' · ' + escapeHtml(c.severity) : '') + '</div>' +
      provLine(c) + (c.reason ? '<div class="hc-reason">' + escapeHtml(c.reason) + '</div>' : '') + diffHtml(c) + '</div>';
  }
  if (!list.length) html += '<div class="hc-base">Keine Änderungen – Text seit der Erstfassung unverändert.</div>';
  openPopover(targetEl, html, 'pop-hist');
}
function renderVersionFooter() {
  const el = $('#versionInfo'); if (!el) return;
  const vs = bookVersions(state.bookId);
  if (!vs.length) { el.innerHTML = ''; return; }
  const last = vs[vs.length - 1];
  el.innerHTML = 'Aktuelle Fassung (' + escapeHtml(bookName(state.bookId)) + '): <b>v' + last.id + ' · ' + escapeHtml(last.label) + '</b> – ' + fmtDate(last.timestamp) +
    ' · Modell ' + escapeHtml(last.model || '–') + ' · Grundtext ' + escapeHtml(last.baseText || '–') + '. ' +
    '<button class="linklike" id="openHist2">Versionen &amp; Änderungen</button>';
  const b = $('#openHist2'); if (b) b.addEventListener('click', openHistModal);
}
function openHistModal() {
  const m = $('#histModal'); if (!m) return;
  const versions = (state.history && state.history.versions) || [];
  const changes = (state.history && state.history.changes) || [];
  const books = [...new Set(versions.map((v) => v.book))];

  let html = '';
  for (const bid of books) {
    html += '<div class="hbook"><h4>' + escapeHtml(bookName(bid)) + '</h4>';
    for (const v of bookVersions(bid)) {
      html += '<div class="hv"><div class="hv-h">v' + v.id + ' · ' + escapeHtml(v.label) + '</div>' +
        '<div class="hv-m">' + fmtDate(v.timestamp) + ' · ' + (v.changeCount || 0) + ' Änderung(en) · ' + (v.verseCount || 0) + ' Verse</div>' +
        '<div class="hv-s">Modell: ' + escapeHtml(v.model || '–') + ' · Grundtext: ' + escapeHtml(v.baseText || '–') + (v.source ? ' · ' + escapeHtml(v.source) : '') + '</div></div>';
    }
    const bch = changes.filter((c) => c.book === bid);
    const byVer = {};
    for (const c of bch) (byVer[c.version] = byVer[c.version] || []).push(c);
    const ids = Object.keys(byVer).map(Number).sort((a, b) => b - a);
    for (const vid of ids) {
      const ver = versionOf(bid, vid);
      html += '<div class="hv-h" style="margin-top:12px">Änderungen in v' + vid + ' · ' + escapeHtml(ver ? ver.label : '') + ' (' + byVer[vid].length + ')</div>';
      for (const c of byVer[vid]) {
        html += '<div class="hc"><div class="hc-top">' + escapeHtml(bookMeta(bid).short) + ' ' + c.ch + ',' + c.v + ' · ' + escapeHtml(levelLabel(c.level)) + (c.severity ? ' · ' + escapeHtml(c.severity) : '') + '</div>' +
          (c.reason ? '<div class="hc-reason">' + escapeHtml(c.reason) + '</div>' : '') + diffHtml(c) + '</div>';
      }
    }
    html += '</div>';
  }
  if (!books.length) html = '<div class="hc-base">Noch keine Versionen protokolliert.</div>';
  m.querySelector('#histBody').innerHTML = html;
  m.hidden = false;
}
function closeHistModal() { const m = $('#histModal'); if (m) m.hidden = true; }

/* ---------------- Buchauswahl ---------------- */
function populateBookSelect() {
  const sel = $('#bookSel'); if (!sel) return;
  sel.innerHTML = '';
  for (const b of state.catalog) {
    const avail = isAvailable(b.id);
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name + (avail ? '' : ' — bald');
    opt.disabled = !avail;
    sel.appendChild(opt);
  }
}

/* ---------------- Controls ---------------- */
function wireControls() {
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); doSearch(); });
  $('#go').addEventListener('click', doSearch);

  const sel = $('#bookSel');
  if (sel) sel.addEventListener('change', async () => {
    const id = sel.value;
    if (!isAvailable(id)) return;
    await loadBook(id);
    state.ref = { bookId: id, chapter: 1, from: 1, to: Math.min(8, maxVerse(1)) };
    closePopover(); renderVersionFooter(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const slider = $('#level');
  slider.value = state.level;
  slider.addEventListener('input', () => { state.level = Number(slider.value); localStorage.setItem('mk_level', String(state.level)); syncSliderUI(); render(); });
  document.querySelectorAll('.slider-labels span').forEach((sp) => sp.addEventListener('click', () => { state.level = Number(sp.dataset.lvl); slider.value = state.level; localStorage.setItem('mk_level', String(state.level)); syncSliderUI(); render(); }));

  const gk = $('#greekToggle');
  gk.checked = state.greek;
  gk.addEventListener('change', () => { state.greek = gk.checked; localStorage.setItem('mk_greek', state.greek ? '1' : '0'); render(); });

  $('#prevCh').addEventListener('click', () => navChapter(-1));
  $('#nextCh').addEventListener('click', () => navChapter(1));
  $('#theme').addEventListener('click', toggleTheme);

  const hb = $('#histBtn'); if (hb) hb.addEventListener('click', openHistModal);
  const mc = document.querySelector('#histModal .modal-close'); if (mc) mc.addEventListener('click', closeHistModal);
  const mm = $('#histModal'); if (mm) mm.addEventListener('click', (e) => { if (e.target === mm) closeHistModal(); });

  document.addEventListener('click', (ev) => {
    const gw = ev.target.closest('.gw');
    if (gw) { ev.stopPropagation(); showPopover(gw, gw.dataset.s); return; }
    const vh = ev.target.closest('.vhist');
    if (vh) { ev.stopPropagation(); showHistoryPopover(vh, vh.dataset.ref); return; }
    if (popoverEl && !ev.target.closest('.popover')) closePopover();
  });
  window.addEventListener('resize', closePopover);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePopover(); closeHistModal(); } });

  document.querySelectorAll('.examples code').forEach((c) => c.addEventListener('click', () => { $('#search').value = c.textContent; doSearch(); }));
}

async function doSearch() {
  const ref = parseRef($('#search').value);
  if (!ref || ref.error) { showError(ref || { error: 'empty' }); return; }
  if (ref.bookId !== state.bookId) await loadBook(ref.bookId);
  // Verse nach Buchwechsel ggf. begrenzen
  const mv = maxVerse(ref.chapter);
  if (ref.whole || ref.to > mv) ref.to = mv;
  if (ref.from > mv) { showError({ error: 'verse' }); return; }
  state.ref = ref;
  closePopover(); renderVersionFooter(); render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(err) {
  const kind = err.error;
  const map = {
    unknownbook: 'Buch „' + escapeHtml(err.phrase || '') + '" nicht erkannt. Beispiele: <code>Markus 1,1-8</code>, <code>Joh 3,16</code>.',
    unavailable: '<b>' + escapeHtml(bookName(err.bookId)) + '</b> ist noch nicht verfügbar – dieses Buch kommt bald. Verfügbar ist aktuell: ' + escapeHtml((state.manifest.available || []).map(bookName).join(', ')) + '.',
    format: 'Konnte die Stelle nicht verstehen. Beispiele: <code>Markus 1,1-8</code>, <code>Mk 4,35</code>, <code>3</code> (ganzes Kapitel).',
    chapter: 'Dieses Buch hat so viele Kapitel nicht (max. ' + (err.max || '?') + ').',
    verse: 'Diesen Vers gibt es im Kapitel nicht.',
    empty: 'Bitte eine Bibelstelle eingeben, z. B. <code>Markus 1,1-8</code>.',
  };
  $('#results').innerHTML = '<div class="msg">' + (map[kind] || map.empty) + '</div>';
}

function navChapter(dir) {
  if (!state.ref) return;
  const meta = bookMeta(state.bookId);
  let ch = state.ref.chapter + dir;
  if (ch < 1 || ch > meta.chapters) return;
  state.ref = { bookId: state.bookId, chapter: ch, from: 1, to: maxVerse(ch), whole: true };
  closePopover(); render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateQuickNav() {
  const meta = bookMeta(state.bookId);
  const ch = state.ref ? state.ref.chapter : 1;
  $('#prevCh').disabled = ch <= 1;
  $('#nextCh').disabled = ch >= meta.chapters;
  $('#chLabel').textContent = 'Kapitel ' + ch + ' / ' + meta.chapters;
}
function syncSliderUI() {
  const L = LEVELS[state.level];
  $('#levelName').innerHTML = '<b>' + BRAND + ' ' + L.name + '</b> <span style="opacity:.8">· ' + L.hint + '</span>';
  document.querySelectorAll('.slider-labels span').forEach((sp) => sp.classList.toggle('active', Number(sp.dataset.lvl) === state.level));
}

/* ---------------- Theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem('mk_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mk_theme', next);
}

/* ---------------- Util ---------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.addEventListener('hashchange', async () => {
  const r = parseRef(decodeURIComponent(location.hash.replace(/^#/, '')));
  if (r && !r.error && refToString(r) !== refToString(state.ref)) {
    if (r.bookId !== state.bookId) await loadBook(r.bookId);
    const mv = maxVerse(r.chapter); if (r.whole || r.to > mv) r.to = mv;
    state.ref = r; renderVersionFooter(); render();
  }
});

boot();
