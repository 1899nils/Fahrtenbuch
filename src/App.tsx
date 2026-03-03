import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix für Leaflet Icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number | null;
}

interface Stoppage {
  type: 'Stau' | 'Tanken/Halt';
  startTime: number;
  endTime?: number;
  latitude: number;
  longitude: number;
}

interface Trip {
  id: string;
  startTime: string;
  endTime?: string;
  distance: number;
  type: 'Dienstlich' | 'Privat';
  locations: Location[];
  stoppages: Stoppage[];
}

type View = 'dashboard' | 'history' | 'stats';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Komponente um die Karte zu zentrieren
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center);
  return null;
}

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isTracking, setIsTracking] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const watchId = useRef<number | null>(null);
  const lastActivityTime = useRef<number>(Date.now());

  // Daten vom Backend laden
  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setTrips(data); })
      .catch(err => console.error("Sync Error:", err));
  }, []);

  // Daten zum Backend synchronisieren
  useEffect(() => {
    if (trips.length > 0) {
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trips)
      }).catch(err => console.error("Save Error:", err));
    }
  }, [trips]);

  const startTracking = () => {
    const newTrip: Trip = {
      id: Date.now().toString(),
      startTime: new Date().toLocaleString(),
      distance: 0,
      type: 'Privat',
      locations: [],
      stoppages: []
    };
    setCurrentTrip(newTrip);
    setIsTracking(true);
    lastActivityTime.current = Date.now();

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const newLoc = { latitude, longitude, timestamp: pos.timestamp, speed };

        setCurrentTrip(prev => {
          if (!prev) return null;
          const locations = [...prev.locations, newLoc];
          let distance = prev.distance;
          let stoppages = [...prev.stoppages];

          if (prev.locations.length > 0) {
            const last = prev.locations[prev.locations.length - 1];
            const d = calculateDistance(last.latitude, last.longitude, latitude, longitude);
            distance += d;

            // Stopp-Erkennung (Einfache Logik: Wenn Speed < 1km/h für > 2 Min)
            const isMoving = speed && speed > 0.5; // ca 1.8 km/h
            if (!isMoving) {
              const idleTime = Date.now() - lastActivityTime.current;
              if (idleTime > 120000) { // 2 Minuten Stillstand
                const type = distance > 0.1 ? 'Stau' : 'Tanken/Halt';
                const lastStop = stoppages[stoppages.length - 1];
                
                if (!lastStop || lastStop.endTime) {
                  stoppages.push({
                    type,
                    startTime: lastActivityTime.current,
                    latitude,
                    longitude
                  });
                }
              }
            } else {
              lastActivityTime.current = Date.now();
              // Letzten Stopp beenden falls vorhanden
              if (stoppages.length > 0 && !stoppages[stoppages.length - 1].endTime) {
                stoppages[stoppages.length - 1].endTime = Date.now();
              }
            }
          }

          return { ...prev, locations, distance, stoppages };
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  };

  const stopTracking = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if (currentTrip) {
      const finalTrip = { ...currentTrip, endTime: new Date().toLocaleTimeString() };
      setTrips([finalTrip, ...trips]);
      setCurrentTrip(null);
    }
    setIsTracking(false);
  };

  const polylinePositions = currentTrip?.locations.map(l => [l.latitude, l.longitude] as [number, number]) || [];
  const mapCenter = polylinePositions.length > 0 ? polylinePositions[polylinePositions.length - 1] : [51.1657, 10.4515] as [number, number];

  return (
    <div className="app-container">
      <header className="header">
        <h2>Fahrtenbuch PRO</h2>
        {isTracking && <span className="badge badge-dienstlich" style={{animation: 'pulse 2s infinite'}}>Rec ●</span>}
      </header>

      <main className="main-content">
        {activeView === 'dashboard' && (
          <div className="view-fade">
            <div className="glass-card">
              <h3>{isTracking ? 'Aktuelle Fahrt' : 'Bereit für die Fahrt?'}</h3>
              <div className="map-wrapper">
                <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {polylinePositions.length > 0 && <Polyline positions={polylinePositions} color="blue" />}
                  <ChangeView center={mapCenter} />
                </MapContainer>
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <div>
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>Distanz</p>
                  <strong style={{fontSize: '1.5rem'}}>{currentTrip?.distance.toFixed(2) || '0.00'} km</strong>
                </div>
                {isTracking && (
                  <div>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>Stopps</p>
                    <strong>{currentTrip?.stoppages.length || 0}</strong>
                  </div>
                )}
              </div>

              {!isTracking ? (
                <button className="primary-btn" style={{width: '100%'}} onClick={startTracking}>Neue Fahrt starten</button>
              ) : (
                <button className="stop-btn" style={{width: '100%'}} onClick={stopTracking}>Fahrt beenden</button>
              )}
            </div>

            {currentTrip?.stoppages.map((s, i) => (
              <div key={i} className="stoppage-info">
                ⚠️ {s.type} erkannt um {new Date(s.startTime).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}

        {activeView === 'history' && (
          <div className="view-fade">
            <h3>Letzte Fahrten</h3>
            <br />
            {trips.length === 0 ? <p>Keine Fahrten vorhanden.</p> : (
              <ul>
                {trips.map(t => (
                  <li key={t.id} className="trip-item">
                    <div className="trip-info">
                      <h4>{t.startTime.split(',')[0]}</h4>
                      <p>{t.startTime.split(',')[1]} - {t.endTime}</p>
                      {t.stoppages.length > 0 && <span style={{fontSize: '0.7rem', color: 'var(--warning)'}}>• {t.stoppages.length} Stopps</span>}
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <div style={{fontWeight: 'bold'}}>{t.distance.toFixed(2)} km</div>
                      <span className={`badge ${t.type === 'Dienstlich' ? 'badge-dienstlich' : 'badge-privat'}`}>{t.type}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeView === 'stats' && (
          <div className="view-fade">
            <h3>Statistik</h3>
            <div className="glass-card" style={{marginTop: '1rem'}}>
              <p>Gesamtdistanz</p>
              <h2>{trips.reduce((acc, t) => acc + t.distance, 0).toFixed(1)} km</h2>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <div className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
          <span className="nav-icon">🚗</span>
          <span>Fahrt</span>
        </div>
        <div className={`nav-item ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
          <span className="nav-icon">📅</span>
          <span>Verlauf</span>
        </div>
        <div className={`nav-item ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>
          <span className="nav-icon">📊</span>
          <span>Statistik</span>
        </div>
      </nav>
    </div>
  );
}

export default App;
