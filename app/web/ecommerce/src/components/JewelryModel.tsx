import { useEffect, useRef, useState } from 'react';

/** Release offscreen WebGL contexts; only visible product media mount a scene. */
export default function JewelryModel({ model, name }: { model: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="product-card__model" onClick={e => e.preventDefault()}>
    {visible && <iframe src={`/jewelry-3d/index.html?embed=1&model=${encodeURIComponent(model)}`} title={`${name} 3D`} />}
  </div>;
}
