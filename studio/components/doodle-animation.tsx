'use client';

import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';

/** Locally hosted, unmodified Lordicon artwork. */
export function DoodleAnimation({ name, animated = false, paused = false }: { name: string; animated?: boolean; paused?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current?.();
  }, [paused]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let ready = false;
    let player: AnimationItem | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (!player || !ready) return;
      if (!animated || reducedMotion.matches) {
        player.goToAndStop(0, true);
      } else if (pausedRef.current || document.hidden) {
        player.pause();
      } else {
        player.play();
      }
    };
    syncRef.current = sync;
    reducedMotion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    import('lottie-web/build/player/lottie_light.js').then(({ default: lottie }) => {
      if (disposed) return;
      player = lottie.loadAnimation({ container, renderer: 'svg', loop: true, autoplay: false, path: `/assets/doodle-motif/${name}.json` });
      player.setSpeed(.65);
      player.addEventListener('DOMLoaded', () => {
        if (disposed) return;
        ready = true;
        container.dataset.state = 'ready';
        sync();
      });
      player.addEventListener('data_failed', () => { container.dataset.state = 'error'; });
    }).catch(() => { if (!disposed) container.dataset.state = 'error'; });
    return () => {
      disposed = true;
      syncRef.current = null;
      reducedMotion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      player?.destroy();
    };
  }, [name, animated]);

  return <div ref={host} className="doodle-animation" aria-hidden="true" />;
}
