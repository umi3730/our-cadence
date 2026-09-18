'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { EditorialHeader, PageDial, RollingLabel } from './editorial-ui';
import { MelodyTrail } from './melody-trail';
import { SimplexBackground } from './simplex-background';
import { CelestialDecorations } from './celestial-decorations';
import '@/app/landing.css';

const chapters = [
  { first: 'Our', second: 'Cadence.', label: '原创角色 · 音乐创作', caption: 'A melody of their own', description: '你创造了他们的模样与故事。现在，为你的角色找到一段可以被听见、被记住的旋律。', highlights: ['模样与故事', '角色', '旋律'], action: '进入工作室', number: '01', name: 'Character & melody' },
  { first: 'One theme.', second: 'Many scenes.', label: '同一主题 · 不同片刻', caption: 'The story keeps going', description: '日常的轻快、回忆的温柔、战斗的坚定。让同一段主题，陪伴故事里的每一种时刻。', highlights: ['日常', '回忆', '战斗'], action: '开始编曲', number: '02', name: 'Scenes & arrangement' },
  { first: 'Make it', second: 'Your own.', label: '自由调整 · 保存作品', caption: 'Finish it your way', description: '调整音色、速度与四轨混音，留住每一次选择。导出 MIDI 或 WAV，让故事继续流动。', highlights: ['音色', '四轨混音', '故事'], action: '创作我的旋律', number: '03', name: 'Refine & keep' },
];

function ChapterCopy({ text, highlights }: { text: string; highlights: string[] }) {
  // These phrases are fixed copy, not user input or arbitrary patterns.
  const parts = text.split(new RegExp(`(${highlights.join('|')})`, 'g'));
  return <p className="chapter-copy">{parts.map((part, index) => {
    const accent = highlights.indexOf(part);
    return accent < 0 ? part : <mark key={index} className="chapter-copy-highlight" data-tone={['blue', 'violet', 'rose'][accent]}>{part}</mark>;
  })}</p>;
}

export default function Landing() {
  const [page, setPage] = useState(0);
  const [decorationsPaused, setDecorationsPaused] = useState(false);
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
  return <div className="editorial-home" ref={root} data-decorations-paused={decorationsPaused}>
    <SimplexBackground />
    <EditorialHeader />
    <main className={`chapter-main chapter-${page}`} aria-label="Our Cadence 产品介绍">
      <CelestialDecorations paused={decorationsPaused} />
      <MelodyTrail />
      <div className="chapter-content" key={page}>
        <div className="chapter-title-block">
          <h1 aria-label={`${chapter.first} ${chapter.second}`}>
            <span>{page === 0 ? <><span className="chapter-initial chapter-initial-o">O</span>ur</> : page === 1 ? <>One <span className="chapter-title-blue">theme</span>.</> : chapter.first}</span>{' '}
            <span>{page === 0 ? <><span className="chapter-initial chapter-initial-c">C</span>adence.</> : page === 1 ? <>Many <span className="chapter-title-violet">scenes</span>.</> : <span className="chapter-title-rose">{chapter.second}</span>}</span>
          </h1>
          <div className="chapter-meta"><span>{chapter.label}</span><span>{chapter.caption}</span></div>
        </div>
        <div className="chapter-description"><ChapterCopy text={chapter.description} highlights={chapter.highlights} /><Link href="/studio" className="outline-pill"><RollingLabel>{chapter.action}</RollingLabel><ArrowUpRight size={17} /></Link></div>
      </div>
      <span className="sr-only" aria-live="polite">第 {page + 1} 页，共 3 页。{chapter.label}</span>
    </main>
    <footer className="chapter-footer"><PageDial current={page + 1} previous={() => go(-1)} next={() => go(1)} /><div className="chapter-scroll" aria-hidden="true"><span>滚 动</span><i /></div><div className="chapter-index"><button className="decoration-motion-toggle" type="button" aria-label="暂停装饰动效" aria-pressed={decorationsPaused} onClick={() => setDecorationsPaused(paused => !paused)}>{decorationsPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button><span className="chapter-index-number">{chapter.number} / 03</span><span>{chapter.name}</span></div></footer>
  </div>;
}
