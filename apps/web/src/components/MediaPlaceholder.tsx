import type { Category } from '../types/domain';
import './MediaPlaceholder.css';

const ICONS: Record<Category, string> = {
  ring: 'M12 2a6 6 0 00-6 6v1.5H5a1 1 0 00-1 1V21a1 1 0 001 1h14a1 1 0 001-1v-9.5a1 1 0 00-1-1h-1V8a6 6 0 00-6-6zm-4 7.5V8a4 4 0 118 0v1.5H8z',
  bracelet: 'M12 2C7 2 3 6 3 11s4 9 9 9 9-4 9-9-4-9-9-9zm0 4a7 7 0 110 14 7 7 0 010-14z',
  necklace: 'M4 4c1 6 3 9 8 9s7-3 8-9M12 13v3a3 3 0 11-3 3',
  earring: 'M12 2a4 4 0 014 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 014-4zM12 13a4 4 0 00-4 4v2a4 4 0 008 0v-2a4 4 0 00-4-4z',
};

/**
 * Placeholder editorial ivory–gold untuk media produk yang belum tersedia.
 * Dipakai sebagai fallback sementara (bukan solusi permanen), sampai aset foto nyata tersedia.
 */
export default function MediaPlaceholder({ category }: { category: Category }) {
  return (
    <div className={`media-placeholder media-placeholder--${category}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="15%" height="15%">
        <path d={ICONS[category]} stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
