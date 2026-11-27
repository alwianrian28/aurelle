import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LANGUAGES, setLanguage } from '../i18n';
import ShipmentJourney from '../components/ShipmentJourney';
import { Result, type Shown } from '../pages/TrackOrder';
import type { OrderTracking, ShipmentMapData, ShipmentTone } from '../types/domain';

/**
 * DEV-ONLY: the parcel journey in every state a shipment can be in, with made-up data, so the
 * colours and the map can be checked without waiting for a courier to report each status
 * (/__shipment, or /__shipment?only=on_hold). With ?page=track the same samples are shown as the
 * Track order page shows them (add &guest=1 for what a lookup without login sees). Not part of
 * the production build.
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
  // ?lang=ja shows the samples in that language (and leaves the browser in it).
  const lang = LANGUAGES.find((l) => l.code === params.get('lang'))?.code;
  useEffect(() => { if (lang) setLanguage(lang); }, [lang]);
  if (params.get('page') === 'track') {
    const [, tracking] = CASES.find(([name]) => name === (only ?? 'in_transit')) ?? CASES[3];
    const guest = params.get('guest') === '1';
    const delivered = tracking.status === 'delivered';
    const order: Shown = {
      id: guest ? undefined : 'ord-preview', number: 'AUR-RS-261126-4894', status: delivered ? 'delivered' : 'shipped', paymentStatus: 'paid', createdAt: '2026-11-26T14:09:00Z', updatedAt: '2026-11-27T14:21:00Z',
      history: [{ status: 'awaiting_payment', paymentStatus: 'unpaid', at: '2026-11-26T14:09:00Z' }, { status: 'confirmed', paymentStatus: 'paid', at: '2026-11-26T14:10:00Z' }, { status: 'preparing', paymentStatus: 'paid', at: '2026-11-26T14:15:00Z' }, { status: 'ready_to_ship', paymentStatus: 'paid', at: '2026-11-26T14:20:00Z' }],
      tracking: { ...tracking, link: 'https://example.com/track', parcel: { count: 1, weightGrams: 400 }, driver: tracking.driver && guest ? { name: tracking.driver.name } : tracking.driver, map: tracking.map ? { ...tracking.map, origin: tracking.map.origin && { ...tracking.map.origin, city: 'Jakarta Selatan' } } : tracking.map },
      items: [{ name: { en: 'Open Ring', id: 'Cincin Terbuka' }, variantLabel: { en: 'White gold · US 6', id: 'Emas putih · US 6' }, image: '', qty: 1 }, { name: { en: 'Layered Necklace', id: 'Kalung Berlapis' }, variantLabel: { en: 'White gold · 42 cm', id: 'Emas putih · 42 cm' }, image: '', qty: 1 }],
      shippingService: { courier: 'JNE', name: { en: 'Regular', id: 'Reguler' }, etaDays: '2-4' }, destination: { city: tracking.map?.destination?.city ?? 'Bandung', country: 'Indonesia' }, paymentMethod: guest ? undefined : 'qris',
      recipient: guest ? undefined : { name: 'Sample Customer', phone: '+62 812-••••-4471', lines: ['Jl. Contoh Raya No. 18', 'Bandung, Jawa Barat 40115'] },
    };
    return <article className="trk"><div className="container trk__inner" style={{ paddingTop: 24 }}><Result order={order} detailPath={guest ? null : '/account/orders/ord-preview'} contactPath="/contact" /></div></article>;
  }
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
