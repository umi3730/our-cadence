import { defaultMix, type Mix } from './music.ts';

export function readMasterVolume(raw: string | null): number {
  if (raw === null || raw.trim() === '') return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1.6 ? value : 1;
}

export function mixForPlayback(id: string | null, mix: Mix): Mix {
  if (id?.startsWith('track-')) {
    const index = Number(id.slice(6));
    if (Number.isInteger(index) && index >= 0 && index < mix.length) return mix.map((item, i) => ({ ...item, mute: i !== index, solo: false }));
  }
  return id === 'arrangement' || id === null ? mix : defaultMix();
}
