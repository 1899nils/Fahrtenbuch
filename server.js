import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@db:5432/fahrtenbuch'
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Höheres Limit für GPS-Pfade

// Datenbank-Tabellen initialisieren
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        start_time TEXT,
        end_time TEXT,
        distance NUMERIC,
        type TEXT,
        locations JSONB,
        stoppages JSONB
      )
    `);
    console.log("Datenbank erfolgreich initialisiert");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};
initDb();

app.use(express.static(path.join(__dirname, 'dist')));

// API: Alle Fahrten laden
app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trips ORDER BY id DESC');
    // Konvertierung von snake_case (DB) zu camelCase (Frontend)
    const trips = result.rows.map(row => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      distance: parseFloat(row.distance),
      type: row.type,
      locations: row.locations,
      stoppages: row.stoppages
    }));
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Fahrten speichern
app.post('/api/trips', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trips = req.body;
    
    // In einer produktiven App würde man hier ein UPSERT oder gezielte Updates machen.
    // Für dieses Setup löschen wir und schreiben neu (einfachste Sync-Logik).
    await client.query('DELETE FROM trips');
    
    for (const trip of trips) {
      await client.query(
        'INSERT INTO trips (id, start_time, end_time, distance, type, locations, stoppages) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [trip.id, trip.startTime, trip.endTime, trip.distance, trip.type, JSON.stringify(trip.locations), JSON.stringify(trip.stoppages)]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
