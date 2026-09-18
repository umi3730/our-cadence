import { themeCharacter, themePresentation, themeProfileKey, type ThemeCharacter } from './theme-character.ts';
export type Mood = 'bright' | 'gentle' | 'resolute';
export type Scene = 'daily' | 'memory' | 'battle';
export const MELODY_VOICES = ['keys', 'bell', 'pluck', 'pad', 'flute', 'violin', 'marimba'] as const;
export const CHORD_VOICES = ['keys', 'bell', 'pluck', 'pad', 'marimba'] as const;
export const VOICE_IDS = [...MELODY_VOICES, 'bass', 'drums'] as const;
export type Voice = typeof VOICE_IDS[number];
export type Note = { pitch: number; beat: number; duration: number; velocity: number };
export type MusicProfile = {
  energy: number;
  warmth: number;
  tension: number;
  mystery: number;
  brightness: number;
  elegance: number;
  aggression: number;
  hue: number;
};
export type VisualSlice = { brightness: number; saturation: number; contrast: number; complexity: number; warmth: number; size: number };
export type SemanticTag = { label: string; confidence: number; source: 'global' | 'subject' | 'background' | 'person' };
export type ImageUnderstanding = {
  provider: string;
  summary: string;
  identity: { type: 'character' | 'meme' | 'scene' | 'object' | 'unknown'; name?: string; franchise?: string; confidence: number };
  subject: { description: string; elements: string[]; emotions: string[]; action: string };
  background: { description: string; elements: string[]; setting: string[] };
  style: string[];
  memeContext?: string;
  musicAssociations: { title: string; artist?: string; confidence: number; reason: string; sourceHint?: string }[];
  target: { energy: number; warmth: number; tension: number; mystery: number; brightness: number; elegance: number; aggression: number; bpmMin: number; bpmMax: number; genres: string[]; instruments: string[]; descriptors: string[] };
};
export type ProfileImage = {
  fingerprint: string;
  musicBaseline?: MusicProfile;
  storyAnalyzed?: boolean;
  thumbnail: string;
  palette: string[];
  visual: { brightness: number; saturation: number; contrast: number; complexity: number; warmth: number };
  backgroundMode?: 'transparent' | 'estimated';
  segments?: {
    subject: VisualSlice;
    background: VisualSlice;
    person: { likelihood: number; prominence: number; warmth: number; contrast: number };
  };
  semantics?: SemanticTag[];
  understanding?: ImageUnderstanding;
};
export type MusicDirection = 'character' | 'daily' | 'memory' | 'battle' | 'mechanical' | 'dreamy' | 'suspense' | 'retro' | 'anime-op';
export type Profile = { name: string; description: string; mood: Mood; direction?: MusicDirection; music?: MusicProfile; image?: ProfileImage };
export type Theme = { id: string; name: string; notes: Note[]; root: number; scale: number[]; seed: number; style?: 'lyrical' | 'driving' | 'atmospheric'; bpm?: number; progression?: number[]; character?: ThemeCharacter; sourceKey?: string };
export type Track = { id: string; name: string; voice: Voice; notes: Note[] };
export type Score = { bpm: number; beats: number; tracks: Track[] };
export type Mix = { volume: number; mute: boolean; solo: boolean }[];

