'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EditorialHeader, PageDial, RollingLabel } from './editorial-ui';
import { MelodyTrail } from './melody-trail';
import { SimplexBackground } from './simplex-background';
import '@/app/landing.css';

const chapters = [
  { first: 'Our', second: 'Cadence.', label: '原创角色 / 音乐创作', caption: 'A MELODY OF THEIR OWN', description: '你创造了他们的模样与故事。现在，为你的角色找到一段可以被听见、被记住的旋律。', action: '进入工作室', number: '01', name: 'Character & melody' },
  { first: 'One theme.', second: 'Many scenes.', label: '同一角色 / 不同片刻', caption: 'THE STORY KEEPS GOING', description: '日常的轻快、回忆的温柔、战斗的坚定。让同一段主题，陪伴故事里的每一种时刻。', action: '开始编曲', number: '02', name: 'Scenes & arrangement' },
  { first: 'Make it', second: 'Your own.', label: '自由调整 / 保存作品', caption: 'FINISH IT YOUR WAY', description: '调整音色、速度与四轨混音，留住每一次选择。导出 MIDI 或 WAV，让故事继续流动。', action: '创作我的旋律', number: '03', name: 'Refine & keep' },
];

export default function Landing() {
  const [page, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null), gate = useRef(0), delta = useRef(0);
  const chapter = chapters[page];
  function go(direction: number) {
    if (performance.now() < gate.current) return;
    gate.current = performance.now() + 500;
    setPage(p => (p + direction + chapters.length) % chapters.length);
  }
  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('page') || 0);
    if (Number.isInteger(value) && value >= 0 && value < 3) setPage(value);
    const element = root.current;
    const wheel = (event: WheelEvent) => {
      if (!element || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || element.scrollHeight > window.innerHeight + 8) return;
      if (performance.now() < gate.current) { delta.current = 0;return; }
      delta.current += event.deltaY;
      if (Math.abs(delta.current) > 95) { go(delta.current > 0 ? 1 : -1);delta.current = 0; }
    };
    const keys = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) return;
      if (event.key === 'ArrowRight') { event.preventDefault();go(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault();go(-1); }
    };
    element?.addEventListener('wheel', wheel, { passive: true });window.addEventListener('keydown', keys);
    return () => { element?.removeEventListener('wheel', wheel);window.removeEventListener('keydown', keys); };
  }, []);
  return <div className="editorial-home" ref={root}>
    <SimplexBackground />
    <EditorialHeader />
    <main className={`chapter-main chapter-${page}`} aria-label="Our Cadence 产品介绍">
      <MelodyTrail />
      <div className="chapter-content" key={page}>
        <div className="chapter-title-block"><h1><span>{chapter.first}</span>{' '}<span>{chapter.second}</span></h1><div className="chapter-meta"><span>{chapter.label}</span><span>{chapter.caption}</span></div></div>
        <div className="chapter-description"><p className="chapter-copy">{chapter.description}</p><Link href="/studio" className="outline-pill"><RollingLabel>{chapter.action}</RollingLabel><ArrowUpRight size={17} /></Link></div>
      </div>
      <span className="sr-only" aria-live="polite">第 {page + 1} 页，共 3 页。{chapter.label}</span>
    </main>
    <footer className="chapter-footer"><PageDial current={page + 1} previous={() => go(-1)} next={() => go(1)} /><div className="chapter-scroll" aria-hidden="true"><span>滚 动</span><i /></div><div className="chapter-index"><span>{chapter.number} / 03</span><span>{chapter.name}</span></div></footer>
  </div>;
}
