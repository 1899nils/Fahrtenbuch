'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  History, 
  BarChart3, 
  Settings, 
  ChevronRight, 
  Search, 
  Filter,
  ArrowRight,
  Clock,
  Navigation,
  Calendar,
  MoreVertical,
  X,
  TrendingUp,
  Fuel,
  CreditCard
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox Token
mapboxgl.accessToken = 'REPLACE_WITH_YOUR_MAPBOX_TOKEN';

interface Waypoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
  stop?: boolean;
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
  start_location?: string;
  end_location?: string;
}

const StatCard = ({ title, value, unit, icon: Icon, color }: any) => (
  <div className="liquid-pane p-6 flex items-center gap-5">
    <div className={`p-4 rounded-2xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-400 font-medium">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  </div>
);

const MapView = ({ locations }: { locations?: Waypoint[] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10.4515, 51.1657], // Mitte von Deutschland
      zoom: 5,
      antialias: true
    });

    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    if (!map.current || !locations || locations.length < 2) return;

    const segments: any[] = [];
    for (let i = 0; i < locations.length - 1; i++) {
      segments.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [locations[i].longitude, locations[i].latitude],
            [locations[i+1].longitude, locations[i+1].latitude]
          ]
        },
        properties: { isTraffic: locations[i+1].traffic }
      });
    }

    if (map.current.getSource('route')) {
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: segments
      });
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: segments }
      });

      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['get', 'isTraffic'], '#FF375F', '#0A84FF'],
          'line-width': 6,
          'line-blur': 1
        }
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(l => bounds.extend([l.longitude, l.latitude]));
    map.current.fitBounds(bounds, { padding: 50, duration: 1000 });

  }, [locations]);

  return <div ref={mapContainer} className="w-full h-full" />;
};

export default function DesktopDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTrips(data);
      })
      .catch(err => console.error("Fehler beim Abrufen:", err));
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 gap-8 bg-zinc-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-accent-blue flex items-center justify-center shadow-[0_0_20px_rgba(10,132,255,0.4)]">
            <Navigation className="text-white fill-white" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Fleet<span className="text-accent-blue">Pro</span></h1>
        </div>

        <nav className="flex flex-col gap-2">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-2 mb-2">Hauptmenü</p>
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'trips', icon: History, label: 'Fahrtenbuch' },
            { id: 'map', icon: MapIcon, label: 'Karte' },
            { id: 'stats', icon: BarChart3, label: 'Analyse' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                activeView === item.id 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {activeView === item.id && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-500 hover:bg-white/5 transition-all">
            <Settings size={20} />
            <span className="font-medium">Einstellungen</span>
          </button>
          <div className="p-4 mt-4 bg-white/5 rounded-3xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent-blue to-purple-500" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">Nils Kurzweil</p>
              <p className="text-xs text-gray-500 truncate italic">Flotten-Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-black/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl w-96 border border-white/5">
            <Search size={18} className="text-gray-500" />
            <input 
              type="text" 
              placeholder="Suche nach Fahrten, Orten, Zweck..." 
              className="bg-transparent border-none outline-none text-sm w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6">
             <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all"><Filter size={20} /></button>
             <div className="h-8 w-[1px] bg-white/10" />
             <div className="flex flex-col items-end">
               <p className="text-xs text-gray-500 font-bold uppercase">Systemstatus</p>
               <p className="text-sm font-bold text-neon-green flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                 Betriebsbereit
               </p>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto flex flex-col gap-10">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Gesamtstrecke" value="1.284" unit="km" icon={TrendingUp} color="bg-blue-600" />
              <StatCard title="Monatliche Kosten" value="412,50" unit="€" icon={CreditCard} color="bg-purple-600" />
              <StatCard title="Kraftstoffverbrauch" value="6,4" unit="L/100km" icon={Fuel} color="bg-emerald-600" />
              <StatCard title="Offene Fahrten" value="3" unit="Klassifizierung fehlt" icon={History} color="bg-rose-600" />
            </div>

            {/* Dashboard Sections */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              
              {/* Trip Table Section */}
              <div className="xl:col-span-8 flex flex-col gap-6">
                <div className="flex justify-between items-end">
                   <div>
                     <h2 className="text-2xl font-bold tracking-tight">Letzte Fahrten</h2>
                     <p className="text-gray-500 text-sm mt-1">Überprüfen und verwalten Sie Ihre zuletzt aufgezeichneten Fahrten.</p>
                   </div>
                   <button className="text-accent-blue text-sm font-bold flex items-center gap-1 hover:underline">Gesamte Historie <ChevronRight size={16} /></button>
                </div>

                <div className="liquid-pane overflow-hidden p-0 border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Datum & Uhrzeit</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Route</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Strecke</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Typ</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trips.length > 0 ? trips.slice(0, 8).map((trip) => (
                        <tr 
                          key={trip.id} 
                          onClick={() => setSelectedTrip(trip)}
                          className={`group cursor-pointer transition-colors hover:bg-white/5 ${selectedTrip?.id === trip.id ? 'bg-accent-blue/10' : ''}`}
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{formatDate(trip.start_time)}</span>
                              <span className="text-xs text-gray-500">{formatTime(trip.start_time)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">Frankfurt am Main</span>
                                <span className="text-[10px] text-gray-500">Bad Vilbel</span>
                              </div>
                              <ArrowRight size={14} className="text-gray-600" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">München</span>
                                <span className="text-[10px] text-gray-500">Zentrum</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-mono font-bold text-sm">{trip.distance} km</span>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                              trip.type === 'business' ? 'bg-emerald-500/10 text-emerald-400' :
                              trip.type === 'private' ? 'bg-blue-500/10 text-blue-400' :
                              'bg-rose-500/10 text-rose-400'
                            }`}>
                              {trip.type === 'business' ? 'Geschäftlich' : trip.type === 'private' ? 'Privat' : 'Unklassifiziert'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all"><MoreVertical size={16} /></button>
                              <ChevronRight className="text-gray-700 group-hover:text-accent-blue transition-colors" size={20} />
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic">Noch keine Fahrten aufgezeichnet. Zeit für eine Spritztour!</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar Detail Section */}
              <div className="xl:col-span-4 sticky top-10 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                   <h3 className="text-xl font-bold tracking-tight">Detailansicht</h3>
                   {selectedTrip && <button onClick={() => setSelectedTrip(null)} className="text-gray-500 hover:text-white transition-all"><X size={20} /></button>}
                </div>

                <AnimatePresence mode="wait">
                  {selectedTrip ? (
                    <motion.div 
                      key={selectedTrip.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="liquid-pane p-0 overflow-hidden flex flex-col border-white/5 bg-zinc-900/40"
                    >
                      <div className="h-64 relative">
                         <MapView locations={selectedTrip.locations} />
                         <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
                            <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase border border-white/10">ID: {selectedTrip.id.slice(0, 8)}</span>
                            <span className="bg-accent-blue px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase shadow-[0_0_15px_rgba(10,132,255,0.4)]">Aktiv</span>
                         </div>
                      </div>

                      <div className="p-8 flex flex-col gap-8">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Zusammenfassung</p>
                            <h4 className="text-2xl font-bold">{selectedTrip.distance} km <span className="text-gray-500 text-sm font-normal">Gesamt</span></h4>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Kategorie</p>
                             <button className="text-xs font-bold text-accent-blue hover:underline uppercase">
                               {selectedTrip.type === 'business' ? 'Geschäftlich' : selectedTrip.type === 'private' ? 'Privat' : 'Unklassifiziert'}
                             </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[10px] text-gray-500 font-bold uppercase mb-2 flex items-center gap-1"><Clock size={10} /> Dauer</p>
                              <p className="text-lg font-bold">4h 12m</p>
                           </div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[10px] text-gray-500 font-bold uppercase mb-2 flex items-center gap-1"><Calendar size={10} /> Datum</p>
                              <p className="text-lg font-bold">{formatDate(selectedTrip.start_time)}</p>
                           </div>
                        </div>

                        <div className="flex flex-col gap-4">
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Zweck</p>
                           <textarea 
                             placeholder="Zweck für diese Fahrt hinzufügen..."
                             className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm outline-none focus:border-accent-blue/50 transition-all min-h-[100px] resize-none"
                             defaultValue={selectedTrip.purpose}
                           />
                        </div>

                        <button className="w-full bg-accent-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_10px_30px_rgba(10,132,255,0.2)]">
                          Klassifizierung speichern
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="liquid-pane p-12 border-dashed border-2 border-white/10 bg-transparent flex flex-col items-center justify-center text-center gap-4 min-h-[500px]"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-gray-600">
                        <MapIcon size={32} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Keine Fahrt ausgewählt</h4>
                        <p className="text-sm text-gray-500 mt-2 max-w-[200px]">Klicken Sie auf eine Fahrt aus der Liste, um Details und die Route auf der Karte anzuzeigen.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
