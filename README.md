# Fahrtenbuch GPS Tracker

Eine moderne, leichtgewichtige Progressive Web App (PWA) zur Aufzeichnung von Fahrten mittels GPS. Die Daten werden sowohl lokal im Browser als auch persistent auf einem Server (oder im Docker-Container) gespeichert.

## Features

- **Echtzeit-Tracking:** Erfassung der gefahrenen Kilometer via GPS (Geolocation API).
- **Persistenz:** Speicherung der Fahrten in einer `trips.json` Datei auf dem Server/Container.
- **PWA-Support:** Kann auf dem Smartphone als App installiert werden.
- **Kategorisierung:** Unterscheidung zwischen Dienstfahrten und Privatfahrten.
- **CSV-Export:** Export der Fahrtenliste für die Buchhaltung.
- **Modernes UI:** Glassmorphism-Design mit responsivem Layout.

## Quick Start mit Docker

Am einfachsten lässt sich die App mit Docker Compose starten:

```bash
docker-compose up --build
```

Die App ist anschließend unter **http://localhost:8080** erreichbar.

## Docker Konfiguration

Damit der Container einwandfrei funktioniert, sollten folgende Punkte beachtet bzw. hinterlegt werden:

1.  **Ports:**
    *   Der interne Node.js-Server läuft auf Port **3000**.
    *   In der `docker-compose.yml` ist standardmäßig ein Mapping auf Port **8080** (Host) gesetzt.
2.  **Volumes (Persistenz):**
    *   Das Verzeichnis `/data` im Container **muss** auf ein lokales Verzeichnis oder ein Docker-Volume gemappt werden, damit die Fahrten (`trips.json`) beim Neustart des Containers nicht verloren gehen.
    *   Beispiel: `- ./fahrten-data:/data`
3.  **Netzwerk & Sicherheit (Wichtig):**
    *   Für den produktiven Einsatz muss ein **Reverse Proxy (z.B. Nginx, Traefik)** vorgeschaltet werden, der **HTTPS** bereitstellt. Ohne HTTPS wird der Browser den Zugriff auf das GPS (Geolocation API) verweigern.
4.  **Dateiberechtigungen:**
    *   Der Container muss Schreibrechte auf das gemappte `/data` Verzeichnis haben, um die `trips.json` erstellen und aktualisieren zu können.

## Datenhaltung (Persistenz)

Die App nutzt ein Docker-Volume, um die Daten dauerhaft zu speichern. Im Projektverzeichnis wird automatisch ein Ordner `fahrten-data/` erstellt. Dieser ist mit dem Verzeichnis `/data` im Container verknüpft.

- **Datei-Pfad:** `./fahrten-data/trips.json`

## Wichtiger Hinweis zu GPS (HTTPS)

Die **Geolocation-API** (Standortbestimmung) wird von modernen Browsern aus Sicherheitsgründen **nur über HTTPS** oder `localhost` bereitgestellt. 

Wenn die App auf einem externen Server gehostet wird, muss zwingend ein SSL-Zertifikat (z.B. via Reverse Proxy wie Traefik oder Nginx mit Let's Encrypt) verwendet werden, da die Standortabfrage sonst fehlschlägt.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Node.js, Express (für die Datei-API)
- **Deployment:** Docker, Multi-stage Builds
- **Styling:** Vanilla CSS (Modern CSS variables)

## Entwicklung

Lokal ohne Docker starten:

1. Abhängigkeiten installieren: `npm install`
2. Frontend im Dev-Modus: `npm run dev`
3. Backend starten: `node server.js` (vorher `npm run build` ausführen, damit der `dist` Ordner existiert)
