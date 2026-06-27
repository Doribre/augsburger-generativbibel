# Augsburger GenerativBibel

Eine Web-App, die das **vollständige Neue Testament** (alle 27 Bücher) in **drei Fassungen**
anzeigt – mit Suchfeld für Bibelstellen und einem Schieberegler, wie nah am Urtext der Text
sein soll. Die drei Fassungen heißen:

| Fassung | Schieberegler | Charakter |
|------|----|-----------|
| **Augsburger GenerativBibel Urtextnah** | ganz links | ganz nah am Urtext – wörtlich/konkordant, griechische Wortstellung, historisches Präsens, Parataxe |
| **Augsburger GenerativBibel mittel** | Mitte | genau, aber natürliches, flüssiges Deutsch |
| **Augsburger GenerativBibel Lesefluss** | ganz rechts | heutiges Alltagsdeutsch, sehr verständlich |

> **Hinweis:** Die Augsburger GenerativBibel ist **KI-erstellt (generativ)** und mehrstufig
> gegengeprüft, aber **keine** wissenschaftlich geprüfte Bibelausgabe. Eine Lesefassung/Annäherung.

## Starten

Voraussetzung: Node.js (getestet mit v24).

```bash
cd bibel-app
node serve.js
```

Dann im Browser **http://localhost:8080** öffnen.

> Hinweis: Bitte über den Server öffnen, **nicht** die `index.html` per Doppelklick –
> Browser blockieren beim direkten Öffnen (`file://`) das Laden der JSON-Daten.

## Betrieb / Deployment (Docker)

Auslieferung als Docker-Image, konform zu den Bibel-TV-Standards **PS#0002** (Port 8080) und
**PS#0005** (zustandslos, Konfiguration nur über Umgebungsvariablen, Logs nach `stdout`/`stderr`,
Versionsendpunkt).

**Umgebungsvariablen**

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `8080` | Port der Webanwendung. |
| `BTV_IMAGE_VERSION` | `dev` | Image-Version (Semantic Versioning), beim Build gesetzt; wird unter `/.well-known/version` ausgegeben. |

**Bauen & starten**

```bash
docker build --build-arg BTV_IMAGE_VERSION=1.0.0 -t generativ-bibel .
docker run -p 8080:8080 generativ-bibel
```

