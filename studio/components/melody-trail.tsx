'use client';

import { useEffect, useRef } from 'react';

/** A small, decorative trail scoped to the landing page's main area. */
export function MelodyTrail() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = layer.current;
    const area = container?.parentElement;
    if (!container || !area) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const particles = new Map<HTMLElement, Animation>();
    let previous: { x: number; y: number } | null = null;
    let lastEmission = 0;
    let count = 0;

    const clear = () => {
      for (const [particle, animation] of particles) {
        animation.cancel();
        particle.remove();
      }
      particles.clear();
      previous = null;
      lastEmission = 0;
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.buttons || reducedMotion.matches || !finePointer.matches) return;
      if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, [role="button"]')) {
        previous = null;
        return;
      }

      const now = performance.now();
      const point = { x: event.clientX, y: event.clientY };
      if (!previous) { previous = point; return; }
      const dx = point.x - previous.x, dy = point.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 20 || now - lastEmission < 32) return;
      previous = point;
      lastEmission = now;
      if (particles.size >= 28) return;

      count += 1;
      const isNote = count % 6 === 0;
      const particle = document.createElement('span');
      particle.className = `melody-trail-particle${isNote ? ' melody-trail-note' : ''}`;
      particle.textContent = isNote ? '♪' : '✦';
      particle.style.left = `${point.x - dx / distance * 10}px`;
      particle.style.top = `${point.y - dy / distance * 10}px`;
      particle.style.fontSize = `${isNote ? 17 : 11 + Math.random() * 8}px`;
      particle.style.color = isNote ? 'var(--trail-ink)' : count % 3 === 0 ? 'var(--trail-gold-bright)' : 'var(--trail-gold)';
      container.appendChild(particle);

      const rotation = Math.random() * 50 - 25;
      const driftX = (Math.random() - 0.5) * 24 - dx / distance * 12;
      const driftY = 20 + Math.random() * 20;
      const animation = particle.animate([
        { opacity: 0, transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(.45)` },
        { opacity: isNote ? .65 : .95, transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(1)`, offset: .14 },
        { opacity: 0, transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px)) rotate(${rotation + 35}deg) scale(.25)` },
      ], { duration: isNote ? 1000 : 720 + Math.random() * 220, easing: 'ease-out', fill: 'forwards' });
      particles.set(particle, animation);
      animation.onfinish = () => { particle.remove(); particles.delete(particle); };
    };

    area.addEventListener('pointermove', move, { passive: true });
    area.addEventListener('pointerleave', clear);
    area.addEventListener('pointerdown', clear);
    window.addEventListener('blur', clear);
    window.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', clear);
    reducedMotion.addEventListener('change', clear);
    finePointer.addEventListener('change', clear);

    return () => {
      clear();
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerleave', clear);
      area.removeEventListener('pointerdown', clear);
      window.removeEventListener('blur', clear);
      window.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', clear);
      reducedMotion.removeEventListener('change', clear);
      finePointer.removeEventListener('change', clear);
    };
  }, []);

  return <div className="melody-trail" ref={layer} aria-hidden="true" />;
}
