'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { GoogleMap, useJsApiLoader, Polyline } from '@react-google-maps/api';
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

interface Config {
  google_maps_api_key: string;
  mapbox_access_token: string;
}

const MapView = ({ locations, config }: { locations?: Waypoint[], config: Config | null }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapboxMap = useRef<mapboxgl.Map | null>(null);

  const { isLoaded: isGoogleLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: config?.google_maps_api_key || ''
  });

  // Mapbox Effect
  useEffect(() => {
    if (!mapContainer.current || !config?.mapbox_access_token || config.google_maps_api_key) return;
    
    mapboxgl.accessToken = config.mapbox_access_token;
    mapboxMap.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10.45, 51.16], 
      zoom: 5,
    });
    return () => mapboxMap.current?.remove();
  }, [config]);

  // Mapbox Route Update
  useEffect(() => {
    if (!mapboxMap.current || !locations || locations.length < 2) return;

    const features = locations.slice(0, -1).map((loc, i) => ({
      type: 'Feature',
      properties: { isTraffic: locations[i + 1].traffic || false },
      geometry: {
        type: 'LineString',
        coordinates: [
          [loc.longitude, loc.latitude],
          [locations[i + 1].longitude, locations[i + 1].latitude]
        ]
      }
    }));

    const geojsonData = { type: 'FeatureCollection', features };
    
    if (mapboxMap.current.getSource('route')) {
      (mapboxMap.current.getSource('route') as mapboxgl.GeoJSONSource).setData(geojsonData as any);
    } else {
      mapboxMap.current.addSource('route', { type: 'geojson', data: geojsonData as any });
      mapboxMap.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 
          'line-color': ['case', ['get', 'isTraffic'], '#FF375F', '#0A84FF'],
          'line-width': 6
        }
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(l => bounds.extend([l.longitude, l.latitude]));
    mapboxMap.current.fitBounds(bounds, { padding: 80 });
  }, [locations]);

  // Google Maps View
  if (config?.google_maps_api_key && isGoogleLoaded) {
    const center = locations && locations.length > 0 
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : { lat: 51.16, lng: 10.45 };

    return (
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={10}
        options={{
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          ]
        }}
      >
        {locations && locations.length >= 2 && (
          <Polyline
            path={locations.map(l => ({ lat: l.latitude, lng: l.longitude }))}
            options={{
              strokeColor: "#0A84FF",
              strokeOpacity: 1.0,
              strokeWeight: 6,
            }}
          />
        )}
      </GoogleMap>
    );
  }

  return <div ref={mapContainer} className="w-full h-full lg:rounded-3xl overflow-hidden bg-gray-900" />;
};

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [config, setConfig] = useState<Config | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(setConfig);
    fetch('/api/trips').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setTrips(data);
    });
  }, []);

  return (
    <div className="relative flex flex-col lg:flex-row h-screen w-full overflow-hidden lg:p-4 gap-4 bg-black text-white">
      {/* Sidebar */}
      <aside className={`${isSheetExpanded ? 'h-[85vh]' : 'h-24'} lg:h-full lg:w-[400px] flex flex-col gap-4 z-20 transition-all`}>
        <div className="liquid-glass p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
               <Navigation className="text-white" size={20} />
             </div>
             <h1 className="text-xl font-bold">Fahrtenbuch</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-3">
            {trips.map(trip => (
              <div 
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className={`glass-card p-5 rounded-3xl cursor-pointer ${selectedTrip?.id === trip.id ? 'ring-2 ring-blue-500 bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">{new Date(trip.start_time).toLocaleDateString()}</span>
                    <h3 className="text-lg font-bold mt-1">{trip.distance} km</h3>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${trip.type === 'business' ? 'bg-green-500' : 'bg-blue-500'}`} />
                </div>
              </div>
            ))}
        </div>
      </aside>

      {/* Main Map Area */}
      <main className="flex-1 relative rounded-3xl overflow-hidden">
        <MapView locations={selectedTrip?.locations} config={config} />
        
        {selectedTrip && (
          <div className="absolute bottom-8 left-8 right-8 liquid-glass p-6 z-10">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">Ausgewählte Fahrt</p>
                <h2 className="text-2xl font-bold">{selectedTrip.distance} km - {selectedTrip.type === 'business' ? 'Dienstlich' : 'Privat'}</h2>
              </div>
              <button className="bg-blue-600 px-8 py-3 rounded-2xl font-bold">Details</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
