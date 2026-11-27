import { useSearchParams } from 'react-router-dom';
import ShipmentJourney from '../components/ShipmentJourney';
import type { OrderTracking, ShipmentMapData, ShipmentTone } from '../types/domain';

/**
 * DEV-ONLY: the parcel journey in every state a shipment can be in, with made-up data, so the
 * colours and the map can be checked without waiting for a courier to report each status
 * (/__shipment, or /__shipment?only=on_hold). Not part of the production build.
 */
const ROAD: [number, number][] = [[-6.2437, 106.8003], [-6.31, 106.95], [-6.42, 107.18], [-6.55, 107.44], [-6.74, 107.52], [-6.8848, 107.6152]];
const ORIGIN = { lat: ROAD[0][0], lng: ROAD[0][1] };
const BANDUNG = { lat: -6.8848, lng: 107.6152, precision: 'district' as const, city: 'Bandung' };
const DENPASAR = { lat: -8.6705, lng: 115.2126, precision: 'city' as const, city: 'Denpasar' };

function cut(line: [number, number][], progress: number) {
  const at = Math.min(line.length - 2, Math.floor(progress * (line.length - 1)));
  const t = progress * (line.length - 1) - at;
  const point: [number, number] = [line[at][0] + (line[at + 1][0] - line[at][0]) * t, line[at][1] + (line[at + 1][1] - line[at][1]) * t];
  return { point, passed: [...line.slice(0, at + 1), point], remaining: [point, ...line.slice(at + 1)] };
}

function sample(status: string, stage: ShipmentMapData['stage'], tone: ShipmentTone, progress: number, options: { vehicle?: boolean; straight?: boolean; noRoute?: boolean; returning?: boolean } = {}): OrderTracking {
  const destination = options.straight ? DENPASAR : BANDUNG;
  const line: [number, number][] = options.straight ? [ROAD[0], [destination.lat, destination.lng]] : ROAD;
  const { point, passed, remaining } = cut(line, progress);
  const scans = ['allocated', 'picked', 'in_transit', 'dropping_off'].slice(0, Math.max(1, stage - 1));
  return {
    courier: 'JNE', trackingNumber: 'JNE0001234567', points: [], status, link: null, updatedAt: '2026-11-27T04:00:00Z',
    driver: stage >= 4 ? { name: 'Budi', phone: '0812 0001 11', plateNumber: 'B 1234 XY', photoUrl: null } : null,
    history: [...scans, ...(scans.includes(status) ? [] : [status])].map((s, i) => ({ status: s, note: i === 1 ? 'Paket telah diterima kurir di lokasi pengirim' : '', at: `2026-11-2${5 + Math.min(i, 2)}T0${i + 2}:00:00Z` })),
    map: {
      estimated: true, status, stage, tone, progress, returning: !!options.returning, etaAt: '2026-11-28T03:00:00Z', origin: ORIGIN, destination,
      route: options.noRoute ? null : { kind: options.straight ? 'straight' : 'road', distanceKm: options.straight ? 966 : 165, passed, remaining },
      vehicle: options.vehicle === false || options.noRoute ? null : { lat: point[0], lng: point[1] },
    },
  };
}

const CASES: [string, OrderTracking][] = [
  ['picking_up', sample('picking_up', 1, 'normal', 0)],
  ['picked', sample('picked', 2, 'normal', 0.03)],
  ['cancelled', sample('cancelled', 2, 'gray', 0, { vehicle: false })],
  ['in_transit', sample('in_transit', 3, 'normal', 0.45)],
  ['in_transit (no road)', sample('in_transit', 3, 'normal', 0.45, { straight: true })],
  ['in_transit (router down)', sample('in_transit', 3, 'normal', 0.45, { noRoute: true })],
  ['dropping_off', sample('dropping_off', 4, 'normal', 0.92)],
  ['on_hold', sample('on_hold', 3, 'orange', 0.45)],
  ['delivered', sample('delivered', 5, 'green', 1)],
  ['return_in_transit', sample('return_in_transit', 5, 'purple', 0.6, { returning: true })],
  ['rejected', sample('rejected', 5, 'red', 1)],
  ['disposed', sample('disposed', 5, 'red', 0.45)],
  ['unknown status', sample('teleported', 3, 'normal', 0.45)],
];

export default function ShipmentPreview() {
  const [params] = useSearchParams();
  const only = params.get('only');
  const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <main style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 32, padding: 32, background: '#fff' }}>
      {CASES.filter(([name]) => !only || name === only).map(([name, tracking]) => (
        <section key={name}>
          <h2 style={{ margin: '0 0 12px', font: '600 13px/1.4 monospace' }}>{name}</h2>
          <ShipmentJourney tracking={tracking} fmtDate={fmtDate} />
        </section>
      ))}
    </main>
  );
}
