# Augsburger GenerativBibel — statische Web-App, ausgeliefert über serve.js.
# Konform zu PS#0005 (Docker Delivery): zustandslos, Konfiguration nur über
# Umgebungsvariablen, Logs nach stdout/stderr, Versionsendpunkt /.well-known/version.
FROM node:20-alpine
WORKDIR /app

# Nur Laufzeit-Dateien (keine Rohdaten/_raw, keine History-Schnappschüsse)
COPY serve.js index.html manifest.webmanifest sw.js icon.svg pruefbericht.html robots.txt sitemap.xml ./
COPY css ./css
COPY js ./js
COPY data ./data

# PS#0005: Version wird beim Build gesetzt
ARG BTV_IMAGE_VERSION=dev
ENV BTV_IMAGE_VERSION=$BTV_IMAGE_VERSION
LABEL de.bibeltv.version=$BTV_IMAGE_VERSION

# PS#0002: Webanwendung auf 8080
ENV PORT=8080
EXPOSE 8080

CMD ["node", "serve.js"]
