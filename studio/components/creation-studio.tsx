'use client';
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from 'react';
import { Play, Square, RefreshCw, Music2, Check, Headphones, AudioLines, LoaderCircle, Download, Upload, Save, ArrowRight, ArrowLeft, ArrowUpRight, Pencil, Disc3, Sun, Moon, Swords, Sparkles, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Player, renderStems, renderMix, encodeWav } from '@/lib/audio';
import { encodeMidi } from '@/lib/midi';
import { AIComposer } from './ai-composer';
import { compositionKey, compositionScore, savedCompositionSchema, type AIScores } from '@/lib/ai-composition';
import { mixForPlayback, readMasterVolume } from '@/lib/playback-settings';
import { STORAGE_KEY, defaultSettings, parseLibrary, library, snapshot, download, safeFilename, type Draft, type Snapshot, type Settings } from '@/lib/project';
import '@/app/studio.css';
import { EditorialHeader, PageDial, RollingLabel } from './editorial-ui';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { registerMusicTools } from '@/lib/webmcp';
import { analyzeImageFile } from '@/lib/image-profile';
import { studioMist } from '@/lib/studio-palette';
import { ThemeProposals } from './theme-proposals';
import { StudioMixer } from './studio-mixer';
import { themeProfileKey } from '@/lib/theme-character';
import { StudioProfile } from './studio-profile';
import { CharacterBrief, CharacterAnalysisProgress, type AnalysisPhase } from './character-brief';
import { musicWithStory } from '@/lib/character-story';
import { SCENES, VOICES, MELODY_VOICES, arrange, defaultMix, displayTime, generateThemes, musicProfileMeta, scoreSeconds, suggestedMood, themeScore, type ImageUnderstanding, type MusicProfile, type Profile, type Scene, type Theme, type Score, type Voice } from '@/lib/music';

