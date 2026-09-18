'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle, Music2, Sparkles, X } from 'lucide-react';
import type { SavedComposition } from '@/lib/ai-composition';

export function AIComposer({ providerLabel, available, busy, hasTheme, hasImage, composition, stale, mode, error, sceneName, onGenerate, onCancel, onMode, onRefresh }: {
  providerLabel: string; available: boolean | null; busy: boolean; hasTheme: boolean; hasImage: boolean;
  composition?: SavedComposition; stale: boolean; mode: 'rules' | 'ai'; error: string; sceneName: string;
  onGenerate: () => void; onCancel: () => void; onMode: (mode: 'rules' | 'ai') => void; onRefresh: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  return <section className="ai-composer" aria-label="AI 谱曲">
    <div className="ai-composer-heading"><div><span>GPT-6 ASTRA / COMPOSER</span><h3>让主题，有起承转合。</h3></div><Sparkles size={22} strokeWidth={1.4} aria-hidden="true" /></div>
    <p className="ai-composer-intro">结合{hasImage ? '角色图像、故事' : '角色背景故事'}与已选主题，为「{sceneName}」写一份十六小节、四轨纯音乐编曲。</p>
    <div className="ai-composer-mode" aria-label="编曲来源"><button aria-pressed={mode === 'rules'} disabled={busy} onClick={() => onMode('rules')}>规则草稿</button><button aria-pressed={mode === 'ai'} disabled={busy || !composition || stale} onClick={() => onMode('ai')}>AI 编曲{composition && !stale && <Check size={13} aria-hidden="true" />}</button></div>
    {composition && !stale ? <div className="ai-composer-result"><div><Music2 size={15} aria-hidden="true" /><strong>{composition.title}</strong><span>已保存乐谱</span></div><p>{composition.summary}</p><ol>{composition.sections.map((section, index) => <li key={section.startBeat}><span>0{index + 1}</span><b>{section.name}</b><small>{index * 4 + 1}–{index * 4 + 4} 小节</small></li>)}</ol></div> : <div className="ai-composer-outline" aria-label="建议段落结构"><span>引子</span><i aria-hidden="true" /><span>主题</span><i aria-hidden="true" /><span>变化</span><i aria-hidden="true" /><span>收尾</span></div>}
    {stale && <p className="ai-composer-help">角色或主题已变化，当前使用规则草稿。旧 AI 乐谱仍保存在工程中。</p>}
    {available === false && <p className="ai-composer-help">本地尚未配置{providerLabel || '当前服务'}的 API Key。配置后重启服务，再<button onClick={onRefresh}>检查配置</button>。</p>}
    {error && <p className="studio-error" role="alert">{error}</p>}
    <div className="ai-composer-footer">{busy ? <><span role="status"><LoaderCircle size={16} className="spin" aria-hidden="true" />正在谱曲 · {elapsed} 秒</span><button className="quiet-action" onClick={onCancel}><X size={14} aria-hidden="true" />取消</button></> : <><span>{!hasTheme ? '先采用一个角色主题。' : `${providerLabel || 'AI 服务'} · 点击生成消耗 API 额度`}</span><button className="outline-pill solid" disabled={!hasTheme || available !== true} onClick={onGenerate}>{composition ? '重新谱曲' : '生成 AI 编曲'}<ArrowUpRight size={16} aria-hidden="true" /></button></>}</div>
    {busy && <p className="ai-composer-help">正在生成音符与段落，通常需要等待一段时间。取消或失败不会覆盖当前作品。</p>}
  </section>;
}
