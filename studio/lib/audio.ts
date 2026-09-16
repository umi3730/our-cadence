import { activeTrack, random, scoreSeconds, type Score, type Mix, type Note, type Voice } from './music.ts';

const SAMPLE_RATE = 32000;
export const TAIL = 1.1;
const frequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

function envelope(ctx: BaseAudioContext, out: AudioNode, start: number, duration: number, level: number, sustain: boolean) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + (sustain ? 0.04 : 0.008));
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * (sustain ? 0.6 : 0.18)), start + Math.max(0.05, duration));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + (sustain ? 0.65 : 0.22));
  gain.gain.linearRampToValueAtTime(0, start + duration + (sustain ? 0.7 : 0.25));
  gain.connect(out);
  return gain;
}
function tonal(ctx: BaseAudioContext, out: AudioNode, note: Note, voice: Voice, secondsPerBeat: number) {
  const start = note.beat * secondsPerBeat, duration = note.duration * secondsPerBeat;
  const gain = envelope(ctx, out, start, duration, note.velocity * (voice === 'pad' ? 0.1 : voice === 'bass' ? 0.3 : 0.24), voice === 'pad');
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = frequency(note.pitch);
  if (voice === 'keys') {
    oscillator.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(8), new Float32Array([0, 1, 0.32, 0.13, 0.06, 0.025, 0.01, 0.005])));
  } else if (voice === 'bell') {
    oscillator.type = 'sine';
    const overtone = ctx.createOscillator(), mod = ctx.createGain();
    overtone.frequency.value = frequency(note.pitch) * 2.01;
    mod.gain.setValueAtTime(frequency(note.pitch) * 0.7, start);
    mod.gain.exponentialRampToValueAtTime(0.01, start + duration + 0.2);
    overtone.connect(mod).connect(oscillator.frequency);overtone.start(start);overtone.stop(start + duration + 0.3);
  } else oscillator.type = voice === 'pad' ? 'sine' : 'triangle';
  oscillator.connect(gain);oscillator.start(start);oscillator.stop(start + duration + 0.8);
}
function percussion(ctx: BaseAudioContext, out: AudioNode, note: Note, secondsPerBeat: number, noise: AudioBuffer) {
  const start = note.beat * secondsPerBeat;
  const gain = ctx.createGain();gain.connect(out);
  gain.gain.setValueAtTime(note.velocity * (note.pitch === 36 ? 0.55 : 0.18), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + (note.pitch === 36 ? 0.23 : note.pitch === 38 ? 0.16 : 0.06));
  if (note.pitch === 36) {
    const osc = ctx.createOscillator();osc.frequency.setValueAtTime(125, start);osc.frequency.exponentialRampToValueAtTime(45, start + 0.17);osc.connect(gain);osc.start(start);osc.stop(start + 0.25);
  } else {
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();src.buffer = noise;filter.type = 'highpass';filter.frequency.value = note.pitch === 38 ? 1000 : 7000;src.connect(filter).connect(gain);src.start(start);src.stop(start + 0.2);
  }
}

/** Render isolated stems once; playback mix and WAV share the same graph. No network samples. */
export async function renderStems(score: Score): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(4, Math.ceil((scoreSeconds(score) + TAIL) * SAMPLE_RATE), SAMPLE_RATE);
  const merger = ctx.createChannelMerger(4);merger.connect(ctx.destination);
  const noise = ctx.createBuffer(1, SAMPLE_RATE / 2, SAMPLE_RATE), rng = random(1789);
  const noiseData = noise.getChannelData(0);for (let i = 0; i < noiseData.length; i++) noiseData[i] = rng() * 2 - 1;
  score.tracks.forEach((track, index) => {
    const bus = ctx.createGain();bus.connect(merger, 0, index);
    for (const note of track.notes) {
      if (track.voice === 'drums') percussion(ctx, bus, note, 60 / score.bpm, noise);
      else tonal(ctx, bus, note, track.voice, 60 / score.bpm);
    }
  });
  return ctx.startRendering();
}
function wireMix(ctx: BaseAudioContext, src: AudioBufferSourceNode, mix: Mix) {
  const split = ctx.createChannelSplitter(4), master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
  master.gain.value = 0.8;
  compressor.threshold.value = -7;compressor.knee.value = 6;compressor.ratio.value = 12;compressor.attack.value = 0.003;compressor.release.value = 0.18;
  src.connect(split);master.connect(compressor).connect(ctx.destination);
  return [0, 1, 2, 3].map(index => {
    const gain = ctx.createGain(), pan = ctx.createStereoPanner();pan.pan.value = [0, -0.2, 0, 0.16][index];
    gain.gain.value = activeTrack(mix, index) ? mix[index].volume : 0;
    split.connect(gain, index);gain.connect(pan).connect(master);return gain;
  });
}
export class Player {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gains: GainNode[] = [];
  private started = 0;
  private length = 0;
  private loopLength = 0;
  private isLoop = false;
  private request = 0;
  async unlock() {
    this.ctx ??= new AudioContext();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([this.ctx.resume(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('浏览器尚未允许声音，请直接点击页面上的播放按钮。')), 1800); })]); }
    finally { clearTimeout(timeout); }
  }
  async play(buffer: AudioBuffer, mix: Mix, loopBeatsSeconds: number, loop: boolean, onEnd: () => void) {
    this.stop();const request = this.request;
    await this.unlock();if (request !== this.request) return;
    const ctx = this.ctx!, source = ctx.createBufferSource();source.buffer = buffer;
    source.loop = loop;source.loopStart = 0;source.loopEnd = loopBeatsSeconds;
    this.isLoop = loop;this.loopLength = loopBeatsSeconds;this.length = buffer.duration;this.gains = wireMix(ctx, source, mix);
    this.source = source;this.started = ctx.currentTime;source.onended = () => { if (this.source === source) { this.source = null;source.disconnect();onEnd(); } };source.start();
  }
  updateMix(mix: Mix) { this.gains.forEach((gain, i) => gain.gain.setTargetAtTime(activeTrack(mix, i) ? mix[i].volume : 0, this.ctx!.currentTime, 0.02)); }
  position() { if (!this.ctx || !this.source) return 0;const time = this.ctx.currentTime - this.started;return this.isLoop ? time % this.loopLength : Math.min(time, this.length); }
  stop() { this.request++;if (this.source) { const old = this.source;this.source = null;old.onended = null;old.stop();old.disconnect(); }this.gains.forEach(g => g.disconnect());this.gains = []; }
  async dispose() { this.stop();await this.ctx?.close();this.ctx = null; }
}
export async function renderMix(stems: AudioBuffer, mix: Mix): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(stems.duration * 44100), 44100);
  const source = ctx.createBufferSource();source.buffer = stems;wireMix(ctx, source, mix);source.start();return ctx.startRendering();
}

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const frames = channels[0].length, count = channels.length, bytes = new Uint8Array(44 + frames * count * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, str: string) => [...str].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF');view.setUint32(4, bytes.length - 8, true);text(8, 'WAVE');text(12, 'fmt ');view.setUint32(16, 16, true);view.setUint16(20, 1, true);view.setUint16(22, count, true);view.setUint32(24, sampleRate, true);view.setUint32(28, sampleRate * count * 2, true);view.setUint16(32, count * 2, true);view.setUint16(34, 16, true);text(36, 'data');view.setUint32(40, frames * count * 2, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) {
    const sample = Math.max(-1, Math.min(1, channels[channel][frame]));view.setInt16(44 + (frame * count + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