Versionsendpunkt (PS#0005): `GET /.well-known/version` → `text/plain` (z. B. `1.0.0`).

## Funktionen

- **Suchfeld** für Stellen: `Markus 1,1-8`, `Mk 4,35`, `8,27-30`, `3` (ganzes Kapitel).
  Buchname optional; Trennzeichen `,` `:` `.` und Bereiche mit `-` werden erkannt.
- **Schieberegler 1 · 2 · 3** wählt die Übersetzungsstufe (auch per Klick auf die Labels).
- **Urtext einblendbar** (Häkchen „Griechisch"): zeigt den Tischendorf-Text je Vers.
- **Strong-Lexikon**: bei eingeblendetem Urtext auf ein **griechisches Wort tippen** →
  Lemma, Transliteration, deutsche Grundbedeutung und Strong-Nummer.
- **Textkritische Hinweise**: ausgelassene Verse (7,16; 9,44.46; 11,26; 15,28),
  der längere Markusschluss 16,9–20 und die Variante in 1,1.
- Hell/Dunkel-Umschaltung, Kapitel-Navigation, Stellen-Verlinkung über die URL (`#1,1-8`).

## Quellen & Lizenzen

- **Griechischer Urtext:** Tischendorf, *Novum Testamentum Graece*, 8. Ausgabe (1869–72) –
  gemeinfrei. Bezogen über die bolls.life-API (Edition „TISCH", mit Strong-Nummern).
- **Wort-Lexikon:** *Strong's Greek Dictionary* in der JSON-Fassung von **OpenScriptures**
  (CC BY-SA). Die deutschen Kurzbedeutungen wurden daraus abgeleitet/übersetzt.
- **Die drei deutschen Übersetzungsstufen** wurden **eigens für diese App erstellt**
  (direkt aus dem Griechischen) und sind damit frei von Rechten Dritter.

## ⚠️ Wichtiger Hinweis zur Qualität

Die drei Übersetzungsstufen sind **KI-erstellt** und wurden in einem mehrstufigen Verfahren
(Übersetzen → adversariale Prüfung gegen den Urtext → Korrektur) gegengeprüft. Sie sind
sorgfältig gemacht, aber **keine wissenschaftlich vettete Bibelausgabe**. Für Studium,
Lehre und Verkündigung bitte zusätzlich anerkannte Übersetzungen heranziehen.

## Projektstruktur

```
bibel-app/
  index.html            – Oberfläche
  css/style.css         – Gestaltung (hell/dunkel)
  js/app.js             – Logik: Parser, Anzeige, Schieberegler, Strong-Popover
  serve.js              – Mini-Server ohne Abhängigkeiten
  data/
    mark.json           – Urtext + 3 Stufen je Vers (+ Strong-Wörter)  [aktuelle Fassung]
    lexicon.json        – Strong-Nr → Lemma/Translit/dt. Bedeutung/engl. Definition
    notes.json          – textkritische Hinweise
    history.json        – Versions-Manifest + Änderungs-Log (für die App)
  history/
    versions.json       – Liste aller Versionen (Label, Zeitpunkt, Quelle, Statistik)
    changes.json        – jede Einzeländerung (Stelle, Stufe, vorher→nachher, Grund, Zeit)
    mark_vN.json        – vollständiger Schnappschuss je Version
  _raw/                 – Rohdaten & Aufbau-/Versions-Skripte
```

## Versionierung & Änderungshistorie

Jede Fassung der Bibeltexte und jede Korrektur wird mit **Zeitstempel** protokolliert,
damit der Fortschritt (z. B. durch künftig bessere KI) nachvollziehbar bleibt.

**In der App** (dezent aufrufbar):
- Button **„↻ Verlauf"** oben rechts → Dialog mit allen Versionen und allen Änderungen.
- An jedem **geänderten Vers** ein kleines „↻"-Zeichen → zeigt die Historie genau dieses
  Verses (vorher→nachher, Stufe, Grund, Zeitpunkt).
- Fußzeile nennt stets die **aktuelle Fassung** mit Datum.

**Neue Version anlegen** (nachdem Texte verbessert wurden):
```bash
node _raw/assemble.js                 # data/mark.json aus _raw/out neu bauen
node _raw/version.js commit "v3: …" "Quelle/Modell"   # Schnappschuss + Diff + Log
node _raw/version.js list             # alle Versionen anzeigen
```
`version.js commit` legt `history/mark_vN.json` an, vergleicht mit der Vorversion und
schreibt jede geänderte Stelle (mit optionaler Begründungsdatei) nach `history/changes.json`.
Begründungen aus einem Audit lassen sich als Datei übergeben:
`node _raw/version.js commit "<Label>" "<Quelle>" pfad/zu/reasons.json`
(Format: `{ "kapitel:vers:stufe": { "reason": "…", "severity": "…" } }`).

Aktueller Stand: **vollständiges Neues Testament — alle 27 Bücher**, je drei Fassungen
(v1 Erstübersetzung). Markus zusätzlich mit unabhängigem **Qualitäts-Audit** (v2, 12 Korrekturen).

## Erweiterung auf weitere Bücher (robuste Routine)

Die App ist NT-fähig: Katalog aller 27 Bücher in `data/nt_books.json`, Verfügbarkeit in
`data/manifest.json`, ein Buch je Datei in `data/books/<id>.json`. Ein neues Buch hinzufügen:

1. **Urtext holen:** `_raw/fetch_greek_multi.mjs` (Buch-Konfig: bolls-Nummer, prefix, Kapitel)
   → `_raw/greek_<id>.json` + Kapiteldateien `_raw/ch/<prefix>_NN.txt`.
2. **Übersetzen (abbruchsicher):** siehe unten.
3. **Einbauen:** `node _raw/assemble.js <id> _raw/greek_<id>.json _raw/out_<prefix> _raw/notes_<id>.json`
   → schreibt `data/books/<id>.json`; `node _raw/build_manifest.js` schaltet es frei.
4. **Version protokollieren:** `node _raw/version.js commit '<metaJSON mit book/model/baseText>'`.
5. **(Optional) Audit:** unabhängiger Prüf-Durchlauf → `version.js commit` mit reasons-Datei → v2.

### Abbruchsichere Übersetzung (keine doppelten Tokens)
Jedes fertige Kapitel wird **sofort** als `_raw/out_<prefix>/<prefix>_NN.json` gespeichert —
bei Abbruch (Session-Limit, API-Aussetzer) bleibt alles Bisherige erhalten. Fortsetzen ohne
Doppelarbeit:

1. Fehlende Kapitel ermitteln:
   `node _raw/book_status.js <prefix> _raw/greek_<id>.json` → Ausgabe `TODO_JSON=[…]`.
   (Ein Kapitel gilt nur als fertig, wenn die Datei valides JSON mit vollständiger Versanzahl ist —
   halb geschriebene/kaputte Kapitel landen automatisch wieder in der TODO-Liste.)
2. Workflow nur für diese Kapitel starten — `args` um `todo` ergänzen, z. B.:
   `{ "prefix":"joh", "name":"Johannes", "chapters":21, "todo":[11,12,13,16,18,19,20,21] }`
   (Ohne `todo` werden alle Kapitel verarbeitet.)
3. Schritt 1–2 wiederholen, bis `TODO_JSON=[]` — dann assemblen + committen.
