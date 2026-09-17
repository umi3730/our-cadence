import type { MusicProfile } from './music';

export type PreviewFeatures = {
  bpm?: number;
  energy: number;
  warmth: number;
  tension: number;
  mystery: number;
  brightness: number;
  elegance: number;
  aggression: number;
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function rms(values: Float32Array) { let sum = 0; for (const v of values) sum += v * v; return Math.sqrt(sum / Math.max(1, values.length)); }
function downmix(buffer: AudioBuffer) {
  const length = buffer.length, out = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) { const data = buffer.getChannelData(ch); for (let i = 0; i < length; i++) out[i] += data[i] / buffer.numberOfChannels; }
  return out;
}
function estimateBpm(data: Float32Array, sampleRate: number) {
  const hop = Math.max(128, Math.round(sampleRate / 200)), frames = Math.floor(data.length / hop), env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let sum = 0; const start = f * hop, end = Math.min(data.length, start + hop); for (let i = start; i < end; i++) sum += Math.abs(data[i]); env[f] = sum / Math.max(1, end - start); }
  let mean = 0; for (const v of env) mean += v; mean /= Math.max(1, env.length);
  for (let i = 0; i < env.length; i++) env[i] = Math.max(0, env[i] - mean);
  const fps = sampleRate / hop; let bestLag = 0, best = -Infinity;
  const minLag = Math.floor(fps * 60 / 190), maxLag = Math.min(env.length - 1, Math.ceil(fps * 60 / 60));
  for (let lag = minLag; lag <= maxLag; lag++) { let score = 0; for (let i = lag; i < env.length; i++) score += env[i] * env[i - lag]; if (score > best) { best = score; bestLag = lag; } }
  return bestLag ? Math.round(fps * 60 / bestLag) : undefined;
}
export async function analyzePreview(previewUrl: string): Promise<PreviewFeatures> {
  const response = await fetch(`/api/audio-proxy?url=${encodeURIComponent(previewUrl)}`);
  if (!response.ok) throw new Error('试听音频不可用');
  const bytes = await response.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const data = downmix(buffer), rate = buffer.sampleRate;
    const stride = Math.max(1, Math.floor(data.length / (rate * 28)));
    const sampled = stride === 1 ? data : Float32Array.from({ length: Math.floor(data.length / stride) }, (_, i) => data[i * stride]);
    const overall = rms(sampled), peak = sampled.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    let zc = 0, low = 0, high = 0, smooth = 0, prevLow = 0, prev = sampled[0] || 0;
    for (let i = 1; i < sampled.length; i++) {
      const v = sampled[i]; if ((v >= 0) !== (prev >= 0)) zc++;
      prevLow += .055 * (v - prevLow); low += prevLow * prevLow; const hi = v - prevLow; high += hi * hi; smooth += Math.abs(v - prev); prev = v;
    }
    const highRatio = high / Math.max(1e-9, high + low), zcr = zc / Math.max(1, sampled.length), crest = peak / Math.max(.0001, overall), rough = smooth / Math.max(1, sampled.length);
    const energy = clamp(18 + overall * 520);
    const brightness = clamp(highRatio * 120 + zcr * 1100);
    const warmth = clamp(100 - highRatio * 86 - zcr * 440 + Math.min(20, low / Math.max(1e-9, high) * 4));
    const aggression = clamp((crest - 1.2) * 18 + rough * 880 + energy * .42 + brightness * .16);
    const elegance = clamp(92 - rough * 920 - aggression * .22 + warmth * .16);
    const tension = clamp(brightness * .26 + aggression * .42 + Math.max(0, 60 - warmth) * .24);
    const mystery = clamp((100 - energy) * .28 + (100 - brightness) * .24 + Math.max(0, 66 - warmth) * .18 + elegance * .2);
    return { bpm: estimateBpm(data, rate), energy: Math.round(energy), warmth: Math.round(warmth), tension: Math.round(tension), mystery: Math.round(mystery), brightness: Math.round(brightness), elegance: Math.round(elegance), aggression: Math.round(aggression) };
  } finally { await ctx.close(); }
}
export function matchPreview(target: MusicProfile, features: PreviewFeatures) {
  const keys: (keyof Omit<MusicProfile, 'hue'>)[] = ['energy','warmth','tension','mystery','brightness','elegance','aggression'];
  const weights: Record<(typeof keys)[number], number> = { energy:.2, warmth:.12, tension:.18, mystery:.14, brightness:.1, elegance:.1, aggression:.16 };
  let distance = 0; for (const key of keys) distance += Math.abs(target[key] - features[key]) * weights[key];
  return Math.round(clamp(100 - distance * .92, 0, 100));
}
