import { z } from 'zod';
import { defaultMix, SCENES, type Scene, type Profile } from './music.ts';

export const STORAGE_KEY = 'our-cadence.library.v1';
const noteSchema = z.object({ pitch: z.number().int().min(24).max(108), beat: z.number().finite().min(0).lt(16), duration: z.number().finite().min(0.05).max(4), velocity: z.number().finite().min(0.01).max(1) }).strict().refine(n => n.beat + n.duration <= 16, '主题音符必须位于四小节内');
export const themeSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(40), root: z.number().int().min(48).max(72), scale: z.array(z.number().int().min(0).max(11)).length(7).refine(a => a.every((v, i) => !i || v > a[i - 1]), '音阶应递增'), seed: z.number().int().nonnegative().max(0xffffffff), notes: z.array(noteSchema).min(1).max(64) }).strict();
export const profileSchema = z.object({ name: z.string().max(40), description: z.string().max(600), mood: z.enum(['bright', 'gentle', 'resolute']) }).strict();
const mixSchema = z.array(z.object({ volume: z.number().finite().min(0).max(1), mute: z.boolean(), solo: z.boolean() }).strict()).length(4);
const settingSchema = z.object({ bpm: z.number().int().min(40).max(200), voice: z.enum(['keys', 'bell', 'pluck', 'pad']), mix: mixSchema }).strict();
export const draftSchema = z.object({ profile: profileSchema, take: z.number().int().min(0).max(1_000_000), candidates: z.array(themeSchema).length(3), theme: themeSchema.nullable(), scene: z.enum(['daily', 'memory', 'battle']), settings: z.object({ daily: settingSchema, memory: settingSchema, battle: settingSchema }).strict(), loop: z.boolean() }).strict();
export type Draft = z.infer<typeof draftSchema>;
export type Settings = Draft['settings'];
const snapshotSchema = z.object({ id: z.string().min(1).max(100), savedAt: z.string().datetime(), label: z.string().min(1).max(100), draft: draftSchema }).strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export const librarySchema = z.object({ schemaVersion: z.literal(1), generatorVersion: z.literal('rules-1'), draft: draftSchema, versions: z.array(snapshotSchema).max(40) }).strict();
export type Library = z.infer<typeof librarySchema>;
export function defaultSettings(): Settings {
  return Object.fromEntries(Object.entries(SCENES).map(([key, scene]) => [key, { bpm: scene.bpm, voice: scene.voice, mix: defaultMix() }])) as Settings;
}
export function parseLibrary(raw: string): Library {
  if (raw.length > 2_000_000) throw new Error('工程文件过大（最多 2 MB）。');
  let value: unknown;try { value = JSON.parse(raw); } catch { throw new Error('这不是有效的 JSON 工程文件。'); }
  const parsed = librarySchema.safeParse(value);
  if (!parsed.success) throw new Error('工程格式或音符数据不受支持，当前工程没有被修改。');
  return parsed.data;
}
export function snapshot(draft: Draft, reason = ''): Snapshot {
  return { id: crypto.randomUUID(), savedAt: new Date().toISOString(), label: `${draft.profile.name || '未命名角色'} · ${SCENES[draft.scene].name}${reason ? ' · ' + reason : ''}`, draft: structuredClone(draft) };
}
export function library(draft: Draft, versions: Snapshot[]): Library { return { schemaVersion: 1, generatorVersion: 'rules-1', draft, versions }; }
export const EXAMPLES: Profile[] = [
  { name: '澄', description: '安静、好奇的旅行者，喜欢收集旅途中的声音。', mood: 'bright' },
  { name: '弦', description: '守着旧书店的记录者，把没能说出口的话写进日记。', mood: 'gentle' },
  { name: '凛', description: '坚定的探路者，带着伙伴穿过风暴，寻找回家的路。', mood: 'resolute' },
];
export function safeFilename(name: string): string { return (name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 70) || 'Our-Cadence'); }
export function download(data: Uint8Array | string, type: string, filename: string) {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');anchor.href = url;anchor.download = filename;anchor.click();setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export const sceneList = Object.keys(SCENES) as Scene[];
