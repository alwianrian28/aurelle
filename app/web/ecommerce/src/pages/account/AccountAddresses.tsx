import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/addressStore';
import AddressForm from '../../components/AddressForm';
import type { AddressDraft } from '../../utils/address';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; id: string };

/**
 * F-02 Buku Alamat — tambah, ubah, hapus, jadikan default (AC-02-01).
 * Hapus diizinkan walau dipakai pesanan berjalan karena pesanan memakai snapshot (FR-02-05).
 */
export default function AccountAddresses() {
  const { t } = useTranslation();
  const { addresses, addAddress, updateAddress, deleteAddress, setDefault } = useAddressStore();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const editing = mode.kind === 'edit' ? addresses.find((a) => a.id === mode.id) : undefined;

  const handleSubmit = (draft: AddressDraft) => {
    if (mode.kind === 'edit') updateAddress(mode.id, draft);
    else addAddress(draft);
    setMode({ kind: 'list' });
  };

  if (mode.kind !== 'list') {
    return (
      <div className="card account-panel">
        <div className="account-panel__head">
          <h2>{mode.kind === 'edit' ? t('address.edit') : t('address.add')}</h2>
        </div>
        <AddressForm initial={editing} onSubmit={handleSubmit} onCancel={() => setMode({ kind: 'list' })} />
      </div>
    );
  }

  return (
    <div className="card account-panel">
      <div className="account-panel__head">
        <h2>{t('address.title')}</h2>
        <button className="btn btn--primary btn--sm" onClick={() => setMode({ kind: 'add' })} id="address-add">
          + {t('address.add')}
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="empty-state">
          <p>{t('address.empty')}</p>
        </div>
      ) : (
        <ul className="address-grid">
          {addresses.map((a) => (
            <li key={a.id} className={`card address-card ${a.isDefault ? 'is-default' : ''}`}>
              <div className="address-card__name">
                <span>{a.recipient}</span>
                {a.isDefault && <span className="pill pill--silver">{t('address.default')}</span>}
              </div>
              <span className="text-muted">
                {a.phoneCountryCode} {a.phone}
              </span>
              <address style={{ fontStyle: 'normal' }}>
                {a.line1}
                {a.line2 && (
                  <>
                    <br />
                    {a.line2}
                  </>
                )}
                <br />
                {a.city}, {a.state} {a.postalCode}
                <br />
                {a.country}
              </address>
              <div className="address-card__actions">
                <button className="link" onClick={() => setMode({ kind: 'edit', id: a.id })}>
                  {t('address.edit')}
                </button>
                {!a.isDefault && (
                  <button className="link" onClick={() => setDefault(a.id)}>
                    {t('address.setDefault')}
                  </button>
                )}
                <button
                  className="link is-danger"
                  onClick={() => {
                    if (window.confirm(t('address.confirmDelete'))) deleteAddress(a.id);
                  }}
                >
                  {t('address.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
