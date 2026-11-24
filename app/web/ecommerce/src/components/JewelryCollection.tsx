import { useState } from 'react';
import { useLocale } from '../hooks/useLocale';
import './JewelryCollection.css';

/** Load a single isolated WebGL scene only when the visitor opens the collection. */
export default function JewelryCollection({ location }: { location: 'store' | 'shop' }) {
  const id = useLocale() === 'id';
  const [active, setActive] = useState(false);
  return <section className="jewelry-collection" aria-labelledby={`${location}-3d-title`}>
    <header className="jewelry-collection__header">
      <p className="eyebrow">AURELLE · SILVER EDITION · 360°</p>
      <h2 id={`${location}-3d-title`}>{id ? 'Koleksi dalam setiap sudut' : 'The collection, from every angle'}</h2>
      <p>{id ? '7 cincin · 7 gelang · 7 kalung · 8 anting' : '7 rings · 7 bracelets · 7 necklaces · 8 earrings'}</p>
    </header>
    {active ? <iframe id={`${location}-3d-viewer`} src="/jewelry-3d/index.html" title={id ? 'Koleksi perhiasan 3D interaktif Aurelle' : 'Aurelle interactive 3D jewelry collection'} /> :
      <button id={`${location}-3d-start`} className="jewelry-collection__start" onClick={() => setActive(true)}>{id ? 'JELAJAHI 29 MODEL DALAM 3D' : 'EXPLORE 29 PIECES IN 3D'} ↗</button>}
    <footer className="jewelry-collection__footer">{id ? 'Pilih kategori dan nomor model · Seret untuk memutar · Scroll / cubit untuk zoom' : 'Choose a category and model · Drag to rotate · Scroll / pinch to zoom'}</footer>
  </section>;
}
