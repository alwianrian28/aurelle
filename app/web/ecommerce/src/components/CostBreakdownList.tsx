import { useTranslation } from 'react-i18next';
import type { CostBreakdown } from '../types/domain';

/**
 * Rincian biaya terpisah: subtotal, pajak, ongkir, bea masuk, biaya lain, total (BR-15, FR-08-03).
 * Total selalu sama dengan penjumlahan komponennya (AC-08-02).
 */
export default function CostBreakdownList({
  costs,
  format,
}: {
  costs: CostBreakdown;
  format: (idr: number) => string;
}) {
  const { t } = useTranslation();
  const rows: [string, number][] = [
    [t('common.subtotal'), costs.subtotal],
    [t('common.tax'), costs.tax],
    [t('common.shipping'), costs.shipping],
    [t('common.duty'), costs.duty],
    [t('common.other'), costs.other],
  ];
  return (
    <dl className="dl-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{format(value)}</dd>
        </div>
      ))}
      <div className="is-total">
        <dt>{t('common.total')}</dt>
        <dd>{format(costs.total)}</dd>
      </div>
    </dl>
  );
}
