# Markus in drei Stufen

Eine kleine Web-App, die das **Markusevangelium** in **drei Übersetzungsstufen** anzeigt –
mit Suchfeld für Bibelstellen und einem Schieberegler, wie nah am Urtext der Text sein soll.

| Stufe | Schieberegler | Charakter |
|------|----|-----------|
| **1** | ganz links | **ganz nah am Urtext** – wörtlich/konkordant, griechische Wortstellung, historisches Präsens, Parataxe |
| **2** | Mitte | **mittlere Stufe** – genau, aber natürliches, flüssiges Deutsch |
| **3** | ganz rechts | **ganz frei** – heutiges Alltagsdeutsch, sehr verständlich |

## Starten

Voraussetzung: Node.js (getestet mit v24).

```bash
cd bibel-app
node serve.js
```

Dann im Browser **http://localhost:8080** öffnen.

> Hinweis: Bitte über den Server öffnen, **nicht** die `index.html` per Doppelklick –
> Browser blockieren beim direkten Öffnen (`file://`) das Laden der JSON-Daten.

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

Aktueller Stand: **v1 Erstübersetzung**, **v2 Qualitäts-Audit** (12 Korrekturen).

## Erweiterung auf weitere Bücher

Die Daten-Pipeline liegt in `_raw/`:
1. Griechischen Text holen (`_raw/fetch_greek.mjs`, Buchnummer anpassen).
2. Übersetzungs-Workflow (`_raw/wf_translate.js`) auf das neue Buch laufen lassen.
3. `_raw/assemble.js` erzeugt die `data/*.json`.

Der Reader (`js/app.js`) ist aktuell auf Markus zugeschnitten, lässt sich aber leicht
auf mehrere Bücher erweitern.
