import type { MusicProfile } from './music.ts';

const RULES: { label: string; words: string[]; changes: Partial<MusicProfile> }[] = [
  { label: '守护与希望', words: ['守护', '伙伴', '希望', '归乡', '保护'], changes: { warmth: 9, elegance: 5, aggression: -5 } },
  { label: '战斗与决心', words: ['战斗', '战士', '复仇', '征战', '反抗'], changes: { energy: 10, aggression: 16, tension: 8 } },
  { label: '回忆与失落', words: ['孤独', '失去', '离别', '回忆', '遗忘'], changes: { energy: -5, brightness: -9, mystery: 9 } },
  { label: '幻想与未知', words: ['神秘', '梦境', '魔法', '星空', '幻想'], changes: { mystery: 12, elegance: 6 } },
  { label: '温柔与宁静', words: ['温柔', '安静', '治愈', '平静', '温暖'], changes: { warmth: 10, energy: -6, aggression: -8, elegance: 7 } },
];

/** Transparent keyword fallback, not semantic understanding. Always apply to a fixed image baseline. */
export function musicWithStory(baseline: MusicProfile, story: string) {
  const matched = RULES.filter(rule => rule.words.some(word => {
    let from = 0;
    while (from < story.length) {
      const at = story.indexOf(word, from);
      if (at < 0) return false;
      const prefix = story.slice(Math.max(0, at - 8), at);
      if (!/(不|没有|并非|拒绝|讨厌|远离)[^，。；,.!?！？]{0,5}$/.test(prefix)) return true;
      from = at + word.length;
    }
    return false;
  }));
  const music = { ...baseline };
  for (const key of ['energy', 'warmth', 'tension', 'mystery', 'brightness', 'elegance', 'aggression'] as const) {
    const change = Math.max(-20, Math.min(20, matched.reduce((sum, rule) => sum + (rule.changes[key] ?? 0), 0)));
    music[key] = Math.max(0, Math.min(100, Math.round(baseline[key] + change)));
  }
  return { music, clues: matched.map(rule => rule.label) };
}
