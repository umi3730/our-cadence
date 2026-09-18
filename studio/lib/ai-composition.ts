import { z } from 'zod';
import { hash, MELODY_VOICES, CHORD_VOICES, VOICE_IDS, type Profile, type Scene, type Score, type Theme, type Voice } from './music.ts';
import { themeProfileKey } from './theme-character.ts';

export const COMPOSER_MODEL = 'gpt-6-astra';
export const COMPOSITION_BEATS = 64;
const TRACK_IDS = ['melody', 'chords', 'bass', 'drums'] as const;
const composedNoteSchema = z.object({
  pitch: z.number().int().min(24).max(108),
  beat: z.number().finite().min(0).lt(COMPOSITION_BEATS),
  duration: z.number().finite().min(.05).max(16),
  velocity: z.number().finite().min(.01).max(1),
}).strict();
const compositionBase = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(500),
  bpm: z.number().int().min(40).max(200),
  beats: z.literal(COMPOSITION_BEATS),
  sections: z.array(z.object({ name: z.string().min(1).max(32), startBeat: z.number().int(), description: z.string().max(160) }).strict()).length(4),
  tracks: z.array(z.object({
    id: z.enum(TRACK_IDS), name: z.string().min(1).max(24),
    voice: z.enum(VOICE_IDS),
    notes: z.array(composedNoteSchema).min(1).max(256),
  }).strict()).length(4),
}).strict();

function validateMusic(data: z.infer<typeof compositionBase>, context: z.RefinementCtx) {
  const fail = (message: string) => context.addIssue({ code: 'custom', message });
  if (!data.sections.every((section, index) => section.startBeat === index * 16)) fail('段落必须覆盖四组四小节。');
  data.tracks.forEach((track, index) => {
    if (track.id !== TRACK_IDS[index]) fail('必须依次包含旋律、和弦、贝斯、鼓四轨。');
    if (index === 0 && !(MELODY_VOICES as readonly string[]).includes(track.voice) || index === 1 && !(CHORD_VOICES as readonly string[]).includes(track.voice)) fail('旋律／和弦音色无效。');
    if (index === 2 && track.voice !== 'bass' || index === 3 && track.voice !== 'drums') fail('贝斯／鼓音色无效。');
    const seen = new Set<string>();
    for (const note of track.notes) {
      if (note.beat + note.duration > COMPOSITION_BEATS + 1e-6) fail('音符超出了十六小节。');
      if (index === 3 && ![36, 38, 42].includes(note.pitch)) fail('鼓轨只能使用支持的底鼓、军鼓和踩镲。');
      const identity = `${note.beat}:${note.pitch}`;
      if (seen.has(identity)) fail('同一拍点不能重复同音高音符。');
      seen.add(identity);
    }
  });
  if (!data.tracks[0].notes.some(note => note.beat >= 32)) fail('旋律必须发展到后半段。');
  const shapes = [0, 16, 32, 48].map(start => JSON.stringify(data.tracks.map(track => track.notes
    .filter(note => note.beat >= start && note.beat < start + 16)
    .map(note => [note.pitch, note.beat - start, note.duration]).sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]))));
  if (new Set(shapes).size === 1) fail('四段不能只是同一段乐谱的机械重复。');
}

export const compositionSchema = compositionBase.superRefine(validateMusic);
export const savedCompositionSchema = compositionBase.extend({
  provider: z.enum(['openai', 'yoozoo']).optional(),
  model: z.literal(COMPOSER_MODEL), createdAt: z.string().datetime(),
  sourceKey: z.string().regex(/^[0-9a-f]{1,8}$/), scene: z.enum(['daily', 'memory', 'battle']),
}).superRefine(validateMusic);
export type Composition = z.infer<typeof compositionSchema>;
export type SavedComposition = z.infer<typeof savedCompositionSchema>;
export const aiScoresSchema = z.object({
  daily: savedCompositionSchema.optional(), memory: savedCompositionSchema.optional(), battle: savedCompositionSchema.optional(),
}).strict().superRefine((scores, ctx) => {
  for (const scene of ['daily', 'memory', 'battle'] as const) {
    if (scores[scene] && scores[scene].scene !== scene) ctx.addIssue({ code: 'custom', message: 'AI 乐谱与场景不匹配。' });
  }
});
export type AIScores = z.infer<typeof aiScoresSchema>;

export function compositionKey(profile: Profile, theme: Theme, scene: Scene): string {
  return hash(JSON.stringify([themeProfileKey(profile), profile.image?.fingerprint ?? '', profile.image?.understanding?.summary ?? '', scene, theme.id, theme.root, theme.scale, theme.notes])).toString(16);
}

export function compositionScore(composition: SavedComposition, bpm: number, melodyVoice: Voice): Score {
  return { bpm, beats: composition.beats, tracks: composition.tracks.map((track, index) => ({ ...track, voice: index === 0 ? melodyVoice : track.voice })) };
}

// Use the official strict JSON schema format, then perform music-specific checks above.
const number = { type: 'number' };
const string = { type: 'string' };
const object = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const COMPOSITION_JSON_SCHEMA = object({
  title: string, summary: string, bpm: { type: 'integer', minimum: 40, maximum: 200 }, beats: { type: 'integer', enum: [64] },
  sections: { type: 'array', minItems: 4, maxItems: 4, items: object({ name: string, startBeat: { type: 'integer', enum: [0, 16, 32, 48] }, description: string }) },
  tracks: { type: 'array', minItems: 4, maxItems: 4, items: object({
    id: { type: 'string', enum: [...TRACK_IDS] }, name: string,
    voice: { type: 'string', enum: [...VOICE_IDS] },
    notes: { type: 'array', minItems: 1, maxItems: 256, items: object({ pitch: { type: 'integer', minimum: 24, maximum: 108 }, beat: number, duration: number, velocity: number }) },
  }) },
});
