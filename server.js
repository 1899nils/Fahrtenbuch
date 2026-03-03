import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = '/data';
const DATA_FILE = path.join(DATA_DIR, 'trips.json');

app.use(cors());
app.use(express.json());

// Sicherstellen, dass das Datenverzeichnis existiert
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialisiere die Datei, falls sie nicht existiert
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Statische Dateien aus dem "dist" Ordner ausliefern (Frontend)
app.use(express.static(path.join(__dirname, 'dist')));

// API: Alle Fahrten laden
app.get('/api/trips', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Lesen der Daten' });
  }
});

// API: Fahrten speichern
app.post('/api/trips', (req, res) => {
  try {
    const trips = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(trips, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern der Daten' });
  }
});

// Alle anderen Anfragen an die index.html leiten (für SPA Routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Daten werden gespeichert in: ${DATA_FILE}`);
});
