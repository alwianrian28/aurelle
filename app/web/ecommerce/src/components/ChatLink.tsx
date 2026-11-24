import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocalePath, useLocalized } from '../hooks/useLocale';
import { useGuideStore } from '../store/guideStore';
import { whatsAppLinkOrNull } from '../config/brand';
import type { I18nText } from '../types/domain';

/**
 * "Chat with us" link: WhatsApp once the official number is set (the message carries no
 * personal data, FR-09-03); until then the Contact page composer. Closes any open guide dialog.
 */
export default function ChatLink({ message, className, id, children }: { message: I18nText; className: string; id: string; children: ReactNode }) {
  const text = useLocalized();
  const path = useLocalePath();
  const close = useGuideStore((s) => s.close);
  const href = whatsAppLinkOrNull(text(message));
  return href
    ? <a id={id} className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <NavLink id={id} className={className} to={path('/contact')} onClick={close}>{children}</NavLink>;
}

