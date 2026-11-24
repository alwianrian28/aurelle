import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddressStore } from '../../store/addressStore';
import AddressForm from '../../components/AddressForm';
import type { AddressDraft } from '../../utils/address';

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; id: string };

/**
 * F-02 Address book: add, edit, delete, set default (AC-02-01).
 * Deleting is allowed while orders are in progress, because orders keep their own snapshot (FR-02-05).
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
      <>
        <header className="acct-title">
          <div><h2>{mode.kind === 'edit' ? t('address.edit') : t('address.add')}</h2></div>
        </header>
        <div className="acct-card">
          <AddressForm initial={editing} onSubmit={handleSubmit} onCancel={() => setMode({ kind: 'list' })} />
        </div>
      </>
    );
  }

  return (
    <>
      <header className="acct-title">
        <div>
          <h2>{t('account.addresses')}</h2>
          <p>{t('acct.addressIntro')}</p>
        </div>
      </header>

      <ul className="acct-addresses">
        {addresses.map((a) => (
          <li key={a.id} className={`acct-card acct-address${a.isDefault ? ' is-default' : ''}`}>
            <div className="acct-address__name">
              <strong>{a.recipient}</strong>
              {a.isDefault && <span className="acct-badge acct-badge--ink">{t('address.default')}</span>}
            </div>
            <address>
              {a.line1}
              {a.line2 && <><br />{a.line2}</>}
              <br />
              {a.city}, {a.state} {a.postalCode}
              <br />
              {a.country}
            </address>
            <p>{a.phoneCountryCode} {a.phone}</p>
            <div className="acct-address__actions">
              <button id={`address-edit-${a.id}`} type="button" onClick={() => setMode({ kind: 'edit', id: a.id })}>{t('acct.edit')}</button>
              {!a.isDefault && <button id={`address-default-${a.id}`} type="button" onClick={() => setDefault(a.id)}>{t('address.setDefault')}</button>}
              <button
                id={`address-delete-${a.id}`}
                type="button"
                className="is-danger"
                onClick={() => { if (window.confirm(t('address.confirmDelete'))) deleteAddress(a.id); }}
              >
                {t('address.delete')}
              </button>
            </div>
          </li>
        ))}
        <li>
          <button id="address-add" type="button" className="acct-address-add" onClick={() => setMode({ kind: 'add' })}>
            <span aria-hidden="true">+</span>
            {t('acct.addNewAddress')}
          </button>
        </li>
      </ul>
    </>
  );
}