export const MUSIC_PRESETS: { id: MusicDirection; name: string; description: string; mood: Mood; music: Omit<MusicProfile, 'hue'>; search: string }[] = [
  { id: 'character', name: '角色主题', description: '平衡、好记，适合作为 OC 的核心 leitmotif。', mood: 'resolute', search: 'character theme cinematic game ost', music: { energy: 58, warmth: 52, tension: 48, mystery: 46, brightness: 54, elegance: 68, aggression: 34 } },
  { id: 'daily', name: '轻快日常', description: '更明亮、更温暖，适合日常、校园、旅行。', mood: 'bright', search: 'bright daily anime instrumental pop', music: { energy: 62, warmth: 70, tension: 24, mystery: 18, brightness: 82, elegance: 62, aggression: 16 } },
  { id: 'memory', name: '回忆抒情', description: '慢速、留白、钢琴与弦乐感更强。', mood: 'gentle', search: 'emotional piano memory soundtrack', music: { energy: 25, warmth: 72, tension: 36, mystery: 58, brightness: 40, elegance: 88, aggression: 7 } },
  { id: 'battle', name: '战斗电子', description: '高能、高张力，鼓组与 Bass 更突出。', mood: 'resolute', search: 'battle electronic game soundtrack', music: { energy: 90, warmth: 22, tension: 80, mystery: 38, brightness: 42, elegance: 36, aggression: 86 } },
  { id: 'mechanical', name: '冷峻机械', description: '低温度、硬轮廓，偏工业与数字质感。', mood: 'resolute', search: 'industrial electronic mechanical soundtrack', music: { energy: 70, warmth: 16, tension: 72, mystery: 62, brightness: 26, elegance: 48, aggression: 66 } },
  { id: 'dreamy', name: '梦幻空灵', description: '低密度、高神秘，适合星空、幻想、治愈。', mood: 'gentle', search: 'dreamy ambient ethereal instrumental', music: { energy: 28, warmth: 52, tension: 24, mystery: 86, brightness: 66, elegance: 90, aggression: 5 } },
  { id: 'suspense', name: '黑暗悬疑', description: '低明亮、高张力与悬念，适合夜景和剧情。', mood: 'gentle', search: 'dark suspense ambient soundtrack', music: { energy: 42, warmth: 20, tension: 84, mystery: 92, brightness: 16, elegance: 62, aggression: 42 } },
  { id: 'retro', name: '复古合成', description: '偏电子、适中能量，适合霓虹与千禧复古。', mood: 'bright', search: 'retro synthwave electronic instrumental', music: { energy: 64, warmth: 26, tension: 40, mystery: 64, brightness: 58, elegance: 46, aggression: 30 } },
  { id: 'anime-op', name: '动画 OP', description: '高能、明亮、推进感强，偏日系摇滚/流行。', mood: 'resolute', search: 'anime opening japanese rock energetic', music: { energy: 86, warmth: 48, tension: 56, mystery: 22, brightness: 76, elegance: 48, aggression: 54 } },
];

export const MUSIC_DIMENSIONS: { key: keyof Omit<MusicProfile, 'hue' | 'aggression'>; name: string; low: string; high: string }[] = [
  { key: 'energy', name: '能量', low: '安静', high: '强烈' },
  { key: 'warmth', name: '温度', low: '冷冽', high: '温暖' },
  { key: 'tension', name: '张力', low: '稳定', high: '紧张' },
  { key: 'mystery', name: '神秘', low: '直白', high: '幽深' },
  { key: 'brightness', name: '明亮', low: '暗色', high: '明亮' },
  { key: 'elegance', name: '优雅', low: '粗粝', high: '精致' },
];
export const MUSIC_DIMENSION_EFFECTS: Record<keyof Omit<MusicProfile, 'hue'>, { impacts: string[]; hint: string }> = {
  energy: { impacts: ['基础 BPM', '旋律密度', '鼓点推进'], hint: '值越高，速度更快、切分更密。' },
  warmth: { impacts: ['原声/电子倾向', '和声音色', '低频柔和度'], hint: '高温度更偏原声和圆润，低温度更偏数字感。' },
  tension: { impacts: ['调式张力', '跳进幅度', '结尾稳定性'], hint: '高张力会提高不稳定音和更大的音程跳进。' },
  mystery: { impacts: ['调式选择', '留白比例', '悬念音'], hint: '越神秘越会使用更模态化、更悬置的句法。' },
  brightness: { impacts: ['整体明暗', '旋律音区', '和弦开阔度'], hint: '高明亮会抬高音区并减轻阴影感。' },
  elegance: { impacts: ['时值连贯', '装饰音处理', '句子平滑度'], hint: '高优雅更连贯顺滑，低优雅更粗粝短促。' },
  aggression: { impacts: ['重拍力度', '节奏攻击性', 'Bass 推力'], hint: '高攻击性会强化重音、贝斯和鼓组存在感。' },
};

