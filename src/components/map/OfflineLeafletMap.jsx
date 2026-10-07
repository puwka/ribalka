import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { resolveLatLng } from '../../lib/coords';
import { WATER_TYPE } from '../../lib/waterUtils';
import 'leaflet/dist/leaflet.css';
import './OfflineLeafletMap.css';

const PERM_CENTER = [58.01, 56.25];
const DEFAULT_ZOOM = 7;

function colorForType(type) {
  if (type === WATER_TYPE.FREE) return '#16a34a';
  if (type === WATER_TYPE.PAID_FISHING) return '#2563eb';
  return '#ca8a04';
}

/**
 * OSM map that works from SW / browser tile cache when offline
 * (after tiles were loaded once while online).
 */
export default function OfflineLeafletMap({ places = [], onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: PERM_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
      // Prefer cached tiles when offline
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = [];

    places.forEach((place) => {
      const { lat, lng } = resolveLatLng(place);
      if (lat == null || lng == null) return;

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: colorForType(place.type),
        fillOpacity: 0.95,
      });

      marker.bindTooltip(place.name || 'Водоём', { direction: 'top', offset: [0, -6] });
      marker.on('click', () => onSelect?.(place));
      marker.addTo(layer);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 1) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      } catch {
        /* ignore */
      }
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 11);
    }
  }, [places, onSelect]);

  return (
    <div className="offline-leaflet">
      <div className="offline-leaflet__badge" role="status">
        Офлайн-карта · OpenStreetMap
      </div>
      <div ref={containerRef} className="offline-leaflet__canvas" />
    </div>
  );
}
