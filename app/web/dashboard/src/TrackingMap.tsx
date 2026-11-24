import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackingPoint } from './types';
import './TrackingMap.css';

const INDONESIA: L.LatLngExpression = [-2.5, 118];

const dot = (kind: 'past' | 'current' | 'draft') => L.divIcon({ className: `tracking-dot tracking-dot--${kind}`, iconSize: [16, 16], iconAnchor: [8, 8] });

/**
 * Shipment route on OpenStreetMap tiles (Leaflet): checkpoints in order, joined by a line,
 * the latest one highlighted. With `onPick`, a click proposes a new checkpoint (admin).
 */
export default function TrackingMap({ points, draft, onPick, label }: {
  points: TrackingPoint[];
  draft?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; });

  useEffect(() => {
    if (!el.current) return;
    // Scroll-wheel zoom stays off so the page keeps scrolling over the map.
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(INDONESIA, 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => pick.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    const path = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    if (path.length > 1) L.polyline(path, { color: '#151922', weight: 2, dashArray: '6 6' }).addTo(group);
    points.forEach((p, i) => {
      L.marker([p.lat, p.lng], { icon: dot(i === points.length - 1 ? 'current' : 'past'), title: p.label, keyboard: false })
        .bindPopup(`<strong>${escapeHtml(p.label)}</strong>${p.note ? `<br>${escapeHtml(p.note)}` : ''}`)
        .addTo(group);
    });
    if (draft) L.marker([draft.lat, draft.lng], { icon: dot('draft'), keyboard: false }).addTo(group);
    if (path.length === 1) m.setView(path[0], 10);
    else if (path.length > 1) m.fitBounds(L.latLngBounds(path), { padding: [36, 36], maxZoom: 12 });
  }, [points, draft]);

  return <div ref={el} className={`tracking-map${onPick ? ' tracking-map--pick' : ''}`} role="application" aria-label={label} />;
}

/** Checkpoint text is staff-entered; escape it before it goes into popup HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
