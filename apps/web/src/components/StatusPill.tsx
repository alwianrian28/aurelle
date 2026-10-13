import { useTranslation } from 'react-i18next';
import type { PaymentStatus, ReadyStockOrderStatus } from '../types/domain';

const WORK_VARIANT: Record<ReadyStockOrderStatus, string> = {
  awaiting_payment: 'pill--warning',
  confirmed: 'pill--info',
  preparing: 'pill--info',
  ready_to_ship: 'pill--silver',
  shipped: 'pill--silver',
  delivered: 'pill--success',
  cancelled: 'pill--error',
  pending_decision: 'pill--warning',
};

const PAY_VARIANT: Record<PaymentStatus, string> = {
  unpaid: '',
  pending: 'pill--warning',
  partial: 'pill--info',
  paid: 'pill--success',
  failed: 'pill--error',
  expired: 'pill--error',
  review_finance: 'pill--warning',
  refund_pending: 'pill--info',
  refunded: 'pill--info',
};

/** Pill status pengerjaan — dipisah dari status pembayaran (FR-18-03). */
export function WorkStatusPill({ status }: { status: ReadyStockOrderStatus }) {
  const { t } = useTranslation();
  return <span className={`pill ${WORK_VARIANT[status]}`}>{t(`order.status.${status}`)}</span>;
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return <span className={`pill ${PAY_VARIANT[status]}`}>{t(`order.payStatus.${status}`)}</span>;
}
