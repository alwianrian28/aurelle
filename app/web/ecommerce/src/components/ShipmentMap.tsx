import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ShipmentMapData, ShipmentTone, TrackingPoint } from '../types/domain';
import { TONE_COLOR } from './shipmentTones';
import './TrackingMap.css';

const INDONESIA: L.LatLngExpression = [-2.5, 118];

const PARCEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>';

const pin = (kind: 'origin' | 'destination' | 'point') => L.divIcon({ className: `shipment-pin shipment-pin--${kind}`, iconSize: [14, 14], iconAnchor: [7, 7] });
const parcel = (tone: ShipmentTone) => L.divIcon({ className: 'shipment-parcel', html: `<span style="background:${TONE_COLOR[tone]}">${PARCEL}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });

/**
 * The shipment on OpenStreetMap tiles (Leaflet): the store, the customer's area, the route
 * between them and the parcel's estimated place on it. The part already travelled is a solid
 * line in the status colour, the rest is dotted; a route with no road (another island) is one
 * dashed straight line. Checkpoints staff recorded by hand are small dots. Draws whatever of
 * this it is given: a map without a route still shows its two ends.
 */
const NO_POINTS: TrackingPoint[] = [];

export default function ShipmentMap({ map, points = NO_POINTS, label, labels }: {
  map: ShipmentMapData | null;
  points?: TrackingPoint[];
  label: string;
  labels: { origin: string; destination: string; parcel: string };
}) {
  const el = useRef<HTMLDivElement>(null);
  const leaflet = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  /** Brings everything drawn into view; run again whenever the box changes size. */
  const fit = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!el.current) return;
    // Scroll-wheel zoom stays off so the page keeps scrolling over the map.
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(INDONESIA, 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    leaflet.current = m;
    // The box can change size without the window doing so (full screen, a column that reflows).
    const resized = new ResizeObserver(() => { m.invalidateSize({ animate: false }); fit.current(); });
    resized.observe(el.current);
    return () => { resized.disconnect(); m.remove(); leaflet.current = null; };
  }, []);

  useEffect(() => {
    const m = leaflet.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    const seen: L.LatLngTuple[] = [];
    const colour = TONE_COLOR[map?.tone ?? 'normal'];
    if (map?.route) {
      const straight = map.route.kind === 'straight';
      if (map.route.remaining.length > 1) L.polyline(map.route.remaining, { color: '#6b7280', weight: 3, dashArray: straight ? '10 10' : '1 8', lineCap: 'round' }).addTo(group);
      if (map.route.passed.length > 1) L.polyline(map.route.passed, { color: colour, weight: 4, dashArray: straight ? '10 10' : undefined, lineCap: 'round' }).addTo(group);
      seen.push(...map.route.passed, ...map.route.remaining);
    }
    points.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: pin('point'), title: p.label, keyboard: false }).bindPopup(`<strong>${escapeHtml(p.label)}</strong>${p.note ? `<br>${escapeHtml(p.note)}` : ''}`).addTo(group);
      seen.push([p.lat, p.lng]);
    });
    if (map?.origin) {
      L.marker([map.origin.lat, map.origin.lng], { icon: pin('origin'), title: labels.origin, keyboard: false }).bindPopup(escapeHtml(labels.origin)).addTo(group);
      seen.push([map.origin.lat, map.origin.lng]);
    }
    if (map?.destination) {
      L.marker([map.destination.lat, map.destination.lng], { icon: pin('destination'), title: labels.destination, keyboard: false }).bindPopup(escapeHtml(labels.destination)).addTo(group);
      seen.push([map.destination.lat, map.destination.lng]);
    }
    if (map?.vehicle) {
      L.marker([map.vehicle.lat, map.vehicle.lng], { icon: parcel(map.tone), title: labels.parcel, keyboard: false, zIndexOffset: 500 }).bindPopup(escapeHtml(labels.parcel)).addTo(group);
    }
    fit.current = () => {
      if (seen.length === 1) m.setView(seen[0], 10, { animate: false });
      else if (seen.length > 1) m.fitBounds(L.latLngBounds(seen), { padding: [36, 36], maxZoom: 12, animate: false });
    };
    fit.current();
  }, [map, points, labels.origin, labels.destination, labels.parcel]);

  return <div ref={el} className="tracking-map" role="application" aria-label={label} />;
}

/** Popup text goes in as HTML: escape it first. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