export const SCENES: Record<Scene, { name: string; bpm: number; description: string; voice: Voice }> = {
  daily: { name: '日常', bpm: 100, description: '轻巧的电钢琴、分解和弦与舒展的律动。', voice: 'keys' },
  memory: { name: '回忆', bpm: 76, description: '清澈的钟琴、绵长的和弦与留白。', voice: 'bell' },
  battle: { name: '战斗', bpm: 136, description: '明亮的拨弦、紧凑的贝斯与有力鼓点。', voice: 'pluck' },
};
export const MOODS: Record<Mood, { name: string; root: number; scale: number[]; hint: string }> = {
  bright: { name: '明亮 / 好奇', root: 60, scale: [0, 2, 4, 5, 7, 9, 11], hint: 'C 大调' },
  gentle: { name: '温柔 / 内省', root: 57, scale: [0, 2, 3, 5, 7, 8, 10], hint: 'A 自然小调' },
  resolute: { name: '坚定 / 冒险', root: 62, scale: [0, 2, 3, 5, 7, 9, 10], hint: 'D 多利亚调式' },
};
export const VOICES: Record<Voice, string> = { keys: '柔和钢琴', bell: '钟琴', pluck: '木吉他', pad: '弦乐铺底', flute: '长笛', violin: '小提琴', marimba: '马林巴', bass: '圆润贝斯', drums: '合成鼓组' };
export const defaultMix = (): Mix => [1.0, 0.74, 0.82, 0.62].map(volume => ({ volume, mute: false, solo: false }));
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export function hash(text: string): number {
  let value = 2166136261;
  for (const ch of text) value = Math.imul(value ^ ch.codePointAt(0)!, 16777619);
  return value >>> 0;
}
export function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const degreePitch = (root: number, scale: number[], degree: number) => root + Math.floor(degree / 7) * 12 + scale[((degree % 7) + 7) % 7];
const progression = [0, 5, 3, 4];

export function musicProfileMeta(music: MusicProfile, mood: Mood = 'bright') {
  const bpm = Math.round(clamp(64 + music.energy * 0.58 + music.aggression * 0.22 - music.mystery * 0.08 + music.brightness * 0.08, 58, 168));
  const texture = music.warmth >= 65 && music.aggression < 55 ? '偏原声' : music.warmth <= 38 || music.tension >= 72 ? '偏电子' : '混合质感';
  const rhythm = music.energy < 38 ? '留白节奏' : music.energy > 70 || music.aggression > 68 ? '推进节奏' : music.elegance > 65 ? '流动节奏' : '均衡节奏';
  const scales = mood === 'bright'
    ? (music.mystery > 68 ? { scale: [0, 2, 4, 6, 7, 9, 11], name: 'Lydian' } : { scale: [0, 2, 4, 5, 7, 9, 11], name: 'Major' })
    : mood === 'gentle'
      ? (music.tension > 68 ? { scale: [0, 2, 3, 5, 7, 8, 11], name: 'Harmonic minor' } : { scale: [0, 2, 3, 5, 7, 8, 10], name: 'Natural minor' })
      : (music.mystery > 64 ? { scale: [0, 1, 3, 5, 7, 8, 10], name: 'Phrygian' } : { scale: [0, 2, 3, 5, 7, 9, 10], name: 'Dorian' });
  const pitchClass = Math.round(((music.hue % 360) / 360) * 11) % 12;
  const root = 58 + pitchClass + Math.round((music.brightness - 50) / 25);
  return { bpm, texture, rhythm, scale: scales.scale, scaleName: scales.name, root: Math.max(48, Math.min(72, root)) };
}

