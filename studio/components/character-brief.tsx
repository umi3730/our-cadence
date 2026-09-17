'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, ImagePlus, Pencil, Sparkles } from 'lucide-react';
import type { Profile } from '@/lib/music';

export function CharacterBrief({ profile, disabled, onChange, onReanalyze, onUpload }: {
  profile: Profile; disabled: boolean;
  onChange: (patch: { name?: string; description?: string }) => void;
  onReanalyze: () => void;
  onUpload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const storyId = useId();
  const editing = expanded || !profile.image;
  const canExpandStory = profile.description.length > 40 || profile.description.includes('\n');
  return <section className={`character-brief${editing ? ' is-editing' : ''}`} aria-label="角色档案">
    <div className="brief-art" aria-hidden="true"><img className="brief-art-stars" src="/assets/character-card/stars.svg" alt="" width="58" height="58" draggable={false} /><img className="brief-art-music" src="/assets/character-card/music.svg" alt="" width="36" height="36" draggable={false} /></div>
    <div className="brief-identity">
      <button className="brief-avatar" onClick={onUpload} disabled={disabled} aria-label={profile.image ? '更换角色参考图' : '上传角色参考图'}>{profile.image?.thumbnail ? <img src={profile.image.thumbnail} alt="" /> : <ImagePlus size={22} strokeWidth={1.4} aria-hidden="true" />}</button>
      <div className="brief-identity-text"><span>CHARACTER / 01</span><h2>{profile.name || '你的角色'}</h2>{!profile.image && <small>从一个名字开始</small>}</div>
      {profile.image && !editing && <button className="brief-edit-icon" aria-label="编辑背景故事" onClick={() => setExpanded(true)} disabled={disabled}><Pencil size={15} aria-hidden="true" /></button>}
    </div>
    {editing ? <div className="character-brief-form">
      <label>角色名字<input value={profile.name} maxLength={40} disabled={disabled} placeholder="TA 叫什么？" onChange={event => onChange({ name: event.target.value })} /></label>
      <label>背景故事<textarea value={profile.description} maxLength={600} rows={3} disabled={disabled} placeholder="经历、性格，或一个小小的愿望。" onChange={event => onChange({ description: event.target.value })} /></label>
      <div className="character-brief-count"><span>会参与音乐创作</span><span>{profile.description.length}/600</span></div>
      {profile.image ? <button className="character-brief-done" onClick={() => setExpanded(false)}><Check size={14} aria-hidden="true" />完成编辑</button> : <button className="brief-upload-next" onClick={onUpload} disabled={disabled}>上传参考图<ArrowUpRight size={15} aria-hidden="true" /></button>}
    </div> : <div className="brief-story-wrap"><p id={storyId} className={`character-brief-story${storyExpanded || !canExpandStory ? ' is-expanded' : ''}`}>{profile.description || '写下一点故事，让旋律更像 TA。'}</p>{canExpandStory && <button className="brief-story-toggle" aria-expanded={storyExpanded} aria-controls={storyId} onClick={() => setStoryExpanded(value => !value)}>{storyExpanded ? '收起故事' : '展开故事'}<ChevronDown size={12} aria-hidden="true" /></button>}</div>}
    {profile.image && <div className="brief-action-row"><button className="character-reanalyze" onClick={onReanalyze} disabled={disabled} aria-label="重新理解图像与故事"><Sparkles size={14} aria-hidden="true" />重新理解</button></div>}
  </section>;
}

export type AnalysisPhase = 'image' | 'story' | 'themes';
export function CharacterAnalysisProgress({ phase, onCancel }: { phase: AnalysisPhase; onCancel: () => void }) {
  const phases = [{ key: 'image', label: '读取图片' }, { key: 'story', label: '结合背景故事' }, { key: 'themes', label: '准备主题' }];
  const current = phases.findIndex(item => item.key === phase);
  return <div className="character-analysis-progress" role="status" aria-live="polite" aria-atomic="true">
    <div className="character-analysis-title"><span className="character-analysis-orbit" aria-hidden="true" /><span>{phases[current].label}…</span><button onClick={onCancel}>取消</button></div>
    <ol>{phases.map((item, i) => <li key={item.key} className={i < current ? 'is-done' : i === current ? 'is-current' : ''}>{i < current ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">0{i + 1}</span>}{item.label}</li>)}</ol>
  </div>;
}
