import { useEffect, useState } from 'react';

/** Sisa waktu (ms) hingga `target`, diperbarui tiap detik. Tidak pernah negatif. */
export function useCountdown(target: string | undefined): number {
  const compute = () => (target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0);
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    if (!target) return;
    const id = window.setInterval(() => setRemaining(compute()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return remaining;
}

export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