export function suggestedMood(music: MusicProfile): Mood {
  if (music.energy > 62 && (music.tension > 48 || music.aggression > 58)) return 'resolute';
  if (music.warmth > 56 && music.energy < 68) return 'gentle';
  return 'bright';
}

function motifContour(music: MusicProfile, variant: number, rng: () => number) {
  const leap = 1 + Math.round((music.energy + music.tension) / 55);
  const arcBias = music.elegance > 60 ? [0, 1, 2, 3, 2, 1, 0] : [0, 2, 1, 3, 1, 4, 2];
  const shadow = Math.round((music.mystery - 50) / 22);
  return Array.from({ length: 7 }, (_, i) => {
    const noisy = Math.floor(rng() * (leap + 1));
    const step = arcBias[(i + variant) % arcBias.length] + noisy + shadow;
    return ((i * (variant + 1) + step) % 7 + 7) % 7;
  });
}

/** Four-bar phrases. Three candidates intentionally use different compositional archetypes. */
export function generateThemes(profile: Profile, take: number): Theme[] {
  const music = profile.music;
  if (!music) {
    const palette = MOODS[profile.mood];
    const base = hash(JSON.stringify([profile.name.trim(), profile.description.trim(), profile.mood, take]));
    const fallback: MusicProfile = { energy: 55, warmth: 55, tension: 42, mystery: 42, brightness: 55, elegance: 60, aggression: 28, hue: 180 };
    return generateThemes({ ...profile, music: fallback }, take).map(theme => ({ ...theme, root: palette.root, scale: [...palette.scale], sourceKey: themeProfileKey(profile) }));
  }

  const meta = musicProfileMeta(music, profile.mood);
  const identity = profile.image?.understanding?.identity?.name || profile.name.trim() || profile.description.trim() || `visual-${Math.round(music.hue / 30)}-${Math.round(music.warmth / 20)}`;
  const base = hash(JSON.stringify([identity, profile.image?.understanding?.identity?.franchise ?? '', profile.description.trim(), profile.mood, profile.direction ?? '', take]));
  const archetypes = [
    { name: '微光', style: 'lyrical' as const, bpm: Math.round(clamp(meta.bpm - 12, 54, 150)), progression: [0, 3, 5, 4], octave: music.brightness > 58 ? 12 : 7 },
    { name: '远行', style: 'driving' as const, bpm: Math.round(clamp(meta.bpm + 16, 68, 186)), progression: [0, 5, 3, 4], octave: music.energy > 66 ? 12 : 7 },
    { name: '回声', style: 'atmospheric' as const, bpm: Math.round(clamp(meta.bpm - 24, 48, 132)), progression: music.mystery > 62 ? [0, 6, 5, 3] : [0, 2, 5, 4], octave: music.mystery > 62 ? 12 : 0 },
  ];
  const rhythms: Record<Theme['style'] & string, number[][]> = {
    lyrical: [
      [0, 1, 2.5, 3.25], [0, .75, 1.5, 2.5, 3.5], [0, 1.5, 2.25, 3.25], [0, 1, 2, 3.5],
    ],
    driving: [
      [0, .5, 1, 1.75, 2.25, 3, 3.5], [0, .75, 1.25, 2, 2.5, 3.25, 3.75], [0, .5, 1.5, 2, 2.75, 3.25], [0, .5, 1, 1.5, 2.5, 3, 3.5],
    ],
    atmospheric: [
      [0, 2, 3.5], [0, 1.5, 3], [0, 2.5], [0, 1, 3.25],
    ],
  };

  return archetypes.map((arch, variant) => {
    const seed = hash(`${base}:${arch.style}:${variant}`), rng = random(seed), notes: Note[] = [];
    const contour = motifContour(music, variant, rng);
    const velocityBase = arch.style === 'driving' ? .62 + music.aggression / 450 : arch.style === 'lyrical' ? .52 + music.energy / 520 : .42 + music.mystery / 700;
    for (let bar = 0; bar < 4; bar++) {
      const rhythm = rhythms[arch.style][bar];
      rhythm.forEach((at, j) => {
        let degree: number;
        if (arch.style === 'lyrical') {
          const arc = [0, 1, 2, 4, 3, 2, 1, 0];
          degree = (arc[(j + bar * 2 + variant) % arc.length] + contour[(j + bar) % contour.length]) % 7;
        } else if (arch.style === 'driving') {
          const motif = [0, 2, 4, 2, 5, 4, 2];
          degree = (motif[(j + bar) % motif.length] + (bar % 2 ? 1 : 0) + Math.round(music.tension / 45)) % 7;
        } else {
          const wide = [0, 4, 1, 5, 2, 6, 3];
          degree = (wide[(j + bar + variant) % wide.length] + Math.round(music.mystery / 35)) % 7;
        }
        if (at === 0) degree = arch.progression[bar] % 7;
        if (bar === 3 && j === rhythm.length - 1) degree = arch.style === 'atmospheric' && music.tension > 68 ? 4 : 0;
        const gap = (rhythm[j + 1] ?? 4) - at;
        const articulation = arch.style === 'atmospheric' ? .9 : arch.style === 'lyrical' ? .78 : .52;
        let pitch = degreePitch(meta.root + arch.octave, meta.scale, degree);
        if (arch.style === 'driving' && j % 5 === 4 && music.energy > 70) pitch += 12;
        if (arch.style === 'lyrical' && bar === 2 && j === 1 && music.brightness > 65) pitch += 12;
        notes.push({
          pitch: Math.max(36, Math.min(96, pitch)),
          beat: bar * 4 + at,
          duration: Math.max(.12, Math.min(3.8, gap * articulation)),
          velocity: clamp(velocityBase + (j === 0 ? .12 : 0) + (rng() - .5) * .12, .28, .98),
        });
      });
    }
    const character = themeCharacter(music);
    return { id: `theme-${seed}`, name: themePresentation(arch.style, character).name, character, sourceKey: themeProfileKey(profile), style: arch.style, bpm: arch.bpm, progression: [...arch.progression], root: meta.root, scale: [...meta.scale], seed, notes };
  });
}

