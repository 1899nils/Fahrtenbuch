'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, 
  Map as MapIcon, 
  Clock, 
  Calendar, 
  ChevronRight, 
  Search, 
  Sun, 
  Moon, 
  Save, 
  ArrowRight,
  Info
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox Token
mapboxgl.accessToken = 'REPLACE_WITH_YOUR_MAPBOX_TOKEN';

interface Waypoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
  traffic?: boolean;
}

interface Trip {
  id: string;
  start_time: string;
  end_time: string;
  distance: number;
  type: 'business' | 'private' | 'unclassified';
  purpose?: string;
  locations?: Waypoint[];
  start_address?: string;
  end_address?: string;
}

const MapView = ({ locations }: { locations?: Waypoint[] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10.45, 51.16], // Deutschland
      zoom: 5,
      antialias: true
    });
    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    if (!map.current || !locations || locations.length < 2) return;

    const segments = locations.map(l => [l.longitude, l.latitude]);
    
    if (map.current.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segments }
      } as any);
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: segments } }
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0A84FF', 'line-width': 5 }
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(l => bounds.extend([l.longitude, l.latitude]));
    map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
  }, [locations]);

  return <div ref={mapContainer} className="w-full h-full min-h-[400px]" />;
};

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({
    start_address: '',
    end_address: '',
    date: '',
    time: '',
    mileage: '',
    type: 'business'
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTrips(data);
      })
      .catch(console.error);
  }, []);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('de-DE');
  const formatTime = (date: string) => new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-screen w-full overflow-hidden p-4 gap-4">
      
      {/* Sidebar: 400px */}
      <aside className="w-[400px] flex flex-col gap-4">
        <div className="liquid-glass p-6 flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-accent-blue flex items-center justify-center">
               <Navigation className="text-white" size={20} />
             </div>
             <h1 className="text-xl font-bold">FleetPro</h1>
          </div>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl glass-card"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full h-16 liquid-glass flex items-center justify-center gap-3 font-bold text-accent-blue hover:text-white hover:bg-accent-blue/20 transition-all border-dashed border-2 border-accent-blue/30"
        >
          <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-xl">+</div>
          Neue Fahrt eintragen
        </button>

        <div className="liquid-glass flex-1 overflow-hidden flex flex-col p-2">
          <div className="p-4 mb-2">
            <div className="glass-card flex items-center gap-3 px-4 py-2 rounded-2xl">
              <Search size={18} className="text-gray-500" />
              <input type="text" placeholder="Fahrt suchen..." className="bg-transparent border-none outline-none text-sm w-full" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 flex flex-col gap-3">
            {trips.map(trip => (
              <motion.div 
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className={`glass-card p-5 rounded-3xl cursor-pointer group relative overflow-hidden ${selectedTrip?.id === trip.id ? 'ring-2 ring-accent-blue/50 bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{formatDate(trip.start_time)}</span>
                    <h3 className="text-lg font-bold mt-1">{trip.distance} <span className="text-sm font-normal text-gray-400">km</span></h3>
                  </div>
                  <div className={`glow-dot mt-2 ${trip.type === 'business' ? 'text-neon-green bg-neon-green' : trip.type === 'private' ? 'text-accent-blue bg-accent-blue' : 'text-gray-500 bg-gray-500'}`} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1.5"><Clock size={12} /> {formatTime(trip.start_time)}</div>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Area: Rechts */}
      <main className="flex-1 flex flex-col gap-4">
        {selectedTrip ? (
          <div className="flex flex-col h-full gap-4">
            
            {/* Header */}
            <header className="liquid-glass p-8 flex items-center justify-between">
              <div className="flex items-center gap-12">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start</span>
                  <p className="text-lg font-bold">Frankfurt am Main</p>
                  <span className="text-xs text-gray-400">{formatTime(selectedTrip.start_time)} Uhr</span>
                </div>
                <ArrowRight className="text-gray-600" size={24} />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ziel</span>
                  <p className="text-lg font-bold">München Zentrum</p>
                  <span className="text-xs text-gray-400">{formatTime(selectedTrip.end_time)} Uhr</span>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/5 p-2 rounded-3xl border border-white/5">
                {['business', 'private'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedTrip({...selectedTrip, type: type as any})}
                    className={`px-8 py-3 rounded-2xl font-bold text-sm transition-all ${selectedTrip.type === type ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30' : 'text-gray-500 hover:text-white'}`}
                  >
                    {type === 'business' ? 'Dienstlich' : 'Privat'}
                  </button>
                ))}
              </div>
            </header>

            {/* Map Area */}
            <div className="liquid-glass flex-1 relative overflow-hidden p-0">
               <MapView locations={selectedTrip.locations} />
               <div className="absolute top-6 left-6 flex gap-3">
                 <div className="glass-card px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <MapIcon size={14} className="text-accent-blue" />
                    Live Route
                 </div>
               </div>
            </div>

            {/* Footer / Details */}
            <footer className="liquid-glass p-8 grid grid-cols-12 gap-8 items-end">
              <div className="col-span-8 flex flex-col gap-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Notizen & Fahrtzweck</label>
                <textarea 
                  placeholder="Beschreiben Sie den Grund Ihrer Reise..."
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-accent-blue/50 transition-all min-h-[100px] resize-none"
                  defaultValue={selectedTrip.purpose}
                />
              </div>
              <div className="col-span-4 flex flex-col gap-4">
                 <div className="flex justify-between text-sm font-bold border-b border-white/5 pb-4 mb-2">
                   <span className="text-gray-500">Distanz</span>
                   <span>{selectedTrip.distance} km</span>
                 </div>
                 <button className="w-full bg-accent-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent-blue/20">
                   <Save size={18} />
                   Fahrt speichern
                 </button>
              </div>
            </footer>

          </div>
        ) : (
          <div className="liquid-glass flex-1 flex flex-col items-center justify-center text-center p-20 opacity-80">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10">
              <Info size={40} className="text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Keine Fahrt ausgewählt</h2>
            <p className="text-gray-500 max-w-md leading-relaxed">
              Wählen Sie eine Fahrt aus der Liste auf der linken Seite aus, um Details, die Route und Notizen zu bearbeiten.
            </p>
          </div>
        )}
      </main>

      {/* Modal: Neue Fahrt */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="liquid-glass w-full max-w-xl relative overflow-hidden flex flex-col p-0 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/20"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-2xl font-bold">Neue Fahrt erfassen</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Startadresse</label>
                    <input 
                      type="text" 
                      placeholder="Ort, Straße..." 
                      className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none focus:border-accent-blue/50"
                      value={newTrip.start_address}
                      onChange={e => setNewTrip({...newTrip, start_address: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Zieladresse</label>
                    <input 
                      type="text" 
                      placeholder="Ort, Straße..." 
                      className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none focus:border-accent-blue/50"
                      value={newTrip.end_address}
                      onChange={e => setNewTrip({...newTrip, end_address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Datum & Uhrzeit</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none focus:border-accent-blue/50 flex-1 text-sm [color-scheme:dark]"
                        value={newTrip.date}
                        onChange={e => setNewTrip({...newTrip, date: e.target.value})}
                      />
                      <input 
                        type="time" 
                        className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none focus:border-accent-blue/50 w-24 text-sm [color-scheme:dark]"
                        value={newTrip.time}
                        onChange={e => setNewTrip({...newTrip, time: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Kilometerstand (km)</label>
                    <input 
                      type="number" 
                      placeholder="z.B. 12450" 
                      className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none focus:border-accent-blue/50"
                      value={newTrip.mileage}
                      onChange={e => setNewTrip({...newTrip, mileage: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Fahrttyp</label>
                  <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5">
                    {['business', 'private'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewTrip({...newTrip, type: type as any})}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${newTrip.type === type ? 'bg-accent-blue text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                      >
                        {type === 'business' ? 'Dienstlich' : 'Privat'}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-accent-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl mt-4 transition-all shadow-xl shadow-accent-blue/20 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Fahrt hinzufügen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
