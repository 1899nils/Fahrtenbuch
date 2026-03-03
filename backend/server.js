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

// Hilfsfunktion: Distanz zwischen zwei Punkten (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Hilfsfunktion: Tempolimit von OSM abfragen (mit einfachem Cache)
const speedLimitCache = new Map();
async function getSpeedLimit(lat, lng) {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (speedLimitCache.has(cacheKey)) return speedLimitCache.get(cacheKey);

  try {
    const query = `[out:json];way(around:50,${lat},${lng})[maxspeed];out tags;`;
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    let speedLimit = 50; // Standardfall innerorts
    if (data.elements && data.elements.length > 0) {
      const tag = data.elements[0].tags.maxspeed;
      const parsed = parseInt(tag);
      if (!isNaN(parsed)) speedLimit = parsed;
      else if (tag === 'none') speedLimit = 130; // Autobahn unbegrenzt
    }
    
    speedLimitCache.set(cacheKey, speedLimit);
    return speedLimit;
  } catch (err) {
    return 50; // Fallback
  }
}

// --- ALGORITHMUS: Wegpunkte verarbeiten ---
async function analyzeWaypoints(points) {
  if (points.length < 2) return points;

  let lastMovingIndex = 0;
  const analyzedPoints = points.map(p => ({ ...p, stop: false, traffic: false }));

  for (let i = 1; i < analyzedPoints.length; i++) {
    const p1 = analyzedPoints[i-1];
    const p2 = analyzedPoints[i];

    // 1. Stopp-Erkennung (> 3 Min Stillstand)
    const timeDiffMs = p2.timestamp - p1.timestamp;
    const isStationary = (p2.speed || 0) < 0.5; // < 1.8 km/h

    if (!isStationary) {
      const stationaryDuration = p2.timestamp - analyzedPoints[lastMovingIndex].timestamp;
      if (stationaryDuration > 180000) { // 3 Minuten
        for (let j = lastMovingIndex; j <= i; j++) {
          analyzedPoints[j].stop = true;
        }
      }
      lastMovingIndex = i;
    }

    // 2. Verkehrs-Analyse (Passiv)
    // Nur prüfen, wenn wir uns bewegen und nicht gerade in einem erkannten Stopp sind
    if (!isStationary && !analyzedPoints[i].stop) {
      const dist = getDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      if (dist > 50) { // Nur Segmente > 50m prüfen
        const speedLimit = await getSpeedLimit(p2.latitude, p2.longitude);
        const expectedSpeed = speedLimit * 0.8 / 3.6; // in m/s (80% vom Limit)
        const expectedTime = dist / expectedSpeed; // in Sekunden
        const actualTime = timeDiffMs / 1000;

        if (actualTime > expectedTime * 1.5) { // Verzögerung > 150%
          analyzedPoints[i].traffic = true;
        }
      }
    }
  }
  return analyzedPoints;
}

// --- API ENDPOINTS ---

app.post('/api/waypoints/analyze', async (req, res) => {
  const { trip_id, points } = req.body;
  try {
    const analyzed = await analyzeWaypoints(points);
    // Optional: Ergebnisse direkt in die DB schreiben (hier nur Rückgabe)
    res.json(analyzed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bestehender Sync-Endpoint mit integrierter Analyse
app.post('/api/waypoints', async (req, res) => {
  const { trip_id, points } = req.body;
  if (!points) return res.status(400).send("No points");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Wegpunkte vor dem Speichern analysieren
    const analyzedPoints = await analyzeWaypoints(points);

    for (const p of analyzedPoints) {
      await client.query(
        `INSERT INTO waypoints (trip_id, timestamp, lat, lng, speed, altitude, accuracy)
         VALUES ($1, to_timestamp($2/1000.0), $3, $4, $5, $6, $7)`,
        [trip_id, p.timestamp, p.latitude, p.longitude, p.speed, p.altitude, p.accuracy]
      );
    }

    // Wenn Staus oder Stopps gefunden wurden, Trip-Tabelle aktualisieren (Beispiel)
    const trafficCount = analyzedPoints.filter(p => p.traffic).length;
    if (trafficCount > 5) {
      await client.query("UPDATE trips SET purpose = 'Stau erkannt' WHERE id = $1", [trip_id]);
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

// ... (Rest der server.js wie zuvor)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend mit Intelligenter Analyse läuft auf Port ${PORT}`);
});
