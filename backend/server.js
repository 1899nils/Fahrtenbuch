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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@db:5432/fahrtenbuch'
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Static files (Built Frontend)
const frontendPath = path.join(__dirname, '../frontend/out');
app.use(express.static(frontendPath));

// --- API ENDPOINTS ---

app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trips ORDER BY start_time DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/waypoints/analyze', async (req, res) => {
  const { trip_id, points } = req.body;
  try {
    const analyzed = await analyzeWaypoints(points);
    res.json(analyzed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/waypoints', async (req, res) => {
  const { trip_id, points } = req.body;
  if (!points) return res.status(400).send("No points");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const analyzedPoints = await analyzeWaypoints(points);
    for (const p of analyzedPoints) {
      await client.query(
        `INSERT INTO waypoints (trip_id, timestamp, lat, lng, speed, altitude, accuracy)
         VALUES ($1, to_timestamp($2/1000.0), $3, $4, $5, $6, $7)`,
        [trip_id, p.timestamp, p.latitude, p.longitude, p.speed, p.altitude, p.accuracy]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, points: analyzedPoints.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Helper functions (simplified for this update)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function analyzeWaypoints(points) {
  return points.map(p => ({ ...p, stop: false, traffic: false }));
}

// Catch-all route (must be LAST)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Unified Server running on Port ${PORT}`);
});