export function themeScore(theme: Theme): Score {
  return { bpm: theme.bpm ?? 100, beats: 16, tracks: [{ id: 'melody', name: '主题旋律', voice: theme.style === 'atmospheric' ? 'bell' : theme.style === 'driving' ? 'pluck' : 'keys', notes: theme.notes }] };
}

/** Scene changes keep the selected motif intact; accompaniment gets a fuller 16-bar arc. */
export function arrange(theme: Theme, scene: Scene, bpm: number, melodyVoice: Voice): Score {
  const melody: Note[] = [], chords: Note[] = [], bass: Note[] = [], drums: Note[] = [];
  for (let repeat = 0; repeat < 4; repeat++) {
    const dynamic = [0.92, 0.98, 1.06, 1][repeat];
    melody.push(...theme.notes.map(n => ({ ...n, beat: n.beat + repeat * 16, velocity: Math.min(.99, n.velocity * dynamic) })));
  }
  const add = (target: Note[], pitch: number, beat: number, duration: number, velocity: number) => target.push({ pitch, beat, duration, velocity: Math.min(.99, velocity) });
  for (let bar = 0; bar < 16; bar++) {
    const themeProgression = theme.progression?.length === 4 ? theme.progression : progression;
    const section = Math.floor(bar / 4), degree = themeProgression[bar % 4];
    const triad = [0, 2, 4].map(d => degreePitch(theme.root, theme.scale, degree + d));
    const seventh = degreePitch(theme.root, theme.scale, degree + 6);
    const chord = scene === 'memory' || (scene === 'daily' && bar % 4 === 3) ? [...triad, seventh] : triad;
    if (scene === 'daily') {
      const pattern = bar % 2 ? [0, .75, 1.5, 2.5, 3.25] : [0, 1, 1.75, 2.5, 3.5];
      pattern.forEach((at, i) => add(chords, chord[i % chord.length], bar * 4 + at, .55, .43 + section * .025));
      if (bar % 4 === 3) add(chords, seventh, bar * 4 + 3.5, .35, .38);
    } else if (scene === 'memory') {
      chord.forEach((pitch, i) => add(chords, pitch + (i === chord.length - 1 ? 12 : 0), bar * 4 + i * .035, 3.82 - i * .04, .34 + section * .018));
    } else {
      [0, 1, 2, 3].forEach((at, pulse) => {
        triad.forEach((pitch, i) => add(chords, pitch + (pulse % 3 === 2 && i === 2 ? 12 : 0), bar * 4 + at, .25, .42 + section * .035));
      });
    }

    const root = degreePitch(theme.root - 24, theme.scale, degree), fifth = degreePitch(theme.root - 24, theme.scale, degree + 4);
    if (scene === 'memory') {
      add(bass, root, bar * 4, 3.55, .5 + section * .02);
      if (bar % 4 === 3) add(bass, fifth, bar * 4 + 3, .72, .42);
    } else if (scene === 'daily') {
      [0, 1.5, 2.5].forEach((at, i) => add(bass, i === 2 ? fifth : root, bar * 4 + at, i === 0 ? 1.18 : .72, .58 + section * .025));
    } else {
      [0, .5, 1, 1.5, 2, 2.5, 3, 3.5].forEach((at, i) => add(bass, i % 4 === 3 ? fifth : root, bar * 4 + at, .32, .68 + section * .035));
    }

    if (scene === 'memory') {
      [1, 3].forEach(at => add(drums, 42, bar * 4 + at, .08, .16 + section * .02));
      if (bar % 2 === 0) add(drums, 36, bar * 4, .24, .27 + section * .025);
      if (bar % 4 === 3) add(drums, 38, bar * 4 + 3.5, .12, .2);
    } else if (scene === 'daily') {
      [0, 2].forEach(at => add(drums, 36, bar * 4 + at, .24, .68));
      [1, 3].forEach(at => add(drums, 38, bar * 4 + at, .14, .38));
      for (let step = 0; step < 8; step++) add(drums, 42, bar * 4 + step / 2, .07, step % 2 ? .17 : .27);
      if (bar % 4 === 3) [3, 3.5, 3.75].forEach((at, i) => add(drums, i === 2 ? 38 : 42, bar * 4 + at, .08, .34 + i * .08));
    } else {
      [0, 1.5, 2, 2.75].forEach((at, i) => add(drums, 36, bar * 4 + at, .26, .78 + (i === 0 ? .08 : 0)));
      [1, 3].forEach(at => add(drums, 38, bar * 4 + at, .14, .68 + section * .03));
      for (let step = 0; step < 8; step++) add(drums, 42, bar * 4 + step / 2, .06, step % 2 === 0 ? .3 : .15);
      if (bar % 4 === 3) [3, 3.25, 3.5, 3.75].forEach((at, i) => add(drums, i % 2 ? 38 : 42, bar * 4 + at, .07, .44 + i * .09));
    }
  }
  return { bpm, beats: 64, tracks: [
    { id: 'melody', name: '旋律', voice: melodyVoice, notes: melody },
    { id: 'chords', name: '和弦', voice: scene === 'daily' ? 'keys' : scene === 'memory' ? 'pad' : 'pluck', notes: chords },
    { id: 'bass', name: '贝斯', voice: 'bass', notes: bass },
    { id: 'drums', name: '鼓', voice: 'drums', notes: drums },
  ] };
}

export const activeTrack = (mix: Mix, index: number) => !mix[index].mute && (!mix.some(t => t.solo) || mix[index].solo);
export const scoreSeconds = (score: Score) => score.beats * 60 / score.bpm;
export const displayTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
