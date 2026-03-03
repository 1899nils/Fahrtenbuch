'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { FixedSizeList as List } from 'react-window';
import { motion } from 'framer-motion';
import { Calendar, Map as MapIcon, BarChart3, Clock, Navigation2, AlertTriangle } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox Token (Replace with real one)
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
}

const TripCard = ({ trip, isActive, onClick }: { trip: Trip, isActive: boolean, onClick: () => void }) => {
  const statusColor = trip.type === 'unclassified' ? 'text-neon-magenta' : 
                      trip.type === 'business' ? 'text-neon-green' : 'text-accent-blue';
  
  const cardClass = trip.type === 'unclassified' ? 'trip-unclassified' : 
                    trip.type === 'business' ? 'trip-business' : 'trip-classified';

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className={`liquid-pane bouncy-hover p-4 m-2 mb-4 cursor-pointer relative ${cardClass} ${isActive ? 'ring-2 ring-accent-blue/50' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-lg mb-1">{new Date(trip.start_time).toLocaleDateString('de-DE')}</h4>
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Clock size={12} /> {new Date(trip.start_time).toLocaleTimeString('de-DE')}
          </p>
        </div>
        <div className={`text-xl font-black ${statusColor}`}>
          {trip.distance} <span className="text-xs font-normal text-white">km</span>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        {trip.type === 'unclassified' ? (
           <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-widest font-bold">
             <AlertTriangle size={10} /> Needs Class
           </span>
        ) : (
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full uppercase tracking-widest font-bold">
            {trip.type}
          </span>
        )}
      </div>
    </motion.div>
  );
};

const MapView = ({ locations }: { locations?: Waypoint[] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !locations || locations.length < 2) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [locations[0].longitude, locations[0].latitude],
      zoom: 14,
      antialias: true
    });

    map.current.on('load', () => {
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
          properties: {
            isTraffic: locations[i+1].traffic
          }
        });
      }

      map.current?.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: segments }
      });

      map.current?.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['get', 'isTraffic'], '#FF375F', '#0A84FF'],
          'line-width': 6,
          'line-blur': 2
        }
      });

      locations.filter(l => l.stop).forEach(stop => {
        new mapboxgl.Marker({ color: '#FFD60A' })
          .setLngLat([stop.longitude, stop.latitude])
          .addTo(map.current!);
      });

      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(l => bounds.extend([l.longitude, l.latitude]));
      map.current?.fitBounds(bounds, { padding: 50 });
    });

    return () => map.current?.remove();
  }, [locations]);

  return <div ref={mapContainer} className="w-full h-full min-h-[400px]" />;
};

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState('drive');

  useEffect(() => {
    // URL anpassen für Monorepo (backend:3000 intern, via Proxy extern)
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTrips(data);
          if (data.length > 0) setSelectedTrip(data[0]);
        }
      })
      .catch(err => console.error("Fetch error:", err));
  }, []);

  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => (
    <div style={style}>
      <TripCard 
        trip={trips[index]} 
        isActive={selectedTrip?.id === trips[index].id}
        onClick={() => setSelectedTrip(trips[index])}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-[1400px] mx-auto overflow-hidden relative">
      <nav className="fixed left-6 top-1/2 -translate-y-1/2 flex-col gap-8 hidden lg:flex z-50">
        <div className="liquid-pane p-4 flex flex-col gap-6 items-center">
          <button onClick={() => setActiveTab('drive')} className={`transition-all ${activeTab === 'drive' ? 'text-accent-blue drop-shadow-[0_0_10px_#0A84FF]' : 'text-gray-500'}`}><MapIcon size={24} /></button>
          <button onClick={() => setActiveTab('history')} className={`transition-all ${activeTab === 'history' ? 'text-accent-blue drop-shadow-[0_0_10px_#0A84FF]' : 'text-gray-500'}`}><Calendar size={24} /></button>
          <button onClick={() => setActiveTab('stats')} className={`transition-all ${activeTab === 'stats' ? 'text-accent-blue drop-shadow-[0_0_10px_#0A84FF]' : 'text-gray-500'}`}><BarChart3 size={24} /></button>
        </div>
      </nav>

      <header className="px-6 py-8 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[4px] text-gray-500 font-black mb-1">Fleet Command v2</p>
          <h1 className="text-4xl font-black italic tracking-tighter">FLEET<span className="text-accent-blue">PRO</span></h1>
        </div>
        <div className="liquid-pane px-4 py-2 flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Active Vehicle</p>
            <p className="font-black">B-MW 2024</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent-blue to-neon-magenta animate-pulse" />
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        <div className="lg:col-span-4 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Timeline</h3>
            <span className="text-[10px] text-accent-blue font-bold">{trips.length} Recorded Trips</span>
          </div>
          <div className="flex-1 min-h-0">
            <List
              height={600}
              itemCount={trips.length}
              itemSize={160}
              width={'100%'}
              className="custom-scrollbar"
            >
              {Row}
            </List>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="liquid-pane flex-1 relative overflow-hidden">
            <MapView locations={selectedTrip?.locations} />
            <div className="absolute bottom-6 left-6 right-6 flex gap-4 pointer-events-none">
              <div className="liquid-pane p-4 flex-1 backdrop-blur-3xl bg-black/40 border-white/5">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Current Focus</p>
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-black">{selectedTrip?.distance} <span className="text-sm font-normal text-gray-500">km</span></h2>
                    <p className="text-xs text-accent-blue flex items-center gap-1 font-bold mt-1 uppercase"><Navigation2 size={10} fill="currentColor" /> {selectedTrip?.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-300 italic">"{selectedTrip?.purpose || 'Client Meeting'}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 h-32">
            <div className="liquid-pane p-4 flex flex-col justify-center items-center">
              <p className="text-[10px] text-gray-500 font-black uppercase">Efficiency</p>
              <h2 className="text-2xl font-black text-neon-green">94%</h2>
            </div>
            <div className="liquid-pane p-4 flex flex-col justify-center items-center">
              <p className="text-[10px] text-gray-500 font-black uppercase">Fuel Saver</p>
              <h2 className="text-2xl font-black text-accent-blue">12.4 L</h2>
            </div>
            <div className="liquid-pane p-4 flex flex-col justify-center items-center">
              <p className="text-[10px] text-gray-500 font-black uppercase">Tax Saved</p>
              <h2 className="text-2xl font-black text-neon-magenta">412 €</h2>
            </div>
          </div>
        </div>
      </main>

      <nav className="lg:hidden liquid-pane mx-6 mb-6 h-16 flex justify-around items-center backdrop-blur-3xl bg-black/40">
        <button onClick={() => setActiveTab('drive')} className={activeTab === 'drive' ? 'text-accent-blue' : 'text-gray-500'}><MapIcon /></button>
        <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'text-accent-blue' : 'text-gray-500'}><Calendar /></button>
        <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? 'text-accent-blue' : 'text-gray-500'}><BarChart3 /></button>
      </nav>
    </div>
  );
}
