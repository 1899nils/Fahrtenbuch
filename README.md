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
