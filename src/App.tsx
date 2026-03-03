import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix für Leaflet Icons
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

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center);
  return null;
}

// Bouncy Ripple Button Component
function RippleButton({ label, className, onClick }: { label: string, className: string, onClick: () => void }) {
  const [ripples, setRipples] = useState<{ x: number, y: number, id: number }[]>([]);
  
  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples([...ripples, { x, y, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick();
  };

  return (
    <button className={`liquid-ripple-btn ${className}`} onClick={createRipple}>
      {label}
      {ripples.map(r => (
        <span key={r.id} className="ripple-effect" style={{ left: r.x, top: r.y }}></span>
      ))}
    </button>
  );
}

function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isTracking, setIsTracking] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pendingTrip, setPendingTrip] = useState<Trip | null>(null); // For Smart Notification
  const watchId = useRef<number | null>(null);
  const lastActivityTime = useRef<number>(Date.now());

  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setTrips(data); })
      .catch(err => console.error("Sync Error:", err));
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trips)
      }).catch(err => console.error("Save Error:", err));
    }
  }, [trips]);

  const startTracking = (type: 'Dienstlich' | 'Privat') => {
    const newTrip: Trip = {
      id: Date.now().toString(),
      startTime: new Date().toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      distance: 0,
      type: type,
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
            distance += calculateDistance(last.latitude, last.longitude, latitude, longitude);

            const isMoving = speed && speed > 0.5;
            if (!isMoving) {
              if (Date.now() - lastActivityTime.current > 120000) {
                const type = distance > 0.1 ? 'Stau' : 'Tanken/Halt';
                if (!stoppages[stoppages.length - 1] || stoppages[stoppages.length - 1].endTime) {
                  stoppages.push({ type, startTime: lastActivityTime.current, latitude, longitude });
                }
              }
            } else {
              lastActivityTime.current = Date.now();
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
      const finalTrip = { ...currentTrip, endTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) };
      setPendingTrip(finalTrip);
      setCurrentTrip(null);
    }
    setIsTracking(false);
  };

  const finalizeTrip = (type: 'Dienstlich' | 'Privat') => {
    if (pendingTrip) {
      const final = { ...pendingTrip, type };
      setTrips([final, ...trips]);
      setPendingTrip(null);
    }
  };

  const polylinePositions = currentTrip?.locations.map(l => [l.latitude, l.longitude] as [number, number]) || [];
  const mapCenter = polylinePositions.length > 0 ? polylinePositions[polylinePositions.length - 1] : [51.1657, 10.4515] as [number, number];
  const routeColor = currentTrip?.type === 'Dienstlich' ? '#32D74B' : '#FF375F';

  return (
    <div className="app-container">
      {pendingTrip && (
        <div className="notification-overlay">
          <div className="smart-notification">
            <h3>􀫊 Fahrt beendet</h3>
            <p>Trip beendet: {pendingTrip.endTime}, {pendingTrip.distance.toFixed(1)} km. Als was soll diese Fahrt gespeichert werden?</p>
            <div className="notify-buttons">
              <RippleButton label="Private" className="btn-private-blue" onClick={() => finalizeTrip('Privat')} />
              <RippleButton label="Business" className="btn-business-green" onClick={() => finalizeTrip('Dienstlich')} />
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div>
          <p style={{fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px'}}>Fleet Manager</p>
          <h2>Fahrtenbuch</h2>
        </div>
        {isTracking && <div className="rec-dot"></div>}
      </header>

      <main style={{flex: 1, overflowY: 'auto', paddingBottom: '100px'}}>
        {activeView === 'dashboard' && (
          <div className="glass-pane">
            <div className="map-wrapper">
              <MapContainer center={mapCenter} zoom={15} zoomControl={false} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polylinePositions.length > 0 && (
                  <Polyline 
                    positions={polylinePositions} 
                    pathOptions={{ color: routeColor, weight: 6, opacity: 0.8, lineJoin: 'round' }} 
                  />
                )}
                <ChangeView center={mapCenter} />
              </MapContainer>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
              <div>
                <p style={{color: 'var(--text-dim)', fontSize: '0.75rem'}}>Distanz</p>
                <h1 style={{fontSize: '2.2rem', fontWeight: '700'}}>{currentTrip?.distance.toFixed(2) || '0.00'}<span style={{fontSize: '1rem', marginLeft: '4px', fontWeight: '400'}}>km</span></h1>
              </div>
              {isTracking && (
                <div style={{textAlign: 'right'}}>
                  <p style={{color: 'var(--text-dim)', fontSize: '0.75rem'}}>Status</p>
                  <p style={{color: routeColor, fontWeight: '600'}}>{currentTrip?.type}</p>
                </div>
              )}
            </div>

            {!isTracking ? (
              <div className="action-buttons">
                <button className="liquid-btn business" onClick={() => startTracking('Dienstlich')}>Business</button>
                <button className="liquid-btn private" onClick={() => startTracking('Privat')}>Private</button>
              </div>
            ) : (
              <button className="liquid-btn" style={{width: '100%', background: 'rgba(255, 69, 58, 0.2)', color: '#FF453A', borderColor: 'rgba(255, 69, 58, 0.3)'}} onClick={stopTracking}>Fahrt beenden</button>
            )}
          </div>
        )}

        {activeView === 'history' && (
          <div style={{padding: '10px'}}>
            <h3 style={{margin: '10px 0 20px 10px', fontSize: '1.4rem'}}>Verlauf</h3>
            {trips.map(t => (
              <div key={t.id} className="trip-card">
                <div>
                  <div style={{display: 'flex', alignItems: 'center'}}>
                    <span className="type-indicator" style={{color: t.type === 'Dienstlich' ? 'var(--neon-green)' : 'var(--neon-magenta)'}}></span>
                    <h4>{t.startTime.split(',')[0]}</h4>
                  </div>
                  <p>{t.startTime.split(',')[1]} - {t.endTime}</p>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div style={{fontSize: '1.1rem', fontWeight: '700'}}>{t.distance.toFixed(2)} km</div>
                  {t.stoppages.length > 0 && <p style={{color: '#FFD60A', fontSize: '0.7rem'}}>⚠️ {t.stoppages.length} Stopps</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'stats' && (
          <div className="glass-pane">
            <h3 style={{marginBottom: '20px'}}>Statistik</h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
              <div className="trip-card" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                <p>Gesamt</p>
                <h2 style={{color: 'var(--accent-blue)'}}>{trips.reduce((acc, t) => acc + t.distance, 0).toFixed(1)} km</h2>
              </div>
              <div className="trip-card" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                <p>Fahrten</p>
                <h2 style={{color: 'var(--neon-green)'}}>{trips.length}</h2>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="tab-bar">
        <div className={`tab-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
          <span className="nav-icon">􀫊</span>
          <span>Drive</span>
        </div>
        <div className={`tab-item ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
          <span className="nav-icon">􀉉</span>
          <span>History</span>
        </div>
        <div className={`tab-item ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>
          <span className="nav-icon">􀙔</span>
          <span>Stats</span>
        </div>
      </nav>
    </div>
  );
}

export default App;
