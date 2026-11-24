import { useEffect, useRef } from 'react';
import { mountEntrance } from '../showroom/entrance.js';
import './Entrance.css';
import { showroomMarkup } from '../showroom/markup.js';
import '../showroom/style.css';

/** Quality Pass showroom; owns its timeline, controls, fallback and teardown. */
export default function Entrance() {
  const ref = useRef<HTMLDivElement>(null);
  const language = 'en';
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language;
    window.scrollTo(0, 0);
    root.querySelectorAll<HTMLImageElement>('[data-asset]').forEach(image => {
      image.src = `/media/showroom/${image.dataset.asset}`;
    });
    const poster = root.querySelector<HTMLImageElement>('.poster');
    if (poster) poster.src = '/media/showroom/ring-poster-dark.png';
    const home = root.querySelector<HTMLAnchorElement>('.monogram');
    if (home) home.href = "/";
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const entrance = mountEntrance(root, {
      onFallback: () => {
        cancelled = true; dispose?.(); root.classList.add('webgl-failed');
      }
    });
    // Paint the poster before downloading and initializing the WebGL experience.
    const frame = requestAnimationFrame(() => {
      const timer = window.setTimeout(() => {
        void import('../showroom/experience.js').then(({ initExperience }) => {
          if (cancelled) return;
          dispose = initExperience(root, {
            storeUrl: '/store', initialLanguage: language,
            onReady: () => entrance.ready('render'), onError: () => entrance.fallback('render-error')
          });
          if (cancelled) dispose(); else entrance.ready('ui');
        }).catch(() => { if (!cancelled) entrance.fallback('render-error'); });
      }, 80);
      root.dataset.startupTimer = String(timer);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); clearTimeout(Number(root.dataset.startupTimer)); entrance.dispose(); dispose?.(); document.documentElement.lang = previousLanguage; };
  }, [language]);
  return <>
    <title>Aurelle — The Art of Detail</title>
    <meta name="description" content="Explore the Aurelle silver showroom in twelve chapters, then discover the collection." />
    <div ref={ref} id="aurelle" dangerouslySetInnerHTML={{ __html: showroomMarkup }} />
  </>;
}
