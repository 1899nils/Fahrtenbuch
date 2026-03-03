import { useState, useEffect, useRef } from 'react';
import './App.css';

interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface Trip {
  id: string;
  startTime: string;
  endTime?: string;
  distance: number; // in km
  type: 'Dienstlich' | 'Privat';
  locations: Location[];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('trips');
    return saved ? JSON.parse(saved) : [];
  });
  const watchId = useRef<number | null>(null);

  // Initiales Laden vom Backend
  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTrips(data);
        }
      })
      .catch(err => console.error("Fehler beim Laden vom Server:", err));
  }, []);

  // Speichern im LocalStorage UND im Backend bei Änderungen
  useEffect(() => {
    localStorage.setItem('trips', JSON.stringify(trips));
    
    // Verzögertes Speichern im Backend (Debouncing wäre besser, aber hier reicht ein einfacher POST)
    fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trips)
    }).catch(err => console.error("Fehler beim Speichern auf dem Server:", err));
  }, [trips]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation wird von deinem Browser nicht unterstützt.");
      return;
    }

    const newTrip: Trip = {
      id: Date.now().toString(),
      startTime: new Date().toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
      distance: 0,
      type: 'Privat',
      locations: []
    };

    setCurrentTrip(newTrip);
    setIsTracking(true);

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { latitude, longitude, timestamp: position.timestamp };

        setCurrentTrip(prev => {
          if (!prev) return null;
          const updatedLocations = [...prev.locations, newLocation];
          let newDistance = prev.distance;

          if (prev.locations.length > 0) {
            const lastLoc = prev.locations[prev.locations.length - 1];
            newDistance += calculateDistance(
              lastLoc.latitude, lastLoc.longitude,
              latitude, longitude
            );
          }

          return { ...prev, locations: updatedLocations, distance: newDistance };
        });
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    if (currentTrip) {
      const finalTrip = { ...currentTrip, endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setTrips([finalTrip, ...trips]);
      setCurrentTrip(null);
    }
    setIsTracking(false);
  };

  const updateTripType = (id: string, type: 'Dienstlich' | 'Privat') => {
    setTrips(trips.map(t => t.id === id ? { ...t, type } : t));
  };

  const deleteTrip = (id: string) => {
    setTrips(trips.filter(t => t.id !== id));
  };

  const exportCSV = () => {
    const header = "Start;Ende;Distanz (km);Typ\n";
    const csvContent = trips.map(t => 
      `${t.startTime};${t.endTime || ''};${t.distance.toFixed(2).replace('.', ',')};${t.type}`
    ).join('\n');
    
    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `fahrtenbuch_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container">
      <h1>Fahrtenbuch</h1>
      
      <div className="glass-card">
        <div className="controls">
          {!isTracking ? (
            <button className="start-btn" onClick={startTracking}>Fahrt starten</button>
          ) : (
            <button className="stop-btn" onClick={stopTracking}>Fahrt beenden</button>
          )}
        </div>

        {isTracking && currentTrip && (
          <div className="current-stats">
            <p>Aktuelle Distanz</p>
            <strong>{currentTrip.distance.toFixed(2)} km</strong>
          </div>
        )}
      </div>

      <div className="export-area">
        <button onClick={exportCSV} disabled={trips.length === 0}>Exportieren als CSV</button>
      </div>

      <div className="trip-list">
        <h2>Verlauf</h2>
        {trips.length === 0 ? <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Noch keine Fahrten aufgezeichnet.</p> : (
          <ul>
            {trips.map(trip => (
              <li key={trip.id} className="trip-item">
                <div className="trip-header">
                  <div className="trip-info">
                    <span>{trip.startTime}</span>
                    <span>Ende: {trip.endTime}</span>
                  </div>
                  <div className="distance-badge">
                    {trip.distance.toFixed(2)} km
                  </div>
                </div>
                <div className="trip-actions">
                  <select 
                    value={trip.type} 
                    onChange={(e) => updateTripType(trip.id, e.target.value as any)}
                  >
                    <option value="Privat">Privat</option>
                    <option value="Dienstlich">Dienstlich</option>
                  </select>
                  <button className="delete-btn" onClick={() => deleteTrip(trip.id)}>Löschen</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
