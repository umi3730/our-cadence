import type { MusicProfile, Profile, Theme } from './music.ts';

export type ThemeCharacter = 'bold' | 'dark' | 'bright' | 'gentle' | 'balanced';

export function themeCharacter(music: MusicProfile): ThemeCharacter {
  if (music.aggression >= 75) return 'bold';
  if (music.tension >= 75 || music.brightness <= 25) return 'dark';
  if (music.energy >= 75) return 'bright';
  if (music.energy <= 35 && music.aggression <= 35) return 'gentle';
  return 'balanced';
}

/** Track the inputs that actually affect generation, independently of object key order. */
export function themeProfileKey(profile: Profile): string {
  const m = profile.music;
  const values = [profile.name.trim(), profile.description.trim(), profile.mood, profile.direction ?? '',
    profile.image?.understanding?.identity.name ?? '', profile.image?.understanding?.identity.franchise ?? '',
    m ? [m.energy, m.warmth, m.tension, m.mystery, m.brightness, m.elegance, m.aggression, m.hue] : null];
  let key = 2166136261;
  for (const char of JSON.stringify(values)) key = Math.imul(key ^ char.codePointAt(0)!, 16777619);
  return (key >>> 0).toString(16);
}

const CHARACTERS = {
  bold: { names: ['烈光', '突围', '暗潮'], labels: ['锋芒旋律', '强攻节奏', '冷峻氛围'], text: '以高攻击性为起点' },
  dark: { names: ['悬丝', '夜行', '迷雾'], labels: ['紧绷旋律', '暗色推进', '悬疑氛围'], text: '以暗色与张力为起点' },
  bright: { names: ['跃光', '疾行', '流星'], labels: ['明快旋律', '高能推进', '流动氛围'], text: '以高能量为起点' },
  gentle: { names: ['轻语', '漫步', '浮梦'], labels: ['轻柔旋律', '舒缓节奏', '空灵氛围'], text: '以低能量、低攻击性为起点' },
  balanced: { names: ['微光', '远行', '回声'], labels: ['旋律走向', '节奏走向', '氛围走向'], text: '沿用当前音乐性格' },
};

export function themePresentation(style?: Theme['style'], character?: ThemeCharacter) {
  const index = style === 'driving' ? 1 : style === 'atmospheric' ? 2 : 0;
  const group = CHARACTERS[character ?? 'balanced'];
  return {
    name: group.names[index], label: group.labels[index],
    subtitle: ['MELODY', 'RHYTHM', 'ATMOSPHERE'][index],
    description: `${character ? group.text : '保留已生成的主题'}，${['展开旋律句式', '突出节奏推进', '保留音符间的留白'][index]}。`,
  };
}
