// Deterministisches Prerendering der Augsburger GenerativBibel — OHNE LLM.
// Erzeugt je Fassung × Buch × Kapitel eine statische, crawlbare HTML-Seite
//   /{fassung}/{buch}/{kapitel}/index.html
// mit eigenem Title/Meta/Canonical/OG/JSON-LD + vorgerendertem Bibeltext,
// plus eine vollständige sitemap.xml. Die App (js/app.js) übernimmt beim Laden
// per Pfad-Routing und macht die Seite interaktiv (Slider, Urtext, Historie).
//
// Aufruf:  node _raw/prerender.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIVE = 'https://www.generativ-bibel.de';
const FASSUNGEN = [
  { slug: 'urtextnah', key: 'l1', name: 'Urtextnah' },
  { slug: 'mittel', key: 'l2', name: 'mittel' },
  { slug: 'lesefluss', key: 'l3', name: 'Lesefluss' },
];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const template = read('index.html');
const manifest = readJson('data/manifest.json');
const catalog = readJson('data/nt_books.json');
const metaById = {};
for (const b of catalog) metaById[b.id] = b;
const available = manifest.available || [];

// ---- Vorlage je Seite anpassen (deterministische String-Ersetzungen) ----
function buildPage(opts) {
  const { prefix, title, description, canonical, resultsHtml, jsonLd } = opts;
  let h = template;
  // Head-Tags
  h = h.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');
  h = h.replace(/(<meta name="description" content=")[\s\S]*?("\s*\/>)/, '$1' + esc(description) + '$2');
  h = h.replace(/(<link rel="canonical" href=")[^"]*("\s*\/>)/, '$1' + canonical + '$2');
  h = h.replace(/(<meta property="og:title" content=")[\s\S]*?("\s*\/>)/, '$1' + esc(title) + '$2');
  h = h.replace(/(<meta property="og:description" content=")[\s\S]*?("\s*\/>)/, '$1' + esc(description) + '$2');
  h = h.replace(/(<meta property="og:url" content=")[^"]*("\s*\/>)/, '$1' + canonical + '$2');
  h = h.replace(/(<meta name="twitter:title" content=")[\s\S]*?("\s*\/>)/, '$1' + esc(title) + '$2');
  h = h.replace(/(<meta name="twitter:description" content=")[\s\S]*?("\s*\/>)/, '$1' + esc(description) + '$2');
  // JSON-LD-Block ersetzen
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">\n' + jsonLd + '\n  </script>');
  // Inhalt einspeisen
  h = h.replace('<div id="results"></div>', '<div id="results">' + resultsHtml + '</div>');
  // Relative Asset-Pfade auf die Verschachtelungstiefe anheben
  h = h.replace('href="manifest.webmanifest"', 'href="' + prefix + 'manifest.webmanifest"');
  h = h.replace('href="icon.svg"', 'href="' + prefix + 'icon.svg"');
  h = h.replace('href="css/style.css"', 'href="' + prefix + 'css/style.css"');
  h = h.replace('src="js/app.js"', 'src="' + prefix + 'js/app.js"');
  h = h.replace("register('sw.js')", "register('" + prefix + "sw.js')");
  h = h.replace(/href="pruefbericht\.html"/g, 'href="' + prefix + 'pruefbericht.html"');
  return h;
}

// ---- Kapitel-Inhalt (entspricht der Render-Ausgabe der App) ----
function chapterResults(meta, chNum, chap, notes, fassung) {
  const ref = meta.name + ' ' + chNum;
  let html = '<div class="passage-head"><h2>' + esc(ref) + '</h2>'
    + '<span class="lvl-tag">Augsburger GenerativBibel ' + esc(fassung.name) + '</span></div>';
  html += '<div class="reader">';
  const verseNums = Object.keys(chap).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  for (const v of verseNums) {
    const verse = chap[String(v)] || chap[v];
    if (!verse) continue;
    const note = notes[chNum + ':' + v];
    if (verse.omitted) {
      const t = note ? note.text : 'Dieser Vers fehlt im zugrunde gelegten Urtext (Tischendorf).';
      html += '<p class="verse omitted" id="v' + v + '"><span class="vnum">' + v + '</span><span class="vtext">[ausgelassen] ' + esc(t) + '</span></p>';
      continue;
    }
    html += '<p class="verse" id="v' + v + '"><span class="vnum">' + v + '</span><span class="vtext">' + esc(verse[fassung.key] || '') + '</span></p>';
  }
  html += '</div>';

  // Interne Navigation (für Crawler + ohne JS); die App ersetzt das beim Hydrieren.
  const maxCh = meta.chapters;
  let nav = '<nav class="chapnav">';
  if (chNum > 1) nav += '<a class="cn-prev" href="../' + (chNum - 1) + '/">‹ ' + esc(meta.short || meta.name) + ' ' + (chNum - 1) + '</a> ';
  nav += '<a class="cn-home" href="../../../">Startseite</a>';
  if (chNum < maxCh) nav += ' <a class="cn-next" href="../' + (chNum + 1) + '/">' + esc(meta.short || meta.name) + ' ' + (chNum + 1) + ' ›</a>';
  nav += '</nav>';
  let fnav = '<nav class="fassungnav">Diese Stelle in anderer Fassung: ';
  fnav += FASSUNGEN.map((f) => '<a href="../../../' + f.slug + '/' + meta.id + '/' + chNum + '/">' + esc(f.name) + '</a>').join(' · ');
  fnav += '</nav>';
  return html + nav + fnav;
}

function chapterJsonLd(meta, chNum, fassung, url) {
  const ref = meta.name + ' ' + chNum;
  const g = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Augsburger GenerativBibel', item: LIVE + '/' },
        { '@type': 'ListItem', position: 2, name: meta.name, item: LIVE + '/' + fassung.slug + '/' + meta.id + '/1/' },
        { '@type': 'ListItem', position: 3, name: 'Kapitel ' + chNum, item: url },
      ],
    },
    {
      '@type': 'WebPage',
      name: ref + ' – Augsburger GenerativBibel (' + fassung.name + ')',
      inLanguage: 'de-DE',
      url: url,
      isPartOf: { '@type': 'Book', name: 'Augsburger GenerativBibel – Neues Testament', inLanguage: 'de-DE' },
      about: ref,
      isBasedOn: 'Tischendorf, Novum Testamentum Graece, 8. Ausgabe',
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': g }, null, 2).split('\n').map((l) => '  ' + l).join('\n');
}

// ---- Generieren ----
// Alte Ausgabe entfernen (sauberer Neuaufbau)
for (const f of FASSUNGEN) fs.rmSync(path.join(ROOT, f.slug), { recursive: true, force: true });

const sitemap = [LIVE + '/', LIVE + '/pruefbericht.html'];
let pages = 0;
for (const id of available) {
  const meta = metaById[id];
  if (!meta) { console.log('!! kein Katalog-Eintrag für ' + id); continue; }
  const book = readJson('data/books/' + id + '.json');
  const notes = book.notes || {};
  for (const f of FASSUNGEN) {
    for (let ch = 1; ch <= meta.chapters; ch++) {
      const chap = book.chapters[String(ch)] || book.chapters[ch];
      if (!chap) continue;
      const url = LIVE + '/' + f.slug + '/' + id + '/' + ch + '/';
      const title = meta.name + ' ' + ch + ' – Augsburger GenerativBibel (' + f.name + ')';
      const description = meta.name + ' ' + ch + ' in der Augsburger GenerativBibel, ' + f.name + '-Fassung – KI-übersetztes Neues Testament zum Lesen in drei Fassungen.';
      const html = buildPage({
        prefix: '../../../',
        title: title,
        description: description,
        canonical: url,
        resultsHtml: chapterResults(meta, ch, chap, notes, f),
        jsonLd: chapterJsonLd(meta, ch, f, url),
      });
      const dir = path.join(ROOT, f.slug, id, String(ch));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
      sitemap.push(url);
      pages++;
    }
  }
}

// sitemap.xml schreiben
const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + sitemap.map((u) => '  <url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm, 'utf8');

console.log('prerender: ' + pages + ' Kapitelseiten erzeugt (' + available.length + ' Bücher × ' + FASSUNGEN.length + ' Fassungen), sitemap.xml mit ' + sitemap.length + ' URLs.');