const initialProfile: Profile = { name: '', description: '', mood: 'bright' };
export default function Home() {
  const [stage, setStage] = useState('theme');
  const [profile, setProfile] = useState(initialProfile), [take, setTake] = useState(0);
  const backdropStyle = useMemo(() => studioMist(profile.image?.palette) as CSSProperties, [profile.image?.palette]);
  const [candidates, setCandidates] = useState(() => generateThemes(initialProfile, 0));
  const needsGeneration = !!profile.music && candidates.some(candidate => candidate.sourceKey !== themeProfileKey(profile));
  const [theme, setTheme] = useState<Theme | null>(null);
  const [aiScores, setAiScores] = useState<AIScores>({});
  const [arrangementMode, setArrangementMode] = useState<'rules' | 'ai'>('rules');
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState('');
  const [aiProviderLabel, setAiProviderLabel] = useState('');
  const aiRequest = useRef(0), aiController = useRef<AbortController | null>(null);
  const [masterReady, setMasterReady] = useState(false);
  const [scene, setScene] = useState<Scene>('daily'), [settings, setSettings] = useState(defaultSettings);
  const { bpm, voice, mix } = settings[scene];
  const setBpm = (bpm: number) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], bpm } }));
  const setVoice = (voice: Voice) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], voice: voice as Settings[Scene]['voice'] } }));
  const setMix = (mix: Settings[Scene]['mix']) => setSettings(prev => ({ ...prev, [scene]: { ...prev[scene], mix } }));
  const [loop, setLoop] = useState(false), [versions, setVersions] = useState<Snapshot[]>([]);
  const [masterVolume, setMasterVolume] = useState(1);
  const [ready, setReady] = useState(false), [saveState, setSaveState] = useState('正在读取本地草稿…');
  const [notice, setNotice] = useState(''), [exporting, setExporting] = useState(false);
  const storageAllowed = useRef(true), fileInput = useRef<HTMLInputElement | null>(null), imageInput = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null), [busy, setBusy] = useState(false), [position, setPosition] = useState(0), [error, setError] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase | null>(null);
  const analysisRequest = useRef(0), analysisController = useRef<AbortController | null>(null);
  const [visionState, setVisionState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const player = useRef<Player | null>(null), request = useRef(0), cache = useRef(new Map<string, AudioBuffer>());
  const activePlayId = useRef<string | null>(null);
  const latestMix = useRef(mix);latestMix.current = mix;
  const latestMasterVolume = useRef(masterVolume);latestMasterVolume.current = masterVolume;
  const aiInputKey = theme ? compositionKey(profile, theme, scene) : null;
  const latestAIKey = useRef(aiInputKey);latestAIKey.current = aiInputKey;
  const savedAI = aiScores[scene];
  const aiStale = !!savedAI && savedAI.sourceKey !== aiInputKey;
  const usingAI = arrangementMode === 'ai' && !!savedAI && !aiStale;
  const score = useMemo(() => usingAI && savedAI ? compositionScore(savedAI, bpm, voice) : theme ? arrange(theme, scene, bpm, voice) : null, [usingAI, savedAI, theme, scene, bpm, voice]);
  const draft = useMemo<Draft>(() => ({ profile, take, candidates, theme, scene, settings, loop, ...(Object.keys(aiScores).length ? { aiScores, arrangementMode } : {}) }), [profile, take, candidates, theme, scene, settings, loop, aiScores, arrangementMode]);
  const latestLibrary = useRef({ draft, versions });latestLibrary.current = { draft, versions };
  function restore(next: Draft) { cancelComposer();setAiScores(next.aiScores ?? {});setArrangementMode(next.arrangementMode ?? 'rules'); analysisRequest.current++;analysisController.current?.abort();setAnalyzingImage(false);setAnalysisPhase(null);stop();setImagePreviewUrl('');setVisionState(next.profile.image?.understanding ? 'ready' : 'idle');setProfile(next.profile);setTake(next.take);setCandidates(next.candidates);setTheme(next.theme);setScene(next.scene);setSettings(next.settings);setLoop(next.loop); }
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
  useEffect(() => {
    try { setMasterVolume(readMasterVolume(localStorage.getItem('our-cadence.master-volume.v1'))); } catch { /* optional preference */ }
    setMasterReady(true);
  }, []);
  useEffect(() => { if (!masterReady) return;try { localStorage.setItem('our-cadence.master-volume.v1', String(masterVolume)); } catch { /* optional preference */ } }, [masterVolume, masterReady]);
  useEffect(() => () => { analysisRequest.current++;analysisController.current?.abort(); }, []);
  useEffect(() => () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); }, [imagePreviewUrl]);
  useEffect(() => { player.current?.updateMix(mixForPlayback(playing, mix)); }, [mix, playing]);
  useEffect(() => { player.current?.updateMasterVolume(masterVolume); }, [masterVolume]);
  useEffect(() => { if (!playing) return;const timer = setInterval(() => setPosition(player.current?.position() ?? 0), 80);return () => clearInterval(timer); }, [playing]);
  const stop = useCallback(() => { request.current++;activePlayId.current = null;player.current?.stop();setPlaying(null);setBusy(false);setPosition(0); }, []);
  const cancelComposer = useCallback(() => { aiRequest.current++;aiController.current?.abort();setAiBusy(false); }, []);
  const refreshComposer = useCallback(async () => {
    try { const response = await fetch('/api/compose'); const data = await response.json() as { available?: boolean; providerLabel?: string };setAiAvailable(response.ok && data.available === true);setAiProviderLabel(data.providerLabel ?? ''); }
    catch { setAiAvailable(false); }
  }, []);
  useEffect(() => { void refreshComposer(); }, [refreshComposer]);
  useEffect(() => { cancelComposer();setAiError(''); }, [aiInputKey, cancelComposer]);
  useEffect(() => () => { aiRequest.current++;aiController.current?.abort(); }, []);
  useEffect(() => { stop(); }, [usingAI, aiStale, stop]);
  async function generateAIComposition() {
    if (!theme || aiBusy || !aiInputKey) return;
    if (aiScores[scene] && versions.length >= 40) { setAiError('版本记录已满，请先整理版本，当前 AI 乐谱未改变。');return; }
    const sourceKey = aiInputKey;
    cancelComposer();const token = aiRequest.current, controller = new AbortController();aiController.current = controller;
    setAiBusy(true);setAiError('');
    try {
      const response = await fetch('/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, theme, scene, bpm, voice }), signal: controller.signal });
      const data = await response.json() as { error?: string; composition?: unknown };
      if (!response.ok) throw new Error(data.error || 'AI 谱曲失败，当前作品已保留。');
      const composition = savedCompositionSchema.parse(data.composition);
      if (token !== aiRequest.current || sourceKey !== latestAIKey.current) return;
      if (composition.sourceKey !== sourceKey || composition.scene !== scene) throw new Error('乐谱与当前角色或场景不一致，未应用。');
      const current = latestLibrary.current;
      const previous = current.draft.aiScores?.[scene];
      if (previous && current.versions.length >= 40) throw new Error('版本记录已满，未覆盖原 AI 乐谱。');
      const nextVersions = previous ? [snapshot(current.draft, 'AI 重新谱曲前'), ...current.versions] : current.versions;
      const nextScores = { ...current.draft.aiScores, [scene]: composition };
      const nextDraft = { ...current.draft, aiScores: nextScores, arrangementMode: 'ai' as const };
      if (new TextEncoder().encode(JSON.stringify(library(nextDraft, nextVersions))).length > 6_000_000) throw new Error('工程体积超过导入上限，未覆盖当前作品。请先备份并整理版本。');
      stop();setAiScores(nextScores);setArrangementMode('ai');setVersions(nextVersions);
      setNotice(`「${composition.title}」已准备好，四轨试听和导出使用这份 AI 乐谱。`);
    } catch (e) {
      if (token !== aiRequest.current || controller.signal.aborted) return;
      setAiError(e instanceof Error ? e.message : 'AI 谱曲失败，当前作品已保留。');
    } finally { if (token === aiRequest.current) setAiBusy(false); }
  }

  useEffect(() => {
    if (!ready || analyzingImage || !profile.music || !needsGeneration) return;
    const timer = setTimeout(() => {
      // Replace only candidates. Keep the adopted theme, mix, and arrangement playback intact.
      if (activePlayId.current && activePlayId.current !== 'arrangement') stop();
      setCandidates(generateThemes(profile, take));
      if (!theme) setSettings(settingsForMusic(profile.music!, profile.mood));
    }, 350);
    return () => clearTimeout(timer);
  }, [ready, analyzingImage, needsGeneration, profile, take, theme, stop]);
  async function stems(forScore: Score) {
    const key = JSON.stringify(forScore);let buffer = cache.current.get(key);
    if (!buffer) { buffer = await renderStems(forScore);if (cache.current.size >= 2) cache.current.delete(cache.current.keys().next().value!);cache.current.set(key, buffer); }return buffer;
  }
  function isolatedTrackMix(index: number, source = latestMix.current) {
    return source.map((item, i) => ({ ...item, mute: i !== index, solo: false }));
  }
  async function play(forScore: Score, id: string, playbackMix?: Settings[Scene]['mix']) {
    if (playing === id) { stop();return; }stop();activePlayId.current = id;const token = request.current;setBusy(true);setError('');
    try {
      await player.current!.unlock();const buffer = await stems(forScore);if (token !== request.current) return;
      const selectedMix = playbackMix ?? mixForPlayback(id, latestMix.current);
      await player.current!.play(buffer, selectedMix, scoreSeconds(forScore), id === 'arrangement' && loop, () => { setPlaying(null);setPosition(0); }, latestMasterVolume.current);
      if (token === request.current) setPlaying(id);
    }
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
  function blendSemanticProfile(local: MusicProfile, understanding: ImageUnderstanding, hasStory = false): MusicProfile {
    const target = understanding.target;
    const identityWeight = hasStory ? .72 : understanding.identity.type === 'character' || understanding.identity.type === 'meme' ? Math.min(.72, .42 + understanding.identity.confidence / 250) : .38;
    const blend = (key: keyof Omit<MusicProfile, 'hue'>) => Math.round(local[key] * (1 - identityWeight) + target[key] * identityWeight);
    return { energy: blend('energy'), warmth: blend('warmth'), tension: blend('tension'), mystery: blend('mystery'), brightness: blend('brightness'), elegance: blend('elegance'), aggression: blend('aggression'), hue: local.hue };
  }
  function cancelAnalysis() {
    analysisRequest.current++;analysisController.current?.abort();setAnalyzingImage(false);setAnalysisPhase(null);
    setVisionState('fallback');setNotice('已停止深入分析，保留当前草稿。');
  }
  async function finishCharacterAnalysis(localProfile: Profile, token: number, controller: AbortController, replacingImage: boolean) {
    let result = localProfile;
    setAnalysisPhase('story');setVisionState('loading');
    try {
      const image = localProfile.image!;
      const form = new FormData();
      const semanticBlob = await (await fetch(image.thumbnail, { signal: controller.signal })).blob();
      form.append('image', semanticBlob, 'analysis.webp');
      form.append('name', localProfile.name);form.append('story', localProfile.description);
      form.append('local', JSON.stringify({ visual: image.visual, segments: image.segments, semantics: image.semantics }));
      const response = await fetch('/api/image-understand', { method: 'POST', body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(48_000)]) });
      const data = await response.json() as { available?: boolean; analysis?: ImageUnderstanding };
      if (token !== analysisRequest.current) return;
      if (response.ok && data.available && data.analysis) {
        const music = blendSemanticProfile(localProfile.music!, data.analysis, !!localProfile.description.trim());
        result = { ...localProfile, mood: suggestedMood(music), music, image: { ...image, understanding: data.analysis, storyAnalyzed: !!localProfile.description.trim() } };
        setVisionState('ready');setNotice('图像与角色设定已完成联合分析，主题已准备好。');
      } else {
        setVisionState('fallback');setNotice('已结合图片特征与故事关键词生成主题；当前为本地规则分析。');
      }
    } catch {
      if (token !== analysisRequest.current || controller.signal.aborted) return;
      setVisionState('fallback');setNotice('深入分析暂时不可用，已保留图片特征与故事关键词生成的主题。');
    }
    if (token !== analysisRequest.current) return;
    setAnalysisPhase('themes');
    // Yield one frame so real generation stages can be announced, without a fake percentage or delay.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (token !== analysisRequest.current) return;
    setProfile(result);setTake(0);setCandidates(generateThemes(result, 0));
    if (replacingImage || !theme) setSettings(settingsForMusic(result.music!, result.mood));
  }
  async function importImage(file?: File) {
    if (!file) return;
    analysisController.current?.abort();
    const controller = new AbortController(), token = ++analysisRequest.current;
    analysisController.current = controller;setAnalyzingImage(true);setAnalysisPhase('image');setVisionState('idle');setError('');
    try {
      const analysis = await analyzeImageFile(file);
      if (token !== analysisRequest.current) return;
      if (theme && !preserve('更换参考图片前')) return;
      stop();setImagePreviewUrl(URL.createObjectURL(file));
      const story = musicWithStory(analysis.music, profile.description);
      const mood = suggestedMood(story.music);
      const localProfile: Profile = { ...profile, direction: undefined, mood, music: story.music, image: { ...analysis.image, musicBaseline: analysis.music } };
      setProfile(localProfile);setTheme(null);setStage('theme');
      await finishCharacterAnalysis(localProfile, token, controller, true);
    } catch (e) { if (token === analysisRequest.current) setError(e instanceof Error ? e.message : '图片分析失败，请换一张图片重试。'); }
    finally { if (token === analysisRequest.current) { setAnalyzingImage(false);setAnalysisPhase(null); } }
  }
  async function reanalyzeCharacter() {
    if (!profile.image || !profile.music || analyzingImage) return;
    if (activePlayId.current && activePlayId.current !== 'arrangement') stop();
    analysisController.current?.abort();
    const controller = new AbortController(), token = ++analysisRequest.current;
    analysisController.current = controller;setAnalyzingImage(true);setAnalysisPhase('story');setError('');
    const baseline = profile.image.musicBaseline ?? profile.music;
    const music = musicWithStory(baseline, profile.description).music;
    const localProfile: Profile = { ...profile, direction: undefined, music, image: { ...profile.image, musicBaseline: baseline, understanding: undefined, storyAnalyzed: false } };
    setProfile(localProfile);
    try { await finishCharacterAnalysis(localProfile, token, controller, false); }
    finally { if (token === analysisRequest.current) { setAnalyzingImage(false);setAnalysisPhase(null); } }
  }
  function updateCharacter(patch: { name?: string; description?: string }) {
    if (analyzingImage) return;
    setVisionState('idle');
    setProfile(previous => {
      const next = { ...previous, ...patch };
      if (!previous.image || !previous.music) return next;
      const baseline = previous.image.musicBaseline ?? previous.music;
      const music = patch.description !== undefined ? musicWithStory(baseline, next.description).music : previous.music;
      return { ...next, direction: patch.description !== undefined ? undefined : previous.direction, music, image: { ...previous.image, musicBaseline: baseline, understanding: undefined, storyAnalyzed: false } };
    });
  }
  function updateMusicDimension(key: keyof Omit<MusicProfile, 'hue'>, value: number) {
    setProfile(prev => prev.music ? { ...prev, music: { ...prev.music, [key]: Math.max(0, Math.min(100, Math.round(value))) } } : prev);
  }
  function changeScene(next: Scene) { stop();setScene(next); }
  function preserve(reason: string): boolean {
    if (versions.length >= 40) { setError('已保存 40 个版本。请先导出工程备份；本轮不会自动删除旧版本。');return false; }
    const next = [snapshot(draft, reason), ...versions];
    if (new TextEncoder().encode(JSON.stringify(library(draft, next))).length > 6_000_000) { setError('工程体积已到上限，请先导出备份；未新增版本。');return false; }
    setVersions(next);return true;
  }
  function choose(next: Theme) { if (theme && !preserve('切换主题前')) return;stop();setTheme(next);setNotice(theme ? '旧主题与编曲已保留到版本记录。' : '主题已选定，试试三种场景。'); }
  function saveVersion() { if (preserve('手动保存')) setNotice('已创建不可变版本，可从版本记录重新打开。'); }
  function openVersion(id: string) { const saved = versions.find(v => v.id === id);if (saved && preserve('恢复版本前')) { restore(structuredClone(saved.draft));setNotice('已恢复保存的实际音符与参数，没有重新生成。'); } }
  function exportProject() { download(JSON.stringify(library(draft, versions)), 'application/json', `${safeFilename(profile.name)}-OurCadence.json`);setNotice('工程备份已准备，包含草稿、主题音符和保存的版本。'); }
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
    const exportScore = score, exportMix = structuredClone(mix), exportMaster = masterVolume, filename = `${safeFilename(profile.name)}-${SCENES[scene].name}-${bpm}BPM`;
    try {
      if (kind === 'midi') download(encodeMidi(exportScore, exportMix), 'audio/midi', filename + '.mid');
      else {
        const source = await stems(exportScore), buffer = await renderMix(source, exportMix, exportMaster);
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
    read: () => ({ masterVolume, composerAvailable: aiAvailable, composing: aiBusy, arrangementSource: usingAI ? 'gpt-6-astra' : 'rules', ready, character: profile.name, themes: candidates.map(t => ({ id: t.id, name: t.name })), themeId: theme?.id ?? null, scene, bpm, voice, playing, busy, savedVersions: versions.length, error }),
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
      const buffer = await stems(score), mixed = await renderMix(buffer, latestMix.current, latestMasterVolume.current);
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
  const currentTitle = auditionTheme?.name ?? (usingAI ? savedAI?.title : theme?.name) ?? '选择一段旋律';
  const stages = ['theme', 'scene', 'mix'];
  const stageIndex = stages.indexOf(stage);
  const stageNames = ['选择主题', '场景编曲', '调整与导出'];
  const stageTitles = ['Theme', 'Scene', 'Sound'];
  const moveStage = (direction: number) => {
    const target = Math.max(0, Math.min(2, stageIndex + direction));
    if (!theme && target > 0) return;
    setStage(stages[target]);
  };
  return <div className="reference-studio" style={backdropStyle}>
    <EditorialHeader studio>
      <Dialog><DialogTrigger asChild><button className="archive-entry"><RollingLabel>ARCHIVE</RollingLabel><span className="sr-only">作品与版本</span></button></DialogTrigger><DialogContent className="editorial-dialog"><DialogHeader><DialogTitle>作品与版本</DialogTitle><DialogDescription>保存每一次选择。导出工程可用于备份或迁移到其他浏览器。</DialogDescription></DialogHeader><p className="storage-status" role="status">{saveState}</p><div className="archive-actions"><Button onClick={saveVersion} disabled={!ready}><Save />保存当前版本</Button><Button variant="outline" onClick={exportProject} disabled={!ready}><Download />备份工程</Button><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!ready}><Upload />导入工程</Button></div><label className="editorial-field">打开保存的版本<Select value="" onValueChange={id => { openVersion(id);setStage('theme'); }} disabled={!versions.length}><SelectTrigger aria-label="打开保存的版本" className="w-full"><SelectValue placeholder={versions.length ? `选择版本（${versions.length}）` : '暂时没有保存的版本'} /></SelectTrigger><SelectContent>{versions.map(v => <SelectItem key={v.id} value={v.id}>{v.label} · {new Date(v.savedAt).toLocaleString('zh-CN')}</SelectItem>)}</SelectContent></Select></label><p className="editorial-help">存档仅在当前浏览器。清理浏览器数据会删除本地记录，请定期导出工程备份。</p><p className="studio-notice" role="status">{notice}</p>{error && <p className="studio-error" role="alert">{error}</p>}</DialogContent></Dialog>
    </EditorialHeader>
    <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e => { void importProject(e.target.files?.[0]);e.target.value = ''; }} />
    <input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { void importImage(e.target.files?.[0]);e.target.value = ''; }} />
    <main className="reference-workspace" aria-busy={!ready}>
      <aside className="workspace-left">
        <div><div className="small-index">OUR CADENCE / STUDIO</div><h1 className="workspace-title">{stageTitles[stageIndex]}<span>studio.</span></h1><p className="workspace-description">{stage === 'theme' ? '从三段旋律里，找到属于角色的声音。' : stage === 'scene' ? '同一个主题，在故事的不同片刻发生变化。' : '调整每一轨的声音，留下你喜欢的版本。'}</p>
          <CharacterBrief profile={profile} disabled={!ready || analyzingImage} onChange={updateCharacter} onUpload={() => imageInput.current?.click()} onReanalyze={() => { void reanalyzeCharacter(); }} />
          <Link href="/" className="index-back"><ArrowLeft size={13} /><RollingLabel>BACK TO INDEX</RollingLabel></Link>
        </div>
        <div className="workspace-dial"><PageDial current={stageIndex + 1} previous={() => moveStage(-1)} next={() => moveStage(1)} previousDisabled={stageIndex === 0} nextDisabled={stageIndex === 2 || !theme} /><span>{stageNames[stageIndex]}</span></div>
      </aside>
      <section className="workspace-center" aria-label="音乐创作工作区">
        <Tabs value={stage} onValueChange={setStage} className="editorial-tabs"><TabsList className="editorial-stages" aria-label="创作步骤"><TabsTrigger value="theme"><span>01</span>主题</TabsTrigger><TabsTrigger value="scene" disabled={!theme}><span>02</span>场景</TabsTrigger><TabsTrigger value="mix" disabled={!theme}><span>03</span>调整与导出</TabsTrigger></TabsList>
          <TabsContent value="theme" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>找到那段旋律。</h2><p>{profile.image ? '四小节主题 / 三个提案' : '先上传图片，建立你的音乐性格。'}</p></div>{profile.image && <button className="quiet-action" onClick={generate} disabled={!ready || busy || analyzingImage}><RefreshCw size={14} /><RollingLabel>换一组</RollingLabel></button>}</div>
            {analysisPhase && <CharacterAnalysisProgress phase={analysisPhase} onCancel={cancelAnalysis} />}
            <StudioProfile profile={profile} previewUrl={imagePreviewUrl} analyzing={analyzingImage} busy={busy} visionState={visionState} needsGeneration={needsGeneration} onUpload={() => imageInput.current?.click()} onDimension={updateMusicDimension} onApply={generate} />
            {profile.image && <>
            <ThemeProposals needsGeneration={needsGeneration} candidates={candidates} selected={theme} playing={playing} position={position} disabled={busy || !ready || analyzingImage || needsGeneration} onPlay={candidate => { void play(themeScore(candidate), candidate.id); }} onChoose={choose} onContinue={() => setStage('scene')} />
            </>}
          </TabsContent>
          <TabsContent value="scene" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>让故事继续发生。</h2><p>规则草稿延续主题，AI 编曲加入段落发展。</p></div></div>
            <div className="scene-options">{(Object.keys(SCENES) as Scene[]).map((id, index) => <button key={id} className={`editorial-scene ${scene === id ? 'is-selected' : ''}`} aria-pressed={scene === id} onClick={() => changeScene(id)}><span className="scene-number">0{index + 1}</span><span className="scene-word">{['Everyday', 'Memory', 'Battle'][index]}</span><span className="scene-chinese">{SCENES[id].name} / {settings[id].bpm} BPM</span><span className="scene-detail">{SCENES[id].description}</span><span className="scene-check">{scene === id ? <Check size={20} /> : <ArrowUpRight size={20} />}</span></button>)}</div>
            <AIComposer providerLabel={aiProviderLabel} available={aiAvailable} busy={aiBusy} hasTheme={!!theme} hasImage={!!profile.image?.thumbnail} composition={savedAI} stale={aiStale} mode={usingAI ? 'ai' : 'rules'} error={aiError} sceneName={SCENES[scene].name} onGenerate={() => { void generateAIComposition(); }} onCancel={cancelComposer} onMode={mode => { stop();setArrangementMode(mode); }} onRefresh={() => { void refreshComposer(); }} />
            <div className="scene-audition"><span>{usingAI ? savedAI?.title : theme?.name} · {SCENES[scene].name}<small>4 轨 / 16 小节 / {score ? displayTime(scoreSeconds(score)) : '00:00'}</small></span><button className="round-audition" onClick={() => score && play(score, 'arrangement')} disabled={busy} aria-label="试听当前场景">{playing === 'arrangement' ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button></div>
            <div className="center-next"><p>三种场景分别记住你的调整。</p><button className="outline-pill" onClick={() => setStage('mix')}><RollingLabel>调整与导出</RollingLabel><ArrowUpRight size={16} /></button></div>
          </TabsContent>
          <TabsContent value="mix" className="editorial-stage-panel">
            <div className="center-heading"><div><h2>最后一点，留给你。</h2><p>{usingAI ? savedAI?.title : theme?.name} / {SCENES[scene].name} / 四轨编曲</p></div></div>
            <div className="mix-settings"><label className="tempo-field">速度 BPM<input aria-label="速度 BPM" type="number" min={40} max={200} value={bpm} onChange={e => { stop();setBpm(Math.max(40, Math.min(200, Number(e.target.value) || 100))); }} /></label><label className="voice-field">旋律音色<Select value={voice} onValueChange={v => { stop();setVoice(v as Voice); }}><SelectTrigger aria-label="旋律音色"><SelectValue /></SelectTrigger><SelectContent>{MELODY_VOICES.map(v => <SelectItem key={v} value={v}>{VOICES[v]}</SelectItem>)}</SelectContent></Select></label><label className="master-volume-field"><span>总输出音量 <output>{Math.round(masterVolume * 100)}%</output></span><Slider aria-label="总输出音量" value={[masterVolume * 100]} min={0} max={160} step={1} onValueChange={value => setMasterVolume(value[0] / 100)} /></label></div>
            {masterVolume === 0 && <p className="editorial-help">总输出音量为 0，调高后即可试听。</p>}
            {usingAI && savedAI && <p className="ai-score-source">GPT-6 Astra · {savedAI.title} · 四段发展</p>}
            {score && <StudioMixer score={score} mix={mix} position={position} playingId={playing} busy={busy} onMix={setMix} onPlayTrack={index => { void play(score, `track-${index}`, isolatedTrackMix(index)); }} />}
            <div className="mix-bottom"><label><Switch aria-label="循环播放" checked={loop} onCheckedChange={v => { stop();setLoop(v); }} />循环播放</label><span>四轨混音 · 实时调整</span></div>
            <div className="studio-export"><button className="quiet-action" onClick={saveVersion}><Save size={15} />保存版本</button><button className="outline-pill" onClick={() => exportAudio('midi')} disabled={busy || exporting}>MIDI<Download size={15} /></button><button className="outline-pill solid" onClick={() => exportAudio('wav')} disabled={busy || exporting}>{exporting ? <LoaderCircle className="spin" size={16} /> : <RollingLabel>导出 WAV</RollingLabel>}<ArrowUpRight size={16} /></button></div><p className="editorial-help">音符网格仅供查看。WAV 使用当前混音，MIDI 音色由播放器决定。</p>
          </TabsContent>
        </Tabs>
        {busy && <div className="studio-preparing" role="status"><LoaderCircle className="spin" size={16} />准备声音中<button className="quiet-action" onClick={stop}>取消</button></div>}{error && <p className="studio-error" role="alert">{error}</p>}<p className="studio-notice" role="status">{notice}</p>
        {(saveState.startsWith('自动保存暂停') || saveState.startsWith('本地保存失败')) && <p className="studio-error" role="alert">{saveState}</p>}
      </section>
      <aside className="workspace-right" aria-label="当前工程信息"><div className="project-fraction">0{stageIndex + 1}<span>/03</span></div><dl className="project-facts"><div><dt>CHARACTER</dt><dd>{profile.name || '未命名角色'}</dd></div><div><dt>THEME</dt><dd>{theme?.name || '尚未选定'}</dd></div><div><dt>SCENE</dt><dd>{SCENES[scene].name}</dd></div><div><dt>FORMAT</dt><dd>4 TRACKS / 16 BARS</dd></div></dl></aside>
    </main>
    <footer className="editorial-player" aria-label="音乐播放器"><div className="player-now"><span>NOW PLAYING</span><strong>{currentTitle}<small>{auditionTheme ? '主题试听' : theme ? `${profile.name} / ${SCENES[scene].name}` : '请选择主题'}</small></strong></div><div className="player-center"><button className="round-audition player-toggle" onClick={() => busy || playing ? stop() : score && play(score, 'arrangement')} disabled={!ready || (!theme && !playing && !busy)} aria-label={busy ? '取消准备声音' : playing ? '停止当前音乐' : '播放当前编曲'}>{busy ? <LoaderCircle className="spin" size={18} /> : playing ? <Square size={15} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span className="elapsed-time">{displayTime(position)}</span><div className="editorial-progress" role="progressbar" aria-label="播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={duration ? Math.round(Math.min(100, position / duration * 100)) : 0}><i style={{ width: `${duration ? Math.min(100, position / duration * 100) : 0}%` }} /></div><span className="total-time">{displayTime(duration)}</span></div><div className="player-format"><span>{auditionTheme?.bpm ?? (auditionTheme ? 100 : bpm)} BPM</span><span>{loop ? 'LOOP ON' : '4/4 TIME'}</span></div></footer>
  </div>;
}
