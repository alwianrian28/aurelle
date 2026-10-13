import { useState } from 'react';
import type { Category } from '../types/domain';
import MediaPlaceholder from './MediaPlaceholder';

interface SmartImageProps {
  src?: string;
  alt: string;
  category: Category;
  loading?: 'lazy' | 'eager';
  className?: string;
}

/** Gambar dengan fallback otomatis ke placeholder jika aset belum tersedia atau gagal dimuat. */
export default function SmartImage({ src, alt, category, loading = 'lazy', className }: SmartImageProps) {
  const [failed, setFailed] = useState(!src);
  if (failed) return <MediaPlaceholder category={category} />;
  return <img src={src} alt={alt} loading={loading} className={className} onError={() => setFailed(true)} />;
}
