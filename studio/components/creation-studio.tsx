'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, RefreshCw, Music2, Check, Headphones, AudioLines, LoaderCircle, Download, Upload, Save, ArrowRight, ArrowLeft, ArrowUpRight, Pencil, Disc3, Sun, Moon, Swords, Sparkles, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Player, renderStems, renderMix, encodeWav } from '@/lib/audio';
import { encodeMidi } from '@/lib/midi';
import { STORAGE_KEY, EXAMPLES, defaultSettings, parseLibrary, library, snapshot, download, safeFilename, type Draft, type Snapshot, type Settings } from '@/lib/project';
import '@/app/studio.css';
import { EditorialHeader, PageDial, RollingLabel } from './editorial-ui';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { registerMusicTools } from '@/lib/webmcp';
import { MOODS, SCENES, VOICES, arrange, defaultMix, displayTime, generateThemes, scoreSeconds, themeScore, type Profile, type Scene, type Theme, type Score, type Voice } from '@/lib/music';

const initialProfile: Profile = { name: '澄', description: '安静、好奇的旅行者。喜欢收集旅途的声音，随身带着一本写不完的手记。', mood: 'bright' };
export default function Home() {
  const [stage, setStage] = useState('theme');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile), [take, setTake] = useState(0);
  const [candidates, setCandidates] = useState(() => generateThemes(initialProfile, 0));
  const [theme, setTheme] = useState<Theme | null>(null);
  const [scene, setScene] = useState<Scene>('daily'), [settings, setSettings] = useState(defaultSettings);
  const { bpm, voice, mix } = settings[scene];
  const setBpm = (bpm: number) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], bpm } }));
  const setVoice = (voice: Voice) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], voice: voice as Settings[Scene]['voice'] } }));
  const setMix = (mix: Settings[Scene]['mix']) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], mix } }));
  const [loop, setLoop] = useState(false), [versions, setVersions] = useState<Snapshot[]>([]);
  const [ready, setReady] = useState(false), [saveState, setSaveState] = useState('正在读取本地草稿…');
  const [notice, setNotice] = useState(''), [exporting, setExporting] = useState(false);
  const storageAllowed = useRef(true), fileInput = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null), [busy, setBusy] = useState(false), [position, setPosition] = useState(0), [error, setError] = useState('');
  const player = useRef<Player | null>(null), request = useRef(0), cache = useRef(new Map<string, AudioBuffer>());
  const latestMix = useRef(mix);latestMix.current = mix;
  const score = useMemo(() => theme ? arrange(theme, scene, bpm, voice) : null, [theme, scene, bpm, voice]);
  const draft = useMemo<Draft>(() => ({ profile, take, candidates, theme, scene, settings, loop }), [profile, take, candidates, theme, scene, settings, loop]);
  function restore(next: Draft) { stop();setProfile(next.profile);setTake(next.take);setCandidates(next.candidates);setTheme(next.theme);setScene(next.scene);setSettings(next.settings);setLoop(next.loop); }
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY);if (raw) { const stored = parseLibrary(raw);restore(stored.draft);setVersions(stored.versions); } }
    catch { storageAllowed.current = false;setSaveState('自动保存暂停：旧存档无法读取，原数据未改写。请导出工程保留当前创作。'); }
    setReady(true);
    // Mount-only hydration restores actual saved notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready || !storageAllowed.current) return;
    setSaveState('正在保存草稿…');
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library(draft, versions)));setSaveState('草稿已保存在当前浏览器'); } catch { setSaveState('本地保存失败，请导出工程备份。'); } }, 300);
    return () => clearTimeout(timer);
  }, [draft, versions, ready]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => { if (storageAllowed.current) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library(draft, versions))); } catch { /* Normal autosave reports failures visibly. */ } };
    window.addEventListener('pagehide', flush);return () => window.removeEventListener('pagehide', flush);
  }, [draft, versions, ready]);
  useEffect(() => { const audio = new Player();player.current = audio;return () => { request.current++;void audio.dispose(); }; }, []);
  useEffect(() => { player.current?.updateMix(mix); }, [mix]);
  useEffect(() => { if (!playing) return;const timer = setInterval(() => setPosition(player.current?.position() ?? 0), 80);return () => clearInterval(timer); }, [playing]);
  function stop() { request.current++;player.current?.stop();setPlaying(null);setBusy(false);setPosition(0); }
  async function stems(forScore: Score) {
    const key = JSON.stringify(forScore);let buffer = cache.current.get(key);
    if (!buffer) { buffer = await renderStems(forScore);if (cache.current.size >= 2) cache.current.delete(cache.current.keys().next().value!);cache.current.set(key, buffer); }return buffer;
  }
  async function play(forScore: Score, id: string) {
    if (playing === id) { stop();return; }stop();const token = request.current;setBusy(true);setError('');
    try { await player.current!.unlock();const buffer = await stems(forScore);if (token !== request.current) return;await player.current!.play(buffer, id === 'arrangement' ? latestMix.current : defaultMix(), scoreSeconds(forScore), id === 'arrangement' && loop, () => { setPlaying(null);setPosition(0); });if (token === request.current) setPlaying(id); }
    catch (e) { if (token === request.current) setError(e instanceof Error ? e.message : '音频启动失败，请重试。'); }
    finally { if (token === request.current) setBusy(false); }
  }
  function generate() { stop();const next = take + 1;setTake(next);setCandidates(generateThemes(profile, next)); }
  function changeScene(next: Scene) { stop();setScene(next); }
  function preserve(reason: string): boolean {
    if (versions.length >= 40) { setError('已保存 40 个版本。请先导出工程备份；本轮不会自动删除旧版本。');return false; }
    setVersions(prev => [snapshot(draft, reason), ...prev]);return true;
  }
  function choose(next: Theme) { if (theme && !preserve('切换主题前')) return;stop();setTheme(next);setNotice(theme ? '旧主题与编曲已保留到版本记录。' : '主题已选定，试试三种场景。'); }
  function useExample(index: number) { if (!preserve('切换角色前')) return;const p = EXAMPLES[index];restore({ profile: p, take: 0, candidates: generateThemes(p, 0), theme: null, scene: 'daily', settings: defaultSettings(), loop: false });setNotice('已载入示例角色，原草稿已保留到版本记录。'); }
  function saveVersion() { if (preserve('手动保存')) setNotice('已创建不可变版本，可从版本记录重新打开。'); }
  function openVersion(id: string) { const saved = versions.find(v => v.id === id);if (saved && preserve('恢复版本前')) { restore(structuredClone(saved.draft));setNotice('已恢复保存的实际音符与参数，没有重新生成。'); } }
  function exportProject() { download(JSON.stringify(library(draft, versions), null, 2), 'application/json', `${safeFilename(profile.name)}-OurCadence.json`);setNotice('工程备份已准备，包含草稿、主题音符和保存的版本。'); }
  async function importProject(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('工程文件不能超过 2 MB。');
      const imported = parseLibrary(await file.text());
      const all = [snapshot(draft, '导入前'), ...imported.versions, ...versions];
      const unique = [...new Map(all.map(v => [v.id, v])).values()];
      if (unique.length > 40) throw new Error('导入后版本超过 40 个，未修改当前工程。');
      restore(imported.draft);setVersions(unique);setError('');setNotice('工程已导入，原草稿保存在“导入前”版本中。');
    } catch (e) { setError(e instanceof Error ? e.message : '导入失败，原工程未变更。'); }
  }
  async function exportAudio(kind: 'midi' | 'wav') {
    if (!score) return;setExporting(true);setError('');
    const exportScore = score, exportMix = structuredClone(mix), filename = `${safeFilename(profile.name)}-${SCENES[scene].name}-${bpm}BPM`;
    try {
      if (kind === 'midi') download(encodeMidi(exportScore, exportMix), 'audio/midi', filename + '.mid');
      else {
        const source = await stems(exportScore), buffer = await renderMix(source, exportMix);
        const bytes = encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], buffer.sampleRate);
        download(bytes, 'audio/wav', filename + '.wav');
        const measurements = Array.from({ length: source.numberOfChannels }, (_, channel) => { const data = source.getChannelData(channel);let power = 0;for (const sample of data) power += sample * sample;return Math.sqrt(power / data.length); });
        let peak = 0;for (let ch = 0; ch < buffer.numberOfChannels; ch++) for (const sample of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(sample));
        setNotice('WAV 已准备，使用点击导出时的编曲与混音。');
        return { filename: filename + '.wav', bytes: bytes.length, seconds: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, stemRms: measurements, peak };
      }
      setNotice(`${kind.toUpperCase()} 已准备，使用点击导出时的编曲与混音。`);
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败，请重试。'); }
    finally { setExporting(false); }
  }
  const actions = useRef({ read: () => ({} as unknown), configure: async (_input: unknown): Promise<unknown> => ({}), play: async (): Promise<unknown> => ({}), exportWav: async (): Promise<unknown> => ({}), stop: () => ({} as unknown) });
  actions.current = {
    read: () => ({ ready, character: profile.name, themes: candidates.map(t => ({ id: t.id, name: t.name })), themeId: theme?.id ?? null, scene, bpm, voice, playing, busy, savedVersions: versions.length, error }),
    configure: async input => {
      if (!ready || busy) throw new Error('The workspace is not ready.');
      if (!input || typeof input !== 'object') throw new Error('Expected a themeId and scene.');
      const value = input as Record<string, unknown>;
      if (Object.keys(value).some(k => !['themeId', 'scene'].includes(k)) || typeof value.themeId !== 'string' || typeof value.scene !== 'string' || !Object.hasOwn(SCENES, value.scene)) throw new Error('Invalid themeId or scene.');
      const candidate = candidates.find(t => t.id === value.themeId);if (!candidate) throw new Error('Unknown theme candidate.');
      if (theme?.id !== candidate.id) { if (theme && versions.length >= 40) throw new Error('Revision limit reached.');choose(candidate); }
      changeScene(value.scene as Scene);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));return actions.current.read();
    },
    play: async () => {
      if (!score || busy) throw new Error('Choose a theme before playback.');
      await play(score, 'arrangement');await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const state = actions.current.read() as { error: string; playing: string | null };
      if (state.error || state.playing !== 'arrangement') throw new Error(state.error || 'Playback did not start.');
      const buffer = await stems(score), mixed = await renderMix(buffer, latestMix.current);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => { const data = buffer.getChannelData(channel);let power = 0, peak = 0;for (let i = 0; i < data.length; i++) { power += data[i] * data[i];peak = Math.max(peak, Math.abs(data[i])); }return { rms: Math.sqrt(power / data.length), peak }; });
      let peak = 0;for (let ch = 0; ch < mixed.numberOfChannels; ch++) for (const sample of mixed.getChannelData(ch)) peak = Math.max(peak, Math.abs(sample));
      return { started: true, seconds: scoreSeconds(score), renderedSeconds: buffer.duration, stems: channels, wavSampleRate: mixed.sampleRate, mixedPeak: peak };
    },
    exportWav: async () => { if (!score || exporting) throw new Error('Select a theme and wait for any active export.');const result = await exportAudio('wav');if (!result) throw new Error('Audio export failed.');return result; },
    stop: () => { stop();return { stopped: true }; },
  };
  useEffect(() => registerMusicTools({ read: () => actions.current.read(), configure: input => actions.current.configure(input), play: () => actions.current.play(), exportWav: () => actions.current.exportWav(), stop: () => actions.current.stop() }), []);
  const auditionTheme = candidates.find(candidate => candidate.id === playing);
  const duration = auditionTheme ? scoreSeconds(themeScore(auditionTheme)) : score ? scoreSeconds(score) : 0;
  const currentTitle = auditionTheme?.name ?? theme?.name ?? '选择一段旋律';
  const stages = ['theme', 'scene', 'mix'];
  const stageIndex = stages.indexOf(stage);
  const stageNames = ['选择主题', '场景编曲', '调整与导出'];
  const stageTitles = ['Theme', 'Scene', 'Sound'];
  const moveStage = (direction: number) => {
    const target = Math.max(0, Math.min(2, stageIndex + direction));
    if (!theme && target > 0) return;
    setStage(stages[target]);
  };
  return <div className="reference-studio">
    <EditorialHeader studio>
      <Dialog><DialogTrigger asChild><button className="archive-entry"><RollingLabel>ARCHIVE</RollingLabel><span className="sr-only">作品与版本</span></button></DialogTrigger><DialogContent className="editorial-dialog"><DialogHeader><DialogTitle>作品与版本</DialogTitle><DialogDescription>保存每一次选择。导出工程可用于备份或迁移到其他浏览器。</DialogDescription></DialogHeader><p className="storage-status" role="status">{saveState}</p><div className="archive-actions"><Button onClick={saveVersion} disabled={!ready}><Save />保存当前版本</Button><Button variant="outline" onClick={exportProject} disabled={!ready}><Download />备份工程</Button><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!ready}><Upload />导入工程</Button></div><label className="editorial-field">打开保存的版本<Select value="" onValueChange={id => { openVersion(id);setStage('theme'); }} disabled={!versions.length}><SelectTrigger aria-label="打开保存的版本" className="w-full"><SelectValue placeholder={versions.length ? `选择版本（${versions.length}）` : '暂时没有保存的版本'} /></SelectTrigger><SelectContent>{versions.map(v => <SelectItem key={v.id} value={v.id}>{v.label} · {new Date(v.savedAt).toLocaleString('zh-CN')}</SelectItem>)}</SelectContent></Select></label><p className="editorial-help">存档仅在当前浏览器。清理浏览器数据会删除本地记录，请定期导出工程备份。</p><p className="studio-notice" role="status">{notice}</p>{error && <p className="studio-error" role="alert">{error}</p>}</DialogContent></Dialog>
    </EditorialHeader>
    <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e => { void importProject(e.target.files?.[0]);e.target.value = ''; }} />
    <main className="reference-workspace" aria-busy={!ready}>
      <aside className="workspace-left">
        <div><div className="small-index">OUR CADENCE / STUDIO</div><h1 className="workspace-title">{stageTitles[stageIndex]}<span>studio.</span></h1><p className="workspace-description">{stage === 'theme' ? '从三段旋律里，找到属于角色的声音。' : stage === 'scene' ? '同一个主题，在故事的不同片刻发生变化。' : '调整每一轨的声音，留下你喜欢的版本。'}</p>
          <div className="character-summary"><strong>{profile.name || '未命名角色'}</strong><p>{profile.description || '写下角色的故事，让旋律从这里开始。'}</p></div>
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><button className="outline-pill edit-character"><RollingLabel>编辑角色</RollingLabel><Pencil size={14} /></button></DialogTrigger><DialogContent className="editorial-dialog"><DialogHeader><DialogTitle>角色设定</DialogTitle><DialogDescription>音乐气质决定调式；名字和文本作为生成种子，尚未接入 AI 语义理解。</DialogDescription></DialogHeader><div className="profile-form"><label className="editorial-field">角色名字<input value={profile.name} maxLength={40} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label className="editorial-field">角色设定<textarea rows={4} value={profile.description} maxLength={600} onChange={e => setProfile({ ...profile, description: e.target.value })} /></label><label className="editorial-field">音乐气质<Select value={profile.mood} onValueChange={mood => setProfile({ ...profile, mood: mood as Profile['mood'] })}><SelectTrigger aria-label="音乐气质" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MOODS).map(([id, mood]) => <SelectItem key={id} value={id}>{mood.name}</SelectItem>)}</SelectContent></Select></label><div className="example-choices"><span>示例角色</span>{EXAMPLES.map((example, index) => <Button variant="outline" key={example.name} onClick={() => { useExample(index);setStage('theme'); }} disabled={!ready || busy}>{example.name}</Button>)}</div><Button onClick={() => setProfileOpen(false)}>完成</Button></div></DialogContent></Dialog>
          <Link href="/" className="index-back"><ArrowLeft size={13} /><RollingLabel>BACK TO INDEX</RollingLabel></Link>
        </div>
        <div className="workspace-dial"><PageDial current={stageIndex + 1} previous={() => moveStage(-1)} next={() => moveStage(1)} previousDisabled={stageIndex === 0} nextDisabled={stageIndex === 2 || !theme} /><span>{stageNames[stageIndex]}</span></div>
      </aside>
      <section className="workspace-center" aria-label="音乐创作工作区">
        <Tabs value={stage} onValueChange={setStage} className="editorial-tabs"><TabsList className="editorial-stages" aria-label="创作步骤"><TabsTrigger value="theme"><span>01</span>主题</TabsTrigger><TabsTrigger value="scene" disabled={!theme}><span>02</span>场景</TabsTrigger><TabsTrigger value="mix" disabled={!theme}><span>03</span>调整与导出</TabsTrigger></TabsList>
          <TabsContent value="theme" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>找到那段旋律。</h2><p>四小节主题 / 三个提案</p></div><button className="quiet-action" onClick={generate} disabled={!ready || !profile.name.trim() || busy}><RefreshCw size={14} /><RollingLabel>换一组</RollingLabel></button></div>
            <div className="editorial-themes">{candidates.map((candidate, index) => <article className={`editorial-theme ${theme?.id === candidate.id ? 'is-selected' : ''}`} key={candidate.id}><button className="round-audition" aria-label={`${playing === candidate.id ? '停止' : '试听'}主题${candidate.name}`} onClick={() => play(themeScore(candidate), candidate.id)} disabled={busy || !ready}>{playing === candidate.id ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><div className="theme-info"><span>THEME {String(index + 1).padStart(2, '0')}</span><h3>{candidate.name}</h3><small>4 小节 · 100 BPM</small></div><div className="theme-contour" aria-hidden="true">{candidate.notes.slice(0, 14).map((n, i) => <i key={i} style={{ transform: `translateY(${(74 - n.pitch) * 1.5}px)`, width: `${n.duration * 8 + 3}px` }} />)}</div><button className="theme-adopt" onClick={() => choose(candidate)} disabled={!ready || busy || theme?.id === candidate.id} aria-label={`采用${candidate.name}`} aria-pressed={theme?.id === candidate.id}>{theme?.id === candidate.id ? <><Check size={16} /><span>已选定</span></> : <><span>采用</span><ArrowUpRight size={15} /></>}</button></article>)}</div>
            <div className="center-next"><p>{theme ? `当前主题：${theme.name}` : '先试听，再做选择。'}</p><button className="outline-pill" disabled={!theme} onClick={() => setStage('scene')}><RollingLabel>场景编曲</RollingLabel><ArrowUpRight size={16} /></button></div>
          </TabsContent>
          <TabsContent value="scene" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>让故事继续发生。</h2><p>主题音符不变，配器与伴奏随场景变化。</p></div></div>
            <div className="scene-options">{(Object.keys(SCENES) as Scene[]).map((id, index) => <button key={id} className={`editorial-scene ${scene === id ? 'is-selected' : ''}`} aria-pressed={scene === id} onClick={() => changeScene(id)}><span className="scene-number">0{index + 1}</span><span className="scene-word">{['Everyday', 'Memory', 'Battle'][index]}</span><span className="scene-chinese">{SCENES[id].name} / {settings[id].bpm} BPM</span><span className="scene-detail">{SCENES[id].description}</span><span className="scene-check">{scene === id ? <Check size={20} /> : <ArrowUpRight size={20} />}</span></button>)}</div>
            <div className="scene-audition"><span>{theme?.name} · {SCENES[scene].name}<small>4 轨 / 16 小节 / {score ? displayTime(scoreSeconds(score)) : '00:00'}</small></span><button className="round-audition" onClick={() => score && play(score, 'arrangement')} disabled={busy} aria-label="试听当前场景">{playing === 'arrangement' ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button></div>
            <div className="center-next"><p>三种场景分别记住你的调整。</p><button className="outline-pill" onClick={() => setStage('mix')}><RollingLabel>调整与导出</RollingLabel><ArrowUpRight size={16} /></button></div>
          </TabsContent>
          <TabsContent value="mix" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>最后一点，留给你。</h2><p>{theme?.name} / {SCENES[scene].name} / 四轨编曲</p></div></div>
            <div className="mix-settings"><label className="tempo-field">速度 BPM<input aria-label="速度 BPM" type="number" min={40} max={200} value={bpm} onChange={e => { stop();setBpm(Math.max(40, Math.min(200, Number(e.target.value) || 100))); }} /></label><label className="voice-field">旋律音色<Select value={voice} onValueChange={v => { stop();setVoice(v as Voice); }}><SelectTrigger aria-label="旋律音色"><SelectValue /></SelectTrigger><SelectContent>{(['keys', 'bell', 'pluck', 'pad'] as Voice[]).map(v => <SelectItem key={v} value={v}>{VOICES[v]}</SelectItem>)}</SelectContent></Select></label></div>
            <div className="editorial-tracks">{score?.tracks.map((track, index) => <div className={`editorial-track ${mix[index].mute || (mix.some(m => m.solo) && !mix[index].solo) ? 'is-muted' : ''}`} key={track.id}><div className="track-heading"><span className="track-number">0{index + 1}</span><strong>{track.name}</strong><small>{VOICES[track.voice]}</small></div><div className="track-body"><div className="editorial-note-grid" aria-label={`${track.name}音符预览`}>{track.notes.map((n, i) => <i key={i} style={{ left: `${n.beat / 64 * 100}%`, width: `${Math.max(.4, n.duration / 64 * 100)}%`, top: `${8 + n.pitch % 12 * 2}px` }} />)}{playing === 'arrangement' && <span className="editorial-playhead" style={{ left: `${Math.min(100, position / scoreSeconds(score) * 100)}%` }} />}</div><div className="track-mix"><button aria-label={`静音${track.name}`} aria-pressed={mix[index].mute} onClick={() => setMix(mix.map((m, i) => i === index ? { ...m, mute: !m.mute } : m))}>M</button><button aria-label={`独奏${track.name}`} aria-pressed={mix[index].solo} onClick={() => setMix(mix.map((m, i) => i === index ? { ...m, solo: !m.solo } : m))}>S</button><Slider className="editorial-volume" aria-label={`${track.name}音量`} value={[mix[index].volume * 100]} onValueChange={v => setMix(mix.map((m, i) => i === index ? { ...m, volume: v[0] / 100 } : m))} min={0} max={100} step={1} /></div></div></div>)}</div>
            <div className="mix-bottom"><label><Switch aria-label="循环播放" checked={loop} onCheckedChange={v => { stop();setLoop(v); }} />循环播放</label><span>M 静音 / S 独奏</span></div>
            <div className="studio-export"><button className="quiet-action" onClick={saveVersion}><Save size={15} />保存版本</button><button className="outline-pill" onClick={() => exportAudio('midi')} disabled={busy || exporting}>MIDI<Download size={15} /></button><button className="outline-pill solid" onClick={() => exportAudio('wav')} disabled={busy || exporting}>{exporting ? <LoaderCircle className="spin" size={16} /> : <RollingLabel>导出 WAV</RollingLabel>}<ArrowUpRight size={16} /></button></div><p className="editorial-help">音符网格仅供查看。WAV 使用当前混音，MIDI 音色由播放器决定。</p>
          </TabsContent>
        </Tabs>
        {busy && <div className="studio-preparing" role="status"><LoaderCircle className="spin" size={16} />准备声音中<button className="quiet-action" onClick={stop}>取消</button></div>}{error && <p className="studio-error" role="alert">{error}</p>}<p className="studio-notice" role="status">{notice}</p>
      </section>
      <aside className="workspace-right" aria-label="当前工程信息"><div className="project-fraction">0{stageIndex + 1}<span>/03</span></div><dl className="project-facts"><div><dt>CHARACTER</dt><dd>{profile.name || '未命名角色'}</dd></div><div><dt>THEME</dt><dd>{theme?.name || '尚未选定'}</dd></div><div><dt>SCENE</dt><dd>{SCENES[scene].name}</dd></div><div><dt>FORMAT</dt><dd>4 TRACKS / 16 BARS</dd></div></dl><p className="workspace-save" role="status">{saveState}</p><p className="workspace-footnote">规则作曲 / 本地合成音源</p></aside>
    </main>
    <footer className="editorial-player" aria-label="音乐播放器"><div className="player-now"><span>NOW PLAYING</span><strong>{currentTitle}<small>{auditionTheme ? '主题试听' : theme ? `${profile.name} / ${SCENES[scene].name}` : '请选择主题'}</small></strong></div><div className="player-center"><button className="round-audition player-toggle" onClick={() => busy || playing ? stop() : score && play(score, 'arrangement')} disabled={!ready || (!theme && !playing && !busy)} aria-label={busy ? '取消准备声音' : playing ? '停止当前音乐' : '播放当前编曲'}>{busy ? <LoaderCircle className="spin" size={18} /> : playing ? <Square size={15} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span className="elapsed-time">{displayTime(position)}</span><div className="editorial-progress" role="progressbar" aria-label="播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={duration ? Math.round(Math.min(100, position / duration * 100)) : 0}><i style={{ width: `${duration ? Math.min(100, position / duration * 100) : 0}%` }} /></div><span className="total-time">{displayTime(duration)}</span></div><div className="player-format"><span>{auditionTheme ? 100 : bpm} BPM</span><span>{loop ? 'LOOP ON' : '4/4 TIME'}</span></div></footer>
  </div>;
}
