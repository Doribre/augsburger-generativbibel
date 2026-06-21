export const meta = {
  name: 'strong-glossen-de',
  description: 'Deutsche Kurzbedeutungen für die 1336 Strong-Lemmata des Markusevangeliums (16 Batches), für das Antippen-Lexikon in Stufe 1.',
  phases: [{ title: 'Glossen', detail: '16 Batches à ~84 Lemmata → deutsche Grundbedeutung' }],
};

const BASE = 'C:/Users/brendernb/Code/bibel-app';

const GLOSS_SCHEMA = {
  type: 'object',
  properties: {
    glosses: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['glosses'],
};

function prompt(nn) {
  return (
    'Du bist Lexikograf für Koine-Griechisch (neutestamentliches Griechisch). ' +
    'Lies die Datei ' + BASE + '/_raw/lex/batch_' + nn + '.json — ein Array von Einträgen ' +
    '{n, lemma, translit, en (Strong-Definition englisch), kjv (KJV-Wörter)}.\n\n' +
    'Erstelle für JEDEN Eintrag eine knappe DEUTSCHE Grundbedeutung, wie in einem ' +
    'konzisen Wörterbuch: 1 bis ca. 6 Wörter, die Kernbedeutung(en). Mehrere ' +
    'Bedeutungen mit Semikolon trennen (z. B. „Anfang; Ursprung; Herrschaft"). ' +
    'Eigennamen als deutsche Namensform angeben (z. B. „Jesus", „Galiläa"). ' +
    'Nur Deutsch, kein Englisch, keine Strong-Nummer im Text, keine ganzen Sätze.\n\n' +
    'Gib { glosses: { "<n>": "deutsche Bedeutung", ... } } zurück und decke ALLE ' +
    'Einträge des Batches ab (Schlüssel = die Zahl n als String).'
  );
}

const batches = Array.from({ length: 16 }, (_, i) => String(i).padStart(2, '0'));

log('Erzeuge deutsche Strong-Glossen (16 Batches)…');

const results = await parallel(
  batches.map((nn) => () =>
    agent(prompt(nn), { label: 'glossen batch ' + nn, phase: 'Glossen', schema: GLOSS_SCHEMA })
  )
);

const merged = {};
let count = 0;
for (const r of results) {
  if (r && r.glosses) {
    for (const k in r.glosses) {
      merged[k] = r.glosses[k];
      count++;
    }
  }
}
log('Glossen gesamt: ' + count);
return { glossCount: count, glosses: merged };
