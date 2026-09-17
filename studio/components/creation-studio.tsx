'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, RefreshCw, Music2, Check, Headphones, AudioLines, LoaderCircle, Download, Upload, Save, ArrowRight, ArrowLeft, ArrowUpRight, Pencil, Disc3, Sun, Moon, Swords, Sparkles, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Player, renderStems, renderMix, encodeWav } from '@/lib/audio';
import { analyzePreview, matchPreview } from '@/lib/audio-match';
import { encodeMidi } from '@/lib/midi';
import { STORAGE_KEY, EXAMPLES, defaultSettings, parseLibrary, library, snapshot, download, safeFilename, type Draft, type Snapshot, type Settings } from '@/lib/project';
import '@/app/studio.css';
import { EditorialHeader, PageDial, RollingLabel } from './editorial-ui';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { registerMusicTools } from '@/lib/webmcp';
import { analyzeImageFile } from '@/lib/image-profile';
import { MUSIC_DIMENSIONS, MUSIC_DIMENSION_EFFECTS, MUSIC_PRESETS, MOODS, SCENES, VOICES, arrange, defaultMix, displayTime, generateThemes, musicProfileMeta, scoreSeconds, suggestedMood, themeScore, type ImageUnderstanding, type MusicProfile, type Profile, type Scene, type Theme, type Score, type Voice } from '@/lib/music';

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
  const storageAllowed = useRef(true), fileInput = useRef<HTMLInputElement | null>(null), imageInput = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null), [busy, setBusy] = useState(false), [position, setPosition] = useState(0), [error, setError] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [visionState, setVisionState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const player = useRef<Player | null>(null), request = useRef(0), cache = useRef(new Map<string, AudioBuffer>());
  const latestMix = useRef(mix);latestMix.current = mix;
  const musicMeta = useMemo(() => profile.music ? musicProfileMeta(profile.music, profile.mood) : null, [profile.music, profile.mood]);
  const [songMatches, setSongMatches] = useState<Array<{ id: string; title: string; artist: string; album?: string; genre?: string; year?: number; artwork?: string; url?: string; previewUrl?: string; provider: string; score: number; reasons: string[] }>>([]);
  const [providerLinks, setProviderLinks] = useState<Array<{ provider: string; url: string; query: string }>>([]);
  const [providerStatus, setProviderStatus] = useState<Array<{ provider: string; ok: boolean; error?: string }>>([]);
  const [songSearchState, setSongSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [songSearchMeta, setSongSearchMeta] = useState('');
  const [songSearchNonce, setSongSearchNonce] = useState(0);
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
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); }, [imagePreviewUrl]);
  useEffect(() => { player.current?.updateMix(mix); }, [mix]);
  useEffect(() => {
    if (!profile.music) { setSongMatches([]);setSongSearchState('idle');setSongSearchMeta('');return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSongSearchState('loading');
      try {
        const semantics = profile.image?.semantics?.map(tag => tag.label) ?? [];
        const language = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
        const country = language.toLowerCase().endsWith('-jp') ? 'JP' : language.toLowerCase().endsWith('-cn') ? 'CN' : language.toLowerCase().endsWith('-tw') ? 'TW' : 'US';
        const response = await fetch('/api/song-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ music: profile.music, semantics, country, direction: profile.direction, understanding: profile.image?.understanding }), signal: controller.signal });
        const data = await response.json() as { songs?: typeof songMatches; providers?: typeof providerLinks; status?: typeof providerStatus; queries?: string[]; error?: string };
        if (!response.ok) throw new Error(data.error || '联网歌曲搜索失败');
        const recalled = data.songs ?? [];
        setSongMatches(recalled);setProviderLinks(data.providers ?? []);setProviderStatus(data.status ?? []);setSongSearchMeta((data.queries ?? []).join(' / '));setSongSearchState('ready');
        // Second-stage ranking: candidates with public previews are scored from the audio itself,
        // not from the words used to recall them. This is deliberately separated from provider search rank.
        const target = profile.music;
        void Promise.all(recalled.slice(0, 5).map(async song => {
          if (!song.previewUrl) return;
          try {
            const features = await analyzePreview(song.previewUrl), audioScore = matchPreview(target, features);
            setSongMatches(prev => prev.map(item => item.id === song.id ? { ...item, score: Math.round(item.score * .25 + audioScore * .75), reasons: [`试听音频特征匹配 ${audioScore}%${features.bpm ? ` · 约 ${features.bpm} BPM` : ''}`, ...item.reasons.filter(reason => !reason.includes('搜索相关度')).slice(0, 2)] } : item).sort((a, b) => b.score - a.score));
          } catch { /* Some catalogs block preview CORS/geo access; semantic ranking remains available. */ }
        }));
      } catch (e) {
        if (controller.signal.aborted) return;
        setSongMatches([]);setProviderLinks([]);setProviderStatus([]);setSongSearchMeta(e instanceof Error ? e.message : '联网歌曲搜索失败');setSongSearchState('error');
      }
    }, 700);
    return () => { clearTimeout(timer);controller.abort(); };
  }, [profile.music, profile.direction, profile.image?.fingerprint, profile.image?.semantics, profile.image?.understanding, songSearchNonce]);
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
  function settingsForMusic(music: MusicProfile, mood: Profile['mood']): Settings {
    const meta = musicProfileMeta(music, mood), next = defaultSettings();
    next.daily.bpm = Math.max(55, Math.min(160, meta.bpm));
    next.memory.bpm = Math.max(48, Math.min(132, meta.bpm - 24));
    next.battle.bpm = Math.max(80, Math.min(190, meta.bpm + 30));
    return next;
  }
  function blendSemanticProfile(local: MusicProfile, understanding: ImageUnderstanding): MusicProfile {
    const target = understanding.target;
    const identityWeight = understanding.identity.type === 'character' || understanding.identity.type === 'meme' ? Math.min(.72, .42 + understanding.identity.confidence / 250) : .38;
    const blend = (key: keyof Omit<MusicProfile, 'hue'>) => Math.round(local[key] * (1 - identityWeight) + target[key] * identityWeight);
    return { energy: blend('energy'), warmth: blend('warmth'), tension: blend('tension'), mystery: blend('mystery'), brightness: blend('brightness'), elegance: blend('elegance'), aggression: blend('aggression'), hue: local.hue };
  }
  async function importImage(file?: File) {
    if (!file) return;
    setAnalyzingImage(true);setVisionState('idle');setError('');
    const objectUrl = URL.createObjectURL(file);setImagePreviewUrl(objectUrl);
    try {
      const analysis = await analyzeImageFile(file);
      if (theme && !preserve('更换参考图片前')) return;
      stop();
      const localProfile: Profile = { ...profile, direction: undefined, mood: analysis.mood, music: analysis.music, image: analysis.image };
      setProfile(localProfile);setTake(0);setCandidates(generateThemes(localProfile, 0));setTheme(null);setSettings(settingsForMusic(analysis.music, analysis.mood));setStage('theme');
      setNotice(`本地视觉分析完成 · ${analysis.image.fingerprint}。正在尝试高级语义识图…`);
      setVisionState('loading');
      const form = new FormData();const semanticBlob = await (await fetch(analysis.image.thumbnail)).blob();form.append('image', semanticBlob, 'analysis.webp');form.append('local', JSON.stringify({ visual: analysis.image.visual, segments: analysis.image.segments, semantics: analysis.image.semantics }));
      try {
        const response = await fetch('/api/image-understand', { method: 'POST', body: form });
        const data = await response.json() as { available?: boolean; analysis?: ImageUnderstanding; reason?: string; error?: string };
        if (data.available && data.analysis) {
          const semanticMusic = blendSemanticProfile(analysis.music, data.analysis), mood = suggestedMood(semanticMusic);
          const image = { ...analysis.image, understanding: data.analysis };
          const enriched: Profile = { ...localProfile, mood, music: semanticMusic, image };
          setProfile(enriched);setCandidates(generateThemes(enriched, 0));setSettings(settingsForMusic(semanticMusic, mood));setVisionState('ready');
          const identity = data.analysis.identity.name ? `识别：${data.analysis.identity.name}${data.analysis.identity.franchise ? ` · ${data.analysis.identity.franchise}` : ''}` : '已完成主体/背景语义分析';
          setNotice(`${identity}。Music Profile 已融合语义理解；联网找歌会优先使用角色/梗关联和试听音频重排。`);
        } else {
          setVisionState('fallback');setNotice(`本地视觉分析已完成。${data.reason || '高级识图未启用。'} 可继续使用，也可在 .env.local 配置 OPENAI_API_KEY。`);
        }
      } catch {
        setVisionState('fallback');setNotice('本地视觉分析已完成；高级语义识图暂时不可用。');
      }
    } catch (e) { setError(e instanceof Error ? e.message : '图片分析失败，请换一张图片重试。'); }
    finally { setAnalyzingImage(false); }
  }
  function updateMusicDimension(key: keyof Omit<MusicProfile, 'hue'>, value: number) {
    setProfile(prev => prev.music ? { ...prev, music: { ...prev.music, [key]: Math.max(0, Math.min(100, Math.round(value))) } } : prev);
  }
  function applyPreset(id: (typeof MUSIC_PRESETS)[number]['id']) {
    const preset = MUSIC_PRESETS.find(item => item.id === id); if (!preset) return;
    if (theme && !preserve(`切换到${preset.name}预设前`)) return;
    stop();
    const hue = profile.music?.hue ?? 180;
    const nextMusic: MusicProfile = { ...preset.music, hue };
    const nextProfile: Profile = { ...profile, direction: preset.id, mood: preset.mood, music: nextMusic };
    setProfile(nextProfile);setTake(0);setCandidates(generateThemes(nextProfile, 0));setTheme(null);setSettings(settingsForMusic(nextMusic, preset.mood));setStage('theme');
    setNotice(`已应用「${preset.name}」方向：图片仍保留，Music Profile 与联网搜歌关键词已切换。`);
  }
  function applyMusicProfile() {
    if (!profile.music) return;
    if (theme && !preserve('应用新 Music Profile 前')) return;
    stop();setTake(0);setCandidates(generateThemes(profile, 0));setTheme(null);setSettings(settingsForMusic(profile.music, profile.mood));setStage('theme');setNotice('Music Profile 已应用：主题候选与场景默认速度已重新生成。');
  }
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
      if (file.size > 6_000_000) throw new Error('工程文件不能超过 6 MB。');
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
    <input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { void importImage(e.target.files?.[0]);e.target.value = ''; }} />
    <main className="reference-workspace" aria-busy={!ready}>
      <aside className="workspace-left">
        <div><div className="small-index">OUR CADENCE / STUDIO</div><h1 className="workspace-title">{stageTitles[stageIndex]}<span>studio.</span></h1><p className="workspace-description">{stage === 'theme' ? '从三段旋律里，找到属于角色的声音。' : stage === 'scene' ? '同一个主题，在故事的不同片刻发生变化。' : '调整每一轨的声音，留下你喜欢的版本。'}</p>
          <div className="character-summary"><strong>{profile.name || '未命名角色'}</strong><p>{profile.description || '写下角色的故事，让旋律从这里开始。'}</p></div>
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogTrigger asChild><button className="outline-pill edit-character"><RollingLabel>编辑角色</RollingLabel><Pencil size={14} /></button></DialogTrigger><DialogContent className="editorial-dialog"><DialogHeader><DialogTitle>角色设定</DialogTitle><DialogDescription>音乐气质是高层偏好；上传图片后会额外生成可编辑的 Music Profile，并参与主题作曲。</DialogDescription></DialogHeader><div className="profile-form"><label className="editorial-field">角色名字<input value={profile.name} maxLength={40} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label className="editorial-field">角色设定<textarea rows={4} value={profile.description} maxLength={600} onChange={e => setProfile({ ...profile, description: e.target.value })} /></label><label className="editorial-field">音乐气质<Select value={profile.mood} onValueChange={mood => setProfile({ ...profile, mood: mood as Profile['mood'] })}><SelectTrigger aria-label="音乐气质" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MOODS).map(([id, mood]) => <SelectItem key={id} value={id}>{mood.name}</SelectItem>)}</SelectContent></Select></label><div className="example-choices"><span>示例角色</span>{EXAMPLES.map((example, index) => <Button variant="outline" key={example.name} onClick={() => { useExample(index);setStage('theme'); }} disabled={!ready || busy}>{example.name}</Button>)}</div><Button onClick={() => setProfileOpen(false)}>完成</Button></div></DialogContent></Dialog>
          <Link href="/" className="index-back"><ArrowLeft size={13} /><RollingLabel>BACK TO INDEX</RollingLabel></Link>
        </div>
        <div className="workspace-dial"><PageDial current={stageIndex + 1} previous={() => moveStage(-1)} next={() => moveStage(1)} previousDisabled={stageIndex === 0} nextDisabled={stageIndex === 2 || !theme} /><span>{stageNames[stageIndex]}</span></div>
      </aside>
      <section className="workspace-center" aria-label="音乐创作工作区">
        <Tabs value={stage} onValueChange={setStage} className="editorial-tabs"><TabsList className="editorial-stages" aria-label="创作步骤"><TabsTrigger value="theme"><span>01</span>主题</TabsTrigger><TabsTrigger value="scene" disabled={!theme}><span>02</span>场景</TabsTrigger><TabsTrigger value="mix" disabled={!theme}><span>03</span>调整与导出</TabsTrigger></TabsList>
          <TabsContent value="theme" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>找到那段旋律。</h2><p>四小节主题 / 三个提案</p></div><button className="quiet-action" onClick={generate} disabled={!ready || !profile.name.trim() || busy}><RefreshCw size={14} /><RollingLabel>换一组</RollingLabel></button></div>
            <section className={`music-profile-lab ${profile.music ? 'has-profile' : ''}`} aria-label="图片 Music Profile">
              <button className="profile-image-input" onClick={() => imageInput.current?.click()} disabled={analyzingImage || busy}>
                {(imagePreviewUrl || profile.image?.thumbnail) ? <img src={imagePreviewUrl || profile.image!.thumbnail} alt="当前参考图片" /> : <span className="profile-image-empty"><Upload size={20} /><b>上传任意图片</b><small>OC / 插画 / 摄影 / 场景</small></span>}
                {analyzingImage && <span className="profile-image-loading"><LoaderCircle className="spin" size={19} />分析中</span>}
              </button>
              <div className="profile-lab-body">
                <div className="profile-lab-heading"><div><span>IMAGE → MUSIC PROFILE</span><h3>{profile.music ? '已经读出一组音乐性格。' : '先让图片决定一个音乐起点。'}</h3><p>{profile.music ? (visionState === 'ready' ? '高级识图已经把主体、背景、角色/梗语境与视觉参数融合进 Music Profile。' : visionState === 'loading' ? '本地视觉分析已完成，正在识别主体、背景、角色/梗语境与常见配乐。' : '当前使用本地视觉分析；配置 OPENAI_API_KEY 后会自动启用角色/梗图语义识别与联网关联。') : '上传 OC、游戏角色、meme、摄影或场景图。系统会先本地拆分，再尝试高级语义识图。'}</p></div>{profile.image && <div className="profile-palette" aria-label="图片主色">{profile.image.palette.map(color => <i key={color} style={{ background: color }} title={color} />)}</div>}</div>
                {profile.music && musicMeta && <>
                  <details className="profile-collapsible preset-section"><summary><span><b>快速方向</b><small>{profile.direction ? `已选 · ${MUSIC_PRESETS.find(item => item.id === profile.direction)?.name}` : '角色主题 / 日常 / 战斗 / 机械 / 梦幻…'}</small></span><ArrowUpRight size={14} /></summary><div className="collapsible-body"><div className="preset-heading"><span>QUICK DIRECTIONS</span><strong>快速方向</strong><small>先选一个音乐方向，再微调下面的 Music Profile。</small></div><div className="preset-grid">{MUSIC_PRESETS.map(preset => <button key={preset.id} className={`preset-card ${profile.direction === preset.id ? 'is-active' : ''}`} onClick={() => applyPreset(preset.id)}><span>{preset.name}</span><small>{preset.description}</small></button>)}</div></div></details><div className="profile-meta-row"><span>{musicMeta.bpm} BPM</span><span>{musicMeta.scaleName}</span><span>{musicMeta.texture}</span><span>{musicMeta.rhythm}</span>{profile.direction && <span>预设 · {MUSIC_PRESETS.find(item => item.id === profile.direction)?.name}</span>}</div>
                  {!!profile.image?.semantics?.length && <div className="semantic-tag-row">{profile.image.semantics.slice(0, 6).map(tag => <small key={tag.label + tag.source}>{tag.label}<em>{tag.confidence}%</em></small>)}</div>}
                  <div className="music-profile-grid">{MUSIC_DIMENSIONS.map(dimension => <label className="music-dimension" key={dimension.key}><span><b>{dimension.name}</b><em>{dimension.low}</em><strong>{profile.music![dimension.key]}</strong><em>{dimension.high}</em></span><Slider aria-label={dimension.name} value={[profile.music![dimension.key]]} min={0} max={100} step={1} onValueChange={value => updateMusicDimension(dimension.key, value[0])} /><small className="dimension-impact"><b>影响：</b>{MUSIC_DIMENSION_EFFECTS[dimension.key].impacts.join(' / ')} · {MUSIC_DIMENSION_EFFECTS[dimension.key].hint}</small></label>)}</div>
                  {profile.image && <div className="visual-metrics"><span>全局视觉</span><small>亮度 {profile.image.visual.brightness}</small><small>饱和 {profile.image.visual.saturation}</small><small>对比 {profile.image.visual.contrast}</small><small>复杂度 {profile.image.visual.complexity}</small><small>色温 {profile.image.visual.warmth}</small></div>}
                  {profile.image?.segments && <div className="segment-grid"><article><span>SUBJECT</span><b>前景 / 主体</b><small>面积 {profile.image.segments.subject.size}% · 对比 {profile.image.segments.subject.contrast}</small><p>更强地影响能量、攻击性、旋律密度。</p></article><article><span>BACKGROUND</span><b>背景 / 场景</b>{profile.image.backgroundMode === 'transparent' ? <><small>透明背景 · 不参与夜景/环境判断</small><p>这张图没有实际背景，避免把透明区域错误识别成黑夜。</p></> : <><small>亮度 {profile.image.segments.background.brightness} · 复杂度 {profile.image.segments.background.complexity}</small><p>更强地影响神秘、明亮、和声氛围。</p></>}</article><article><span>PERSON</span><b>人物主体</b><small>角色置信 {profile.image.segments.person.likelihood}% · 中心突出 {profile.image.segments.person.prominence}%</small><p>更强地影响优雅、主题身份和人像感。</p></article></div>}
                  {profile.image?.understanding ? <div className="semantic-analysis"><div className="semantic-identity"><span>SEMANTIC VISION</span><b>{profile.image.understanding.identity.name || '未识别到确定实体'}</b><small>{profile.image.understanding.identity.franchise ? `${profile.image.understanding.identity.franchise} · ` : ''}{profile.image.understanding.identity.type} · {profile.image.understanding.identity.confidence}%</small><p>{profile.image.understanding.summary}</p></div><div className="semantic-split"><article><span>SUBJECT CONTENT</span><b>主体里有什么</b><p>{profile.image.understanding.subject.description || '—'}</p><div>{profile.image.understanding.subject.elements.map(item => <em key={item}>{item}</em>)}</div></article><article><span>BACKGROUND CONTENT</span><b>背景里有什么</b><p>{profile.image.understanding.background.description || (profile.image.backgroundMode === 'transparent' ? '透明背景，没有实际场景。' : '—')}</p><div>{[...profile.image.understanding.background.elements, ...profile.image.understanding.background.setting].slice(0, 8).map(item => <em key={item}>{item}</em>)}</div></article></div>{profile.image.understanding.memeContext && <p className="meme-context"><b>梗语境：</b>{profile.image.understanding.memeContext}</p>}{!!profile.image.understanding.musicAssociations.length && <div className="association-row"><span>常见关联配乐</span>{profile.image.understanding.musicAssociations.slice(0, 5).map(item => <small key={`${item.title}-${item.artist || ''}`}><b>{item.title}</b>{item.artist ? ` · ${item.artist}` : ''}<em>{item.confidence}%</em></small>)}</div>}</div> : visionState === 'fallback' ? <div className="vision-fallback">高级语义识图未启用：目前能拆视觉前景/背景，但不能可靠认出具体游戏角色或 meme。配置 <code>OPENAI_API_KEY</code> 后会自动启用。</div> : null}
                  {profile.music && <details className="song-match-panel profile-collapsible"><summary><span><b>联网音乐匹配</b><small>{songSearchState === 'loading' ? '正在召回候选并分析试听音频…' : songMatches.length ? `${songMatches.length} 个候选 · 有试听时按音频特征二次重排` : 'QQ音乐 / 网易云 / B站 / Apple / Deezer'}</small></span><ArrowUpRight size={14} /></summary><div className="collapsible-body song-match-content"><div className="song-match-heading"><span>ONLINE SONG SEARCH</span><strong>联网找真实存在的歌曲</strong><button className="song-retry" onClick={() => setSongSearchNonce(value => value + 1)} disabled={songSearchState === 'loading'}><RefreshCw size={12} />重新搜索</button><small>{songSearchState === 'loading' ? '正在同时搜索 QQ音乐 / 网易云 / B站 / Apple Music / Deezer…' : songSearchState === 'error' ? `搜索失败：${songSearchMeta}` : songSearchMeta || '会优先返回真实平台结果；某个平台接口受限时仍可直接打开对应搜索页。'}</small></div>{!!providerLinks.length && <div className="provider-links">{providerLinks.map(link => { const status = providerStatus.find(item => item.provider === link.provider);return <a key={link.provider} href={link.url} target="_blank" rel="noreferrer" className={status?.ok ? 'is-ok' : 'is-fallback'}><b>{link.provider}</b><small>{status?.ok ? '已返回结果' : '打开平台搜索'}</small><ArrowUpRight size={12} /></a>; })}</div>}{songSearchState === 'loading' ? <div className="song-search-loading"><LoaderCircle className="spin" size={15} />正在多平台搜索与重排</div> : !!songMatches.length ? <div className="song-match-list">{songMatches.slice(0, 6).map(match => <article key={match.id} className="song-match-card"><div className="song-card-top">{match.artwork && <img src={match.artwork} alt="" />}<div><span>{match.score}%</span><h4>{match.title}</h4><p>{match.artist}{match.year ? ` · ${match.year}` : ''}</p><small>{match.genre || match.album || 'Music'} · {match.provider}</small></div></div><ul>{match.reasons.slice(0, 2).map(reason => <li key={reason}>{reason}</li>)}</ul><div className="song-card-actions">{match.previewUrl && <audio controls preload="none" src={match.previewUrl} aria-label={`${match.title}试听`} />}{match.url && <a className="song-open-link" href={match.url} target="_blank" rel="noreferrer">打开 {match.provider}<ArrowUpRight size={13} /></a>}</div></article>)}</div> : songSearchState === 'ready' ? <div className="song-search-empty">结构化接口这次没拿到结果。上面的 QQ音乐、网易云、B站等按钮仍会带着当前关键词直接打开平台搜索。</div> : null}</div></details>}
                  <div className="profile-lab-actions"><button className="quiet-action" onClick={() => imageInput.current?.click()} disabled={analyzingImage || busy}><Upload size={14} />换图</button><button className="outline-pill solid" onClick={applyMusicProfile} disabled={busy}><Sparkles size={15} /><RollingLabel>应用并生成主题</RollingLabel></button></div>
                </>}
              </div>
            </section>
            <div className="editorial-themes">{candidates.map((candidate, index) => <article className={`editorial-theme ${theme?.id === candidate.id ? 'is-selected' : ''}`} key={candidate.id}><button className="round-audition" aria-label={`${playing === candidate.id ? '停止' : '试听'}主题${candidate.name}`} onClick={() => play(themeScore(candidate), candidate.id)} disabled={busy || !ready}>{playing === candidate.id ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><div className="theme-info"><span>THEME {String(index + 1).padStart(2, '0')}</span><h3>{candidate.name}</h3><small>4 小节 · {candidate.bpm ?? 100} BPM · {candidate.style === 'lyrical' ? '抒情动机' : candidate.style === 'driving' ? '推进动机' : candidate.style === 'atmospheric' ? '氛围动机' : '主题动机'}</small></div><div className="theme-contour" aria-hidden="true">{candidate.notes.slice(0, 14).map((n, i) => <i key={i} style={{ transform: `translateY(${(74 - n.pitch) * 1.5}px)`, width: `${n.duration * 8 + 3}px` }} />)}</div><button className="theme-adopt" onClick={() => choose(candidate)} disabled={!ready || busy || theme?.id === candidate.id} aria-label={`采用${candidate.name}`} aria-pressed={theme?.id === candidate.id}>{theme?.id === candidate.id ? <><Check size={16} /><span>已选定</span></> : <><span>采用</span><ArrowUpRight size={15} /></>}</button></article>)}</div>
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
      <aside className="workspace-right" aria-label="当前工程信息"><div className="project-fraction">0{stageIndex + 1}<span>/03</span></div><dl className="project-facts"><div><dt>CHARACTER</dt><dd>{profile.name || '未命名角色'}</dd></div><div><dt>THEME</dt><dd>{theme?.name || '尚未选定'}</dd></div><div><dt>SCENE</dt><dd>{SCENES[scene].name}</dd></div><div><dt>FORMAT</dt><dd>4 TRACKS / 16 BARS</dd></div></dl><p className="workspace-save" role="status">{saveState}</p><p className="workspace-footnote">{profile.music ? '图片 Music Profile / 规则作曲' : '规则作曲 / 本地合成音源'}</p></aside>
    </main>
    <footer className="editorial-player" aria-label="音乐播放器"><div className="player-now"><span>NOW PLAYING</span><strong>{currentTitle}<small>{auditionTheme ? '主题试听' : theme ? `${profile.name} / ${SCENES[scene].name}` : '请选择主题'}</small></strong></div><div className="player-center"><button className="round-audition player-toggle" onClick={() => busy || playing ? stop() : score && play(score, 'arrangement')} disabled={!ready || (!theme && !playing && !busy)} aria-label={busy ? '取消准备声音' : playing ? '停止当前音乐' : '播放当前编曲'}>{busy ? <LoaderCircle className="spin" size={18} /> : playing ? <Square size={15} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span className="elapsed-time">{displayTime(position)}</span><div className="editorial-progress" role="progressbar" aria-label="播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={duration ? Math.round(Math.min(100, position / duration * 100)) : 0}><i style={{ width: `${duration ? Math.min(100, position / duration * 100) : 0}%` }} /></div><span className="total-time">{displayTime(duration)}</span></div><div className="player-format"><span>{auditionTheme?.bpm ?? (auditionTheme ? 100 : bpm)} BPM</span><span>{loop ? 'LOOP ON' : '4/4 TIME'}</span></div></footer>
  </div>;
}
