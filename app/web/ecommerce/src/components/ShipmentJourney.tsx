import { useTranslation } from 'react-i18next';
import type { OrderTracking } from '../types/domain';
import ShipmentMap from './ShipmentMap';
import { TONE_COLOR } from './shipmentTones';
import './ShipmentJourney.css';

/**
 * Where a parcel is: the courier's latest status, the map with the estimated position, the
 * driver, and every checkpoint, newest first. Used by the Track order page and by the order
 * detail page, so the two always show the same journey.
 *
 * Checkpoints are the courier's scans (through Biteship) together with the ones staff recorded
 * by hand; "no checkpoints yet" shows only when there is neither.
 */
export default function ShipmentJourney({ tracking, fmtDate }: {
  tracking: OrderTracking;
  fmtDate: (iso: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const map = tracking.map ?? null;
  const status = map?.status ?? tracking.status ?? null;
  /** The courier's status in the page's language; one we have no words for is shown as it came. */
  const statusLabel = (code: string) => (i18n.exists(`shipment.status.${code}`) ? t(`shipment.status.${code}`) : code.replace(/_/g, ' '));

  const scans = (tracking.history ?? []).map((scan, index) => ({ key: `scan-${index}`, title: statusLabel(scan.status), note: scan.note, at: scan.at }));
  const manual = tracking.points.map((point) => ({ key: `point-${point.id}`, title: point.label, note: point.note, at: point.at }));
  // Newest first; a scan without a readable time goes to the end.
  const checkpoints = [...scans, ...manual].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));

  const hasMap = !!map && (!!map.origin || !!map.destination || !!map.route) || tracking.points.length > 0;
  const driver = tracking.driver;

  return (
    <div className="journey">
      {status && (
        <div className="journey__status" style={{ borderColor: TONE_COLOR[map?.tone ?? 'normal'] }}>
          <p>
            <span className="journey__dot" style={{ background: TONE_COLOR[map?.tone ?? 'normal'] }} aria-hidden="true" />
            <strong>{statusLabel(status)}</strong>
            {map && <span className="journey__stage">{t('shipment.stageOf', { stage: map.stage })}</span>}
          </p>
          {i18n.exists(`shipment.about.${status}`) && <p>{t(`shipment.about.${status}`)}</p>}
        </div>
      )}

      {hasMap && (
        <>
          <ShipmentMap
            map={map}
            points={tracking.points}
            label={t('order.trackingMap')}
            labels={{ origin: t('shipment.origin'), destination: map?.destination ? t('shipment.destinationArea', { city: map.destination.city }) : '', parcel: status ? statusLabel(status) : '' }}
          />
          {map && (
            <ul className="journey__notes">
              {map.vehicle && <li>{t('shipment.estimated')}</li>}
              {map.route?.kind === 'straight' && <li>{t('shipment.straight')}</li>}
              {map.route && <li>{t(map.route.kind === 'straight' ? 'shipment.distanceStraight' : 'shipment.distance', { km: Math.round(map.route.distanceKm) })}</li>}
              {map.destination && <li>{t(`shipment.precision.${map.destination.precision}`, { city: map.destination.city })}</li>}
            </ul>
          )}
        </>
      )}

      {driver && (
        <p className="journey__driver">
          <span>{t('order.driver')}: </span>{[driver.name, driver.phone, driver.plateNumber].filter(Boolean).join(' · ')}
        </p>
      )}

      {checkpoints.length > 0 ? (
        <ol className="journey__list">
          {checkpoints.map((checkpoint, index) => (
            <li key={checkpoint.key} className={index === 0 ? 'is-latest' : ''}>
              <strong>{checkpoint.title}</strong>
              {checkpoint.note && <span>{checkpoint.note}</span>}
              {Date.parse(checkpoint.at) ? <small>{fmtDate(checkpoint.at)}</small> : null}
            </li>
          ))}
        </ol>
      ) : <p className="journey__empty">{t('order.trackingEmpty')}</p>}
    </div>
  );
}
