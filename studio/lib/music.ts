export type Mood = 'bright' | 'gentle' | 'resolute';
export type Scene = 'daily' | 'memory' | 'battle';
export type Voice = 'keys' | 'bell' | 'pluck' | 'pad' | 'bass' | 'drums';
export type Note = { pitch: number; beat: number; duration: number; velocity: number };
export type Profile = { name: string; description: string; mood: Mood };
export type Theme = { id: string; name: string; notes: Note[]; root: number; scale: number[]; seed: number };
export type Track = { id: string; name: string; voice: Voice; notes: Note[] };
export type Score = { bpm: number; beats: number; tracks: Track[] };
export type Mix = { volume: number; mute: boolean; solo: boolean }[];
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
export const VOICES: Record<Voice, string> = { keys: '柔和电钢琴', bell: '钟琴', pluck: '合成拨弦', pad: '弦乐铺底', bass: '圆润贝斯', drums: '合成鼓组' };
export const defaultMix = (): Mix => [0.82, 0.58, 0.65, 0.46].map(volume => ({ volume, mute: false, solo: false }));
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

/** Four-bar phrases. Strong beats follow the chord; the final note returns home. */
export function generateThemes(profile: Profile, take: number): Theme[] {
  const palette = MOODS[profile.mood];
  const base = hash(JSON.stringify([profile.name.trim(), profile.description.trim(), profile.mood, take]));
  const rhythms = [[0, 1, 1.5, 2.5, 3], [0, 0.5, 1.5, 2, 3], [0, 1.5, 2.5]];
  return ['微光', '远行', '回声'].map((name, variant) => {
    const seed = hash(`${base}:${variant}`), rng = random(seed), notes: Note[] = [];
    const contour = [0, 2, 4, 1, 3].map(n => n + Math.floor(rng() * 2));
    for (let bar = 0; bar < 4; bar++) {
      const rhythm = rhythms[variant];
      rhythm.forEach((at, j) => {
        let degree = (contour[j] + (bar % 2)) % 7;
        if (at === 0) degree = (progression[bar] + (variant === 1 ? 2 : 0)) % 7;
        if (bar === 3 && j === rhythm.length - 1) degree = 0;
        const gap = (rhythm[j + 1] ?? 4) - at;
        notes.push({ pitch: degreePitch(palette.root + 12, palette.scale, degree), beat: bar * 4 + at, duration: gap * (j === rhythm.length - 1 ? 0.88 : 0.78), velocity: j === 0 ? 0.86 : 0.67 + rng() * 0.12 });
      });
    }
    return { id: `theme-${seed}`, name, root: palette.root, scale: [...palette.scale], seed, notes };
  });
}

export function themeScore(theme: Theme): Score {
  return { bpm: 100, beats: 16, tracks: [{ id: 'melody', name: '主题旋律', voice: 'keys', notes: theme.notes }] };
}

/** Scene changes never rewrite theme pitches, durations, or relative beat positions. */
export function arrange(theme: Theme, scene: Scene, bpm: number, melodyVoice: Voice): Score {
  const melody: Note[] = [], chords: Note[] = [], bass: Note[] = [], drums: Note[] = [];
  for (let repeat = 0; repeat < 4; repeat++) melody.push(...theme.notes.map(n => ({ ...n, beat: n.beat + repeat * 16 })));
  const add = (target: Note[], pitch: number, beat: number, duration: number, velocity: number) => target.push({ pitch, beat, duration, velocity });
  for (let bar = 0; bar < 16; bar++) {
    const degree = progression[bar % 4];
    const chord = [0, 2, 4].map(d => degreePitch(theme.root, theme.scale, degree + d));
    if (scene === 'daily') {
      [0, 1, 2, 3].forEach((at, i) => add(chords, chord[i % 3], bar * 4 + at, 0.82, 0.55));
    } else if (scene === 'memory') {
      chord.forEach((pitch, i) => add(chords, pitch, bar * 4 + i * 0.05, 3.7 - i * 0.05, 0.46));
    } else {
      [0, 1.5, 2, 3.5].forEach(at => chord.forEach(pitch => add(chords, pitch, bar * 4 + at, 0.36, 0.52)));
    }
    const root = degreePitch(theme.root - 24, theme.scale, degree);
    (scene === 'memory' ? [0] : scene === 'daily' ? [0, 2] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]).forEach((at, i) => add(bass, root + (i % 4 === 3 ? 7 : 0), bar * 4 + at, scene === 'memory' ? 3.5 : scene === 'daily' ? 1.55 : 0.38, 0.73));
    if (scene === 'memory') {
      [1, 3].forEach(at => add(drums, 42, bar * 4 + at, 0.1, 0.25));
      if (bar % 2 === 0) add(drums, 36, bar * 4, 0.3, 0.34);
    } else {
      (scene === 'battle' ? [0, 1.5, 2, 2.75] : [0, 2]).forEach(at => add(drums, 36, bar * 4 + at, 0.3, 0.85));
      [1, 3].forEach(at => add(drums, 38, bar * 4 + at, 0.18, scene === 'battle' ? 0.72 : 0.45));
      for (let step = 0; step < 8; step++) add(drums, 42, bar * 4 + step / 2, 0.1, step % 2 ? 0.25 : 0.38);
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
