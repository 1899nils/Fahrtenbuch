'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, 
  Map as MapIcon, 
  Clock, 
  ChevronRight, 
  Search, 
  Sun, 
  Moon, 
  Save, 
  ArrowRight,
  Info,
  X,
  ChevronUp,
  ChevronDown
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
}

const MapView = ({ locations }: { locations?: Waypoint[] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10.45, 51.16], 
      zoom: 5,
      antialias: true
    });
    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    if (!map.current || !locations || locations.length < 2) return;

    const features = [];
    for (let i = 0; i < locations.length - 1; i++) {
      features.push({
        type: 'Feature',
        properties: { isTraffic: locations[i + 1].traffic || false },
        geometry: {
          type: 'LineString',
          coordinates: [
            [locations[i].longitude, locations[i].latitude],
            [locations[i + 1].longitude, locations[i + 1].latitude]
          ]
        }
      });
    }

    const geojsonData = { type: 'FeatureCollection', features };
    
    if (map.current.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojsonData as any);
    } else {
      map.current.addSource('route', { type: 'geojson', data: geojsonData as any });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 
          'line-color': ['case', ['get', 'isTraffic'], '#FF375F', '#0A84FF'],
          'line-width': 6,
          'line-blur': 0.5
        }
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(l => bounds.extend([l.longitude, l.latitude]));
    map.current.fitBounds(bounds, { padding: 80, duration: 1500 });
  }, [locations]);

  return <div ref={mapContainer} className="w-full h-full lg:rounded-3xl overflow-hidden" />;
};

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [newTrip, setNewTrip] = useState({
    start_address: '', end_address: '', date: '', time: '', mileage: '', type: 'business'
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('/api/trips').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setTrips(data);
    }).catch(console.error);
  }, []);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('de-DE');
  const formatTime = (date: string) => new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative flex flex-col lg:flex-row h-screen w-full overflow-hidden lg:p-4 gap-4 bg-black">
      
      {/* Sidebar: Desktop (lg:) / Mobile Bottom Sheet */}
      <aside className={`
        ${isSheetExpanded ? 'h-[85vh]' : 'h-24'} 
        lg:h-full lg:w-[400px] 
        mobile-bottom-sheet lg:static lg:bg-transparent lg:border-none lg:backdrop-filter-none lg:flex lg:flex-col lg:gap-4
      `}>
        {/* Mobile Handle */}
        <div className="lg:hidden flex justify-center py-2" onClick={() => setIsSheetExpanded(!isSheetExpanded)}>
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sidebar Header */}
        <div className="liquid-glass p-4 lg:p-6 flex justify-between items-center h-16 lg:h-20 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-accent-blue flex items-center justify-center">
               <Navigation className="text-white" size={18} />
             </div>
             <h1 className="text-lg lg:text-xl font-bold">FleetPro</h1>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 lg:p-2.5 rounded-xl glass-card">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => { setIsModalOpen(true); setIsSheetExpanded(false); }}
          className="mx-4 lg:mx-0 h-14 lg:h-16 liquid-glass flex items-center justify-center gap-3 font-bold text-accent-blue hover:text-white hover:bg-accent-blue/20 transition-all border-dashed border-2 border-accent-blue/30 shrink-0"
        >
          <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-lg">+</div>
          <span className="text-sm lg:text-base">Neue Fahrt</span>
        </button>

        {/* Trip List */}
        <div className={`
          flex-1 overflow-hidden flex flex-col p-2 
          ${isSheetExpanded ? 'opacity-100' : 'opacity-0 lg:opacity-100'} 
          transition-opacity duration-300
        `}>
          <div className="p-2 lg:p-4 mb-2">
            <div className="glass-card flex items-center gap-3 px-4 py-2 rounded-2xl">
              <Search size={16} className="text-gray-500" />
              <input type="text" placeholder="Fahrt suchen..." className="bg-transparent border-none outline-none text-sm w-full" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 flex flex-col gap-3">
            {trips.map(trip => (
              <motion.div 
                key={trip.id}
                onClick={() => { setSelectedTrip(trip); setIsSheetExpanded(false); }}
                className={`glass-card p-4 lg:p-5 rounded-3xl cursor-pointer group relative overflow-hidden ${selectedTrip?.id === trip.id ? 'ring-2 ring-accent-blue/50 bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-start mb-3 lg:mb-4">
                  <div>
                    <span className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-widest">{formatDate(trip.start_time)}</span>
                    <h3 className="text-base lg:text-lg font-bold mt-0.5">{trip.distance} <span className="text-xs lg:text-sm font-normal text-gray-400">km</span></h3>
                  </div>
                  <div className={`glow-dot mt-1.5 ${trip.type === 'business' ? 'text-neon-green bg-neon-green' : trip.type === 'private' ? 'text-accent-blue bg-accent-blue' : 'text-gray-500 bg-gray-500'}`} />
                </div>
                <div className="flex items-center justify-between text-[10px] lg:text-xs text-gray-400">
                  <div className="flex items-center gap-1.5"><Clock size={10} /> {formatTime(trip.start_time)}</div>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Area: Map Background on Mobile */}
      <main className="flex-1 relative flex flex-col h-full lg:gap-4">
        
        {/* Map: Full Screen on Mobile */}
        <div className="absolute inset-0 lg:relative lg:flex-1 lg:liquid-glass lg:p-0">
           <MapView locations={selectedTrip?.locations} />
        </div>

        {/* Floating Overlays for Selected Trip (Mobile) */}
        {selectedTrip && (
          <div className="relative z-10 flex flex-col h-full p-4 lg:p-0 pointer-events-none">
            
            {/* Header Overlay */}
            <header className="liquid-glass p-4 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pointer-events-auto">
              <div className="flex items-center gap-6 lg:gap-12 w-full lg:w-auto">
                <div className="flex flex-col gap-0.5 lg:gap-1">
                  <span className="text-[8px] lg:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start</span>
                  <p className="text-sm lg:text-lg font-bold truncate max-w-[120px] lg:max-w-none">Frankfurt Main</p>
                </div>
                <ArrowRight className="text-gray-600 shrink-0" size={18} />
                <div className="flex flex-col gap-0.5 lg:gap-1">
                  <span className="text-[8px] lg:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ziel</span>
                  <p className="text-sm lg:text-lg font-bold truncate max-w-[120px] lg:max-w-none">München</p>
                </div>
              </div>

              <div className="flex w-full lg:w-auto items-center gap-2 bg-white/5 p-1 lg:p-2 rounded-2xl lg:rounded-3xl border border-white/5">
                {['business', 'private'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedTrip({...selectedTrip, type: type as any})}
                    className={`flex-1 lg:flex-none lg:px-8 py-2 lg:py-3 rounded-xl lg:rounded-2xl font-bold text-[10px] lg:text-sm transition-all ${selectedTrip.type === type ? 'bg-accent-blue text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                  >
                    {type === 'business' ? 'Dienstlich' : 'Privat'}
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1" />

            {/* Footer Overlay */}
            <footer className="liquid-glass p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-end pointer-events-auto">
              <div className="hidden lg:flex col-span-8 flex-col gap-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Notizen</label>
                <textarea className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-accent-blue/50 h-24 resize-none" defaultValue={selectedTrip.purpose} />
              </div>
              <div className="col-span-1 lg:col-span-4 flex flex-col gap-3 lg:gap-4">
                 <div className="flex justify-between text-xs lg:text-sm font-bold border-b border-white/5 pb-2 lg:pb-4">
                   <span className="text-gray-500">Distanz</span>
                   <span>{selectedTrip.distance} km</span>
                 </div>
                 <button className="w-full bg-accent-blue text-white font-bold py-3 lg:py-4 rounded-xl lg:rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent-blue/20">
                   <Save size={16} />
                   Speichern
                 </button>
              </div>
            </footer>
          </div>
        )}

        {/* Empty State Overlay (Mobile) */}
        {!selectedTrip && (
          <div className="lg:hidden absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
             <div className="liquid-glass p-6 text-center pointer-events-auto max-w-[280px]">
                <Info size={32} className="text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-400">Wische unten hoch, um eine Fahrt auszuwählen.</p>
             </div>
          </div>
        )}

        {/* Empty State (Desktop) */}
        {!selectedTrip && (
          <div className="hidden lg:flex liquid-glass flex-1 flex flex-col items-center justify-center text-center p-20 opacity-80">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10">
              <Info size={40} className="text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Keine Fahrt ausgewählt</h2>
            <p className="text-gray-500 max-w-md">Wählen Sie eine Fahrt aus der Liste links aus.</p>
          </div>
        )}
      </main>

      {/* Manual Entry Modal (Responsive) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="liquid-glass w-full max-w-xl relative flex flex-col p-6 lg:p-8 gap-6 border-white/20">
              <div className="flex justify-between items-center">
                <h2 className="text-xl lg:text-2xl font-bold">Neue Fahrt</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <input placeholder="Startadresse" className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none text-sm" />
                <input placeholder="Zieladresse" className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none text-sm" />
              </div>
              <div className="flex gap-2">
                <input type="date" className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none text-sm flex-1 [color-scheme:dark]" />
                <input type="time" className="glass-card bg-white/5 px-4 py-3 rounded-2xl outline-none text-sm w-24 [color-scheme:dark]" />
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-full bg-accent-blue text-white font-bold py-4 rounded-2xl shadow-lg">Fahrt speichern</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
