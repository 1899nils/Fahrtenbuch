import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- LOGGING SETUP ---
const LOG_DIR = '/data/logs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(LOG_DIR, 'app.log'), { flags: 'a' });

function logger(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  console.log(formattedMessage.trim());
  logStream.write(formattedMessage);
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE SETUP ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@db:5432/fahrtenbuch'
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    logger(`DATABASE ERROR: Could not connect to database: ${err.stack}`);
  } else {
    logger('DATABASE SUCCESS: Connected to database');
    release();
  }
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Middleware to log all requests
app.use((req, res, next) => {
  logger(`${req.method} ${req.url}`);
  next();
});

// Static files (Built Frontend)
const frontendPath = path.join(__dirname, '../frontend/out');
app.use(express.static(frontendPath));

// --- API ENDPOINTS ---

app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trips ORDER BY start_time DESC');
    res.json(result.rows);
  } catch (err) {
    logger(`API ERROR (GET /api/trips): ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/waypoints/analyze', async (req, res) => {
  const { trip_id, points } = req.body;
  try {
    const analyzed = await analyzeWaypoints(points);
    res.json(analyzed);
  } catch (err) {
    logger(`API ERROR (POST /api/waypoints/analyze): ${err.message}`);
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
    logger(`API SUCCESS (POST /api/waypoints): Saved ${analyzedPoints.length} points for trip ${trip_id}`);
    res.json({ success: true, points: analyzedPoints.length });
  } catch (err) {
    await client.query('ROLLBACK');
    logger(`API ERROR (POST /api/waypoints): ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Helper functions
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            料理.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function analyzeWaypoints(points) {
  return points.map(p => ({ ...p, stop: false, traffic: false }));
}

// Catch-all route
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger(`Unified Server running on Port ${PORT}`);
});
