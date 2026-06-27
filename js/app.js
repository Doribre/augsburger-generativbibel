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
  ref: null,         // (Legacy) – aktuelle Stelle = segments[0]
  segments: [],      // [{bookId, chapter, verses|null}] – Listen & Semikolon (FD#0004)
  pathMode: false,   // true = saubere Kapitel-URL führen (/{fassung}/{buch}/{kapitel}/)
};

const $ = (s) => document.querySelector(s);
const norm = (s) => String(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');

/* ---------------- Basis-Pfad & Fassungs-Slugs (für Prerender-/Kapitel-URLs) ----------------
   Die App-Wurzel wird aus dem eigenen <script src> abgeleitet — funktioniert an der
   Domain-Wurzel (live) genauso wie in einem Unterverzeichnis (GitHub-Pages-Preview),
   und auf tief verschachtelten Kapitelseiten wie /lesefluss/matthaeus/22/. */
const APP_SCRIPT = document.currentScript || document.querySelector('script[src*="js/app.js"]');
const APP_ORIGIN = (APP_SCRIPT && APP_SCRIPT.src ? APP_SCRIPT.src : (location.origin + '/js/app.js')).replace(/\/js\/app\.js(?:[?#].*)?$/, '');
const APP_BASE_PATH = APP_ORIGIN.replace(/^https?:\/\/[^/]+/, ''); // '' (live) oder '/augsburger-generativbibel' (Preview)
function dataUrl(p) { return APP_ORIGIN + '/' + String(p).replace(/^\//, ''); }
const FASSUNG_SLUG = { 1: 'urtextnah', 2: 'mittel', 3: 'lesefluss' };
const SLUG_FASSUNG = { urtextnah: 1, mittel: 2, lesefluss: 3 };

/* ---------------- Analytics (dataLayer / GTM) ---------------- */
// Stufe → current_translation gemäß Mess-Spezifikation
const TRANSLATION_KEY = { 1: 'AGB_urtextnah', 2: 'AGB_mittel', 3: 'AGB_lesefluss' };
function dl() { window.dataLayer = window.dataLayer || []; return window.dataLayer; }
function chapterSlug(bookId, chapter) { return String(bookId) + '-' + chapter; }
// Globale Parameter aktuell halten (bei jedem Buch-/Kapitel-/Stufenwechsel)
function updateGlobals() {
  const cur = (state.segments || [])[0];
  if (!cur) return;
  dl().push({
    bible_book: cur.bookId || '',
    bible_chapter: Number(cur.chapter) || 0,
    current_translation: TRANSLATION_KEY[state.level] || '',
  });
}
// Interaktions-Event: event:'interaction' mit type/destination/action
function track(type, destination, action) {
  const e = { event: 'interaction', type: type };
  if (destination !== undefined && destination !== null && destination !== '') e.destination = destination;
  if (action) e.action = action; // bei Übersetzungs-/Urtext-/Lexikon-Events weglassen
  dl().push(e);
}
// Heartbeat: alle 10 s, solange die Seite im Vordergrund ist
function startHeartbeat() {
  setInterval(function () {
    if (document.visibilityState === 'visible') dl().push({ event: 'visit_duration', page_seconds_view: 10 });
  }, 10000);
}

/* ---------------- Laden ---------------- */
async function boot() {
  initTheme();
  try {
    const [catalog, manifest, lex] = await Promise.all([
      fetch(dataUrl('data/nt_books.json')).then((r) => r.json()),
      fetch(dataUrl('data/manifest.json')).then((r) => r.json()),
      fetch(dataUrl('data/lexicon.json')).then((r) => r.json()),
    ]);
    state.catalog = catalog;
    state.manifest = manifest;
    state.lex = lex;
  } catch (e) {
    $('#results').innerHTML = '<div class="msg"><b>Daten konnten nicht geladen werden.</b><br>Bitte über den lokalen Server starten: <code>node serve.js</code> → <code>http://localhost:8080</code>.</div>';
    return;
  }
  try { state.history = await fetch(dataUrl('data/history.json')).then((r) => r.json()); } catch (e) { state.history = { versions: [], changes: [] }; }

  buildPatternMap();
  populateBookSelect();
  wireControls();
  syncSliderUI();

  // Start: Pfad (/{fassung}/{buch}/{kapitel}/) → sonst Hash → sonst erstes verfügbares Buch
  let segs = null;
  const fromPath = parsePath();
  if (fromPath && isAvailable(fromPath.bookId)) {
    state.level = fromPath.level; state.pathMode = true;
    segs = [{ bookId: fromPath.bookId, chapter: fromPath.chapter, verses: fromPath.verses }];
    const sl = $('#level'); if (sl) sl.value = state.level; syncSliderUI();
  }
  if (!segs) {
    const fromHash = parseQuery(decodeURIComponent(location.hash.replace(/^#/, '')), null);
    if (fromHash && fromHash.segments && isAvailable(fromHash.segments[0].bookId)) segs = fromHash.segments;
  }
  if (!segs) { const sb = (state.manifest.available && state.manifest.available[0]) || 'markus'; segs = [{ bookId: sb, chapter: 1, verses: null }]; }
  await loadSegments(segs);
  renderVersionFooter();
  render();
  if (state.pathMode) scrollToVerseAnchor();
  startHeartbeat();
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
    state.booksCache[id] = await fetch(dataUrl('data/books/' + id + '.json')).then((r) => r.json());
  }
  state.bookId = id;
  state.bookData = state.booksCache[id];
  state.notes = state.bookData.notes || {};
  buildChangeIndex();
  const sel = $('#bookSel'); if (sel) sel.value = id;
}

// Lädt alle in den Segmenten referenzierten Bücher und setzt das erste als „aktuell"
async function loadSegments(segs) {
  for (const bid of [...new Set(segs.map((s) => s.bookId))]) {
    if (!state.booksCache[bid]) state.booksCache[bid] = await fetch(dataUrl('data/books/' + bid + '.json')).then((r) => r.json());
  }
  await loadBook(segs[0].bookId);
  state.segments = segs;
}

/* ---------------- Hilfen ---------------- */
function maxVerse(ch) {
  const c = state.bookData && state.bookData.chapters[ch];
  if (!c) return 0;
  let m = 0;
  for (const k in c) if (/^\d+$/.test(k)) m = Math.max(m, Number(k));
  return m;
}

/* ---------------- Referenz-Parser (FD#0004) ----------------
   Fehlertolerant: ohne Satzzeichen, Leerzeichen als Trenner, Groß/klein egal,
   typografische Striche, Halbvers (5a), Versbereich (5-7), Versliste (5,7,9),
   mehrere Stellen per Semikolon (Buch/Kapitel-Carryover), eindeutige Abkürzungs-Präfixe. */
function resolveBook(phrase) {
  const n = norm(phrase);
  if (!n || !/[a-zäöü]/.test(n)) return null; // reine Ziffern = Kapitel, kein Buch
  if (state.patternMap[n]) return state.patternMap[n];
  const ids = [...new Set(Object.keys(state.patternMap).filter((k) => k.indexOf(n) === 0).map((k) => state.patternMap[k]))];
  return ids.length === 1 ? ids[0] : null; // eindeutiger Präfix
}
function parseVersePart(vp) {
  vp = vp.replace(/\s+/g, '');
  if (!vp) return null;
  const set = []; let any = false, ok = false;
  for (const it of vp.split(',').filter(Boolean)) {
    any = true;
    const r = it.match(/^(\d+)[a-z]?(?:-(\d+)[a-z]?)?$/i); // Halbvers-Buchstabe wird akzeptiert (Vollvers angezeigt)
    if (!r) continue;
    const a = Number(r[1]);
    if (r[2] !== undefined) { const b = Number(r[2]); ok = true; if (b < a) continue; for (let x = a; x <= b; x++) set.push(x); }
    else { set.push(a); ok = true; }
  }
  if (any && !ok) return undefined; // nichts Gültiges -> ungültig
  return [...new Set(set)].sort((x, y) => x - y);
}
function parseSpec(spec) {
  const m = String(spec).trim().match(/^(\d+)\s*[ ,:]?\s*(.*)$/);
  if (!m) return { error: true };
  const rest = (m[2] || '').trim();
  if (!rest) return { chapter: Number(m[1]), verses: null };
  const verses = parseVersePart(rest);
  if (verses === undefined) return { error: true };
  return { chapter: Number(m[1]), verses: verses };
}
function parseQuery(input, defaultBookId) {
  if (input == null) return { error: 'empty' };
  const s = String(input).replace(/ /g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return { error: 'empty' };
  const segs = [];
  let curBook = defaultBookId || null;
  for (const part of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    const toks = part.split(' ').filter(Boolean);
    let bookId = null, restToks = toks;
    for (let k = Math.min(toks.length, 4); k >= 1; k--) {
      const rest = toks.slice(k);
      if (rest.length === 0 || /^\d/.test(rest[0])) {
        const id = resolveBook(toks.slice(0, k).join(' '));
        if (id) { bookId = id; restToks = rest; break; }
      }
    }
    let specStr;
    if (bookId) { curBook = bookId; specStr = restToks.join(' '); }
    else specStr = part;
    if (!curBook) return { error: 'unknownbook', phrase: part };
    if (!isAvailable(curBook)) return { error: 'unavailable', bookId: curBook };
    if (!specStr) { segs.push({ bookId: curBook, chapter: 1, verses: null }); continue; }
    const sp = parseSpec(specStr);
    if (sp.error) return { error: 'format' };
    const meta = bookMeta(curBook);
    if (sp.chapter < 1 || sp.chapter > meta.chapters) return { error: 'chapter', bookId: curBook, max: meta.chapters };
    segs.push({ bookId: curBook, chapter: sp.chapter, verses: sp.verses });
  }
  return segs.length ? { segments: segs } : { error: 'empty' };
}
function segLabel(seg) {
  const name = bookName(seg.bookId);
  if (seg.verses == null) return name + ' ' + seg.chapter;
  const vs = seg.verses;
  if (!vs.length) return name + ' ' + seg.chapter;
  if (vs.length === 1) return name + ' ' + seg.chapter + ',' + vs[0];
  let contig = true; for (let i = 1; i < vs.length; i++) if (vs[i] !== vs[i - 1] + 1) { contig = false; break; }
  return name + ' ' + seg.chapter + ',' + (contig ? vs[0] + '-' + vs[vs.length - 1] : vs.join('.'));
}
function segmentsToString(segs) { return (segs || []).map(segLabel).join('; '); }

/* ---------------- Pfad-Routing (Kapitel-URLs) ---------------- */
function parseAnchorVerses(hash) {
  const m = String(hash || '').replace(/^#/, '').match(/^v(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  if (m[2]) { const b = Number(m[2]); if (b < a) return [a]; const arr = []; for (let x = a; x <= b; x++) arr.push(x); return arr; }
  return [a];
}
function parsePath() {
  let p = location.pathname;
  if (APP_BASE_PATH && p.indexOf(APP_BASE_PATH) === 0) p = p.slice(APP_BASE_PATH.length);
  const m = p.match(/^\/(urtextnah|mittel|lesefluss)\/([a-z0-9]+)\/(\d+)\/?$/);
  if (!m) return null;
  return { level: SLUG_FASSUNG[m[1]], bookId: m[2], chapter: Number(m[3]), verses: null }; // ganzes Kapitel; Anker (#v5) dient nur dem Scrollen/Hervorheben
}
function verseAnchor(verses) {
  if (!verses || !verses.length) return '';
  if (verses.length === 1) return 'v' + verses[0];
  let contig = true; for (let i = 1; i < verses.length; i++) if (verses[i] !== verses[i - 1] + 1) { contig = false; break; }
  return contig ? ('v' + verses[0] + '-' + verses[verses.length - 1]) : ('v' + verses[0]);
}
function scrollToVerseAnchor() {
  const m = String(location.hash || '').replace(/^#/, '').match(/^v(\d+)/);
  if (!m) return;
  const el = document.getElementById('v' + m[1]);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  document.querySelectorAll('.verse.vtarget').forEach((x) => x.classList.remove('vtarget'));
  el.classList.add('vtarget');
}
function chapterUrl(bookId, chapter, level, verses) {
  const u = (APP_BASE_PATH || '') + '/' + FASSUNG_SLUG[level] + '/' + bookId + '/' + chapter + '/';
  const a = verseAnchor(verses);
  return a ? (u + '#' + a) : u;
}
function syncUrl(push) {
  if (!state.pathMode) return;
  const segs = state.segments || [];
  if (segs.length !== 1) return; // Mehrfach-/Listensuche: keine kanonische Kapitel-URL
  const seg = segs[0];
  const path = (APP_BASE_PATH || '') + '/' + FASSUNG_SLUG[state.level] + '/' + seg.bookId + '/' + seg.chapter + '/';
  let hash = '';
  const a = verseAnchor(seg.verses);
  if (a) hash = '#' + a;
  else {
    // Ganzes Kapitel: vorhandenen Vers-Anker nur behalten, wenn wir auf demselben Kapitel bleiben (Slider/Fassungswechsel)
    const cur = parsePath();
    if (cur && cur.bookId === seg.bookId && cur.chapter === seg.chapter && /^#v\d/.test(location.hash)) hash = location.hash;
  }
  const u = path + hash;
  try { push ? history.pushState(null, '', u) : history.replaceState(null, '', u); } catch (e) {}
}

/* ---------------- Rendering ---------------- */
function render(push) {
  const segs = state.segments || [];
  const results = $('#results');
  const exEl = $('.examples'); if (exEl) exEl.hidden = true; // Beispiele ausblenden, sobald Bibeltext sichtbar ist
  if (!segs.length) { results.innerHTML = ''; return; }
  const lvl = LEVELS[state.level].key;
  let html = '';

  for (const seg of segs) {
    const data = state.booksCache[seg.bookId];
    if (!data) continue;
    const ch = seg.chapter;
    const chap = data.chapters[ch] || {};
    const isCur = seg.bookId === state.bookId;
    const notes = data.notes || {};
    const verseNums = (seg.verses && seg.verses.length)
      ? seg.verses
      : Object.keys(chap).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);

    html += '<div class="passage-head"><h2>' + escapeHtml(segLabel(seg)) + '</h2>';
    html += '<span class="lvl-tag">' + BRAND + ' ' + LEVELS[state.level].name + '</span></div>';
    html += '<div class="reader">';
    for (const v of verseNums) {
      const verse = chap[v];
      if (!verse) continue;
      const note = notes[ch + ':' + v];
      if (verse.omitted) {
        const t = note ? note.text : 'Dieser Vers fehlt im zugrunde gelegten Urtext (Tischendorf).';
        html += '<p class="verse omitted" id="v' + v + '"><span class="vnum">' + v + '</span><span class="vtext">[ausgelassen] ' + escapeHtml(t) + '</span></p>';
        continue;
      }
      const histMark = (isCur && state.changeIndex[ch + ':' + v])
        ? '<button class="vhist" data-ref="' + ch + ':' + v + '" title="Änderungshistorie dieses Verses">↻</button>' : '';
      html += '<p class="verse" id="v' + v + '"><span class="vnum">' + v + '</span>' + histMark + '<span class="vtext">' + escapeHtml(verse[lvl] || '') + '</span></p>';
      if (state.greek && verse.gr) html += '<div class="greek-line">' + renderGreek(verse.gw, verse.gr) + '</div>';
      if (note) {
        const label = note.type === 'variante' ? 'Textvariante' : note.type === 'schluss' ? 'Markusschluss' : note.type === 'perikope' ? 'Umstrittene Stelle' : 'Hinweis';
        html += '<div class="note"><b>' + label + ' (' + ch + ',' + v + '):</b> ' + escapeHtml(note.text) + '</div>';
      }
    }
    html += '</div>';
  }
  results.innerHTML = html;

  updateQuickNav();
  updateGlobals();
  $('#search').value = segmentsToString(segs);
  syncUrl(push);
}

function renderGreek(gw, gr) {
  if (Array.isArray(gw) && gw.length) {
    return gw.map((p) => '<span class="gw" data-s="' + p[1] + '" data-click-type="generativ_bibel_lexicon_word_clicked" data-destination="G' + p[1] + '">' + escapeHtml(p[0]) + '</span>').join(' ');
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
    state.pathMode = true;
    await loadSegments([{ bookId: id, chapter: 1, verses: null }]);
    closePopover(); renderVersionFooter(); render(true);
    track('generativ_bibel_chapter_changed', chapterSlug(id, 1), 'chapter_selected');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const slider = $('#level');
  slider.value = state.level;
  slider.addEventListener('input', () => { state.level = Number(slider.value); localStorage.setItem('mk_level', String(state.level)); state.pathMode = true; syncSliderUI(); render(); track('generativ_bibel_translation_changed', TRANSLATION_KEY[state.level]); });
  document.querySelectorAll('.slider-labels span').forEach((sp) => sp.addEventListener('click', () => { state.level = Number(sp.dataset.lvl); slider.value = state.level; localStorage.setItem('mk_level', String(state.level)); state.pathMode = true; syncSliderUI(); render(); track('generativ_bibel_translation_changed', TRANSLATION_KEY[state.level]); }));

  const gk = $('#greekToggle');
  gk.checked = state.greek;
  gk.addEventListener('change', () => { state.greek = gk.checked; localStorage.setItem('mk_greek', state.greek ? '1' : '0'); render(); track('generativ_bibel_urtext_toggle', gk.checked ? 'on' : 'off'); });

  $('#prevCh').addEventListener('click', () => navChapter(-1));
  $('#nextCh').addEventListener('click', () => navChapter(1));
  $('#theme').addEventListener('click', toggleTheme);

  const hb = $('#histBtn'); if (hb) hb.addEventListener('click', () => { track('menu_generativ_bibel_history'); openHistModal(); });
  const pb = document.querySelector('footer a[href="pruefbericht.html"]'); if (pb) pb.addEventListener('click', () => track('generativ_bibel_pruefbericht_open', 'pruefbericht.html'));
  const mc = document.querySelector('#histModal .modal-close'); if (mc) mc.addEventListener('click', closeHistModal);
  const mm = $('#histModal'); if (mm) mm.addEventListener('click', (e) => { if (e.target === mm) closeHistModal(); });

  document.addEventListener('click', (ev) => {
    const gw = ev.target.closest('.gw');
    if (gw) { ev.stopPropagation(); track('generativ_bibel_lexicon_word_clicked', 'G' + gw.dataset.s); showPopover(gw, gw.dataset.s); return; }
    const vh = ev.target.closest('.vhist');
    if (vh) { ev.stopPropagation(); showHistoryPopover(vh, vh.dataset.ref); return; }
    if (popoverEl && !ev.target.closest('.popover')) closePopover();
  });
  window.addEventListener('resize', closePopover);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePopover(); closeHistModal(); } });

  document.querySelectorAll('.examples code').forEach((c) => c.addEventListener('click', () => { $('#search').value = c.textContent; doSearch(); }));
}

async function doSearch() {
  const q = parseQuery($('#search').value, state.bookId);
  if (!q || q.error) { showError(q || { error: 'empty' }); return; }
  state.pathMode = true;
  await loadSegments(q.segments);
  closePopover(); renderVersionFooter(); render(true);
  const s0 = q.segments[0];
  track('generativ_bibel_chapter_changed', chapterSlug(s0.bookId, s0.chapter), 'chapter_search');
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
  const ex = $('.examples'); if (ex) ex.hidden = false; // bei Fehler/leerer Eingabe Beispiele einblenden
}

function navChapter(dir) {
  const cur = (state.segments || [])[0]; if (!cur) return;
  const meta = bookMeta(cur.bookId);
  const ch = cur.chapter + dir;
  if (ch < 1 || ch > meta.chapters) return;
  state.pathMode = true;
  state.segments = [{ bookId: cur.bookId, chapter: ch, verses: null }];
  closePopover(); render(true);
  track('generativ_bibel_chapter_changed', chapterSlug(cur.bookId, ch), dir > 0 ? 'next_chapter' : 'previous_chapter');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateQuickNav() {
  const cur = (state.segments || [])[0];
  const meta = bookMeta(cur ? cur.bookId : state.bookId);
  const ch = cur ? cur.chapter : 1;
  $('#prevCh').disabled = ch <= 1;
  $('#nextCh').disabled = ch >= meta.chapters;
  $('#chLabel').textContent = 'Kapitel ' + ch + ' / ' + meta.chapters;
}
function syncSliderUI() {
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
  const tb = $('#theme'); if (tb) tb.setAttribute('data-destination', next);
  track('menu_generativ_bibel_view_settings', next);
}

/* ---------------- Util ---------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Zurück/Vor im Browser: Kapitel-URL neu auswerten
window.addEventListener('popstate', async () => {
  const fp = parsePath();
  if (fp && isAvailable(fp.bookId)) {
    state.level = fp.level; state.pathMode = true;
    const sl = $('#level'); if (sl) sl.value = state.level; syncSliderUI();
    await loadSegments([{ bookId: fp.bookId, chapter: fp.chapter, verses: fp.verses }]);
    renderVersionFooter(); render(); scrollToVerseAnchor();
  }
});
window.addEventListener('hashchange', async () => {
  // Auf Kapitelseiten ist der Hash ein Vers-Anker (#v5) → nur scrollen.
  if (/^#v\d/.test(location.hash)) { scrollToVerseAnchor(); return; }
  // Legacy: Hash als Stellenangabe (#Markus 1,1-8)
  const q = parseQuery(decodeURIComponent(location.hash.replace(/^#/, '')), state.bookId);
  if (q && q.segments && segmentsToString(q.segments) !== segmentsToString(state.segments)) {
    await loadSegments(q.segments); renderVersionFooter(); render();
  }
});

boot();
