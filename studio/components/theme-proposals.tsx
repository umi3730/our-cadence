'use client';

import { ArrowUpRight, Check, LoaderCircle, Play, Square } from 'lucide-react';
import { displayTime, type Theme } from '@/lib/music';

import { themePresentation } from '@/lib/theme-character';
import { RollingLabel } from './editorial-ui';

export function ThemeProposals({ candidates, selected, playing, position, disabled, needsGeneration, onPlay, onChoose, onContinue }: {
  candidates: Theme[];
  selected: Theme | null;
  playing: string | null;
  position: number;
  disabled: boolean;
  needsGeneration: boolean;
  onPlay: (theme: Theme) => void;
  onChoose: (theme: Theme) => void;
  onContinue: () => void;
}) {
  return <section className="theme-collection" aria-label="主题候选">
    <div className="theme-collection-heading"><div><span>03 / THEME STUDIES</span><h3>同一个角色，三种开场。</h3></div><p>试听，找到你的那一段。</p></div>
    <div className="theme-auto-status" role="status">{needsGeneration ? <><LoaderCircle size={14} className="spin" aria-hidden="true" />正在同步参数…</> : <><Check size={14} aria-hidden="true" />参数已同步</>}{selected && <span>已采用的主题保留，选新提案后替换。</span>}</div>
    <div className="theme-card-grid">{candidates.map((candidate, index) => {
      const style = themePresentation(candidate.style, candidate.character);
      const isPlaying = playing === candidate.id;
      const isSelected = selected?.id === candidate.id && selected?.sourceKey === candidate.sourceKey;
      const seconds = 16 * 60 / (candidate.bpm ?? 100);
      const progress = isPlaying ? Math.min(1, position / seconds) : 0;
      const pitches = candidate.notes.map(note => note.pitch);
      const lowest = Math.min(...pitches) - 2, highest = Math.max(...pitches) + 2;
      return <article key={candidate.id} className={`theme-study${isSelected ? ' is-selected' : ''}${isPlaying ? ' is-playing' : ''}`} data-style={candidate.style ?? 'lyrical'}>
        <div className="theme-study-top"><span className="theme-study-index">0{index + 1}</span><span className="theme-study-style">{style.subtitle}</span><span className="theme-study-state">{isSelected ? <><Check size={13} aria-hidden="true" />已采用</> : isPlaying ? '试听中' : style.label}</span></div>
        <div className="theme-study-title"><h4>{candidate.name}</h4><p>{style.description}</p></div>
        <div className="theme-score-surface">
          <svg viewBox="0 0 320 92" role="img" aria-label={`${candidate.name}的四小节旋律，${candidate.notes.length}个音符`}>
            {[0, 1, 2, 3, 4].map(bar => <line key={`bar-${bar}`} className="theme-score-grid" x1={bar * 80} y1="0" x2={bar * 80} y2="92" />)}
            {[18, 36, 54, 72].map(y => <line key={y} className="theme-score-line" x1="0" y1={y} x2="320" y2={y} />)}
            {candidate.notes.map((note, i) => <rect key={i} className={`theme-score-note${isPlaying && progress * 16 >= note.beat && progress * 16 < note.beat + note.duration ? ' is-sounding' : ''}`} x={note.beat / 16 * 320} y={8 + (highest - note.pitch) / (highest - lowest) * 68} width={Math.max(3, note.duration / 16 * 320 - 1)} height="4" rx="1.5" />)}
            {isPlaying && <line className="theme-score-playhead" x1={progress * 320} y1="0" x2={progress * 320} y2="92" />}
          </svg>
          <div className="theme-score-bars" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span></div>
        </div>
        <div className="theme-study-meta"><span><b>{candidate.bpm ?? 100}</b> BPM</span><span>4 小节</span><span>{displayTime(seconds)}</span></div>
        <div className="theme-study-actions"><button className="theme-listen" onClick={() => onPlay(candidate)} disabled={disabled} aria-label={`${isPlaying ? '停止' : '试听'}主题${candidate.name}`}><span>{isPlaying ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}</span>{isPlaying ? '停止试听' : '试听片段'}</button><button className="theme-pick" onClick={() => onChoose(candidate)} disabled={disabled || isSelected} aria-label={`采用${candidate.name}`} aria-pressed={isSelected}>{isSelected ? <><span>已采用</span><Check size={15} aria-hidden="true" /></> : <><RollingLabel>选这一段</RollingLabel><span className="theme-pick-icon" aria-hidden="true"><ArrowUpRight size={16} /><ArrowUpRight size={16} className="theme-pick-icon-echo" /></span></>}</button></div>
      </article>;
    })}</div>
    <div className="theme-collection-footer"><p>{selected ? `已选「${selected.name}」` : '选定主题后，继续场景编曲。'}</p><button className="outline-pill" disabled={!selected || disabled} onClick={onContinue}>场景编曲<ArrowUpRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
