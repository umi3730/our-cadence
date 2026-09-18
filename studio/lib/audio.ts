import { activeTrack, random, scoreSeconds, type Score, type Mix, type Note, type Voice } from './music.ts';

const SAMPLE_RATE = 44100;
export const TAIL = 1.8;
const frequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

const SOUNDFONT_ROOT = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM';
const SAMPLE_INSTRUMENT: Partial<Record<Voice, string>> = {
  keys: 'acoustic_grand_piano', bell: 'celesta', pluck: 'acoustic_guitar_steel', pad: 'string_ensemble_1', flute: 'flute', violin: 'violin', marimba: 'marimba', bass: 'electric_bass_finger',
};
type LoadedSample = { buffer: AudioBuffer; baseMidi: number };
const decodedSamples = new Map<string, Promise<LoadedSample | null>>();
const FLAT_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function noteName(midi: number) { return `${FLAT_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`; }
function sampleRoots() {
  const roots: number[] = [];
  for (let midi = 21; midi <= 108; midi++) if ([0, 3, 6, 9].includes(midi % 12)) roots.push(midi);
  return roots;
}
const ROOTS = sampleRoots();
function nearestRoot(pitch: number) { return ROOTS.reduce((best, value) => Math.abs(value - pitch) < Math.abs(best - pitch) ? value : best, ROOTS[0]); }
async function decodeRemoteSample(voice: Voice, pitch: number): Promise<LoadedSample | null> {
  const instrument = SAMPLE_INSTRUMENT[voice]; if (!instrument) return null;
  const baseMidi = nearestRoot(pitch), key = `${instrument}:${baseMidi}`;
  if (!decodedSamples.has(key)) decodedSamples.set(key, (async () => {
    try {
      const url = `${SOUNDFONT_ROOT}/${instrument}-mp3/${noteName(baseMidi)}.mp3`;
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache', signal: AbortSignal.timeout(8000) }); if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      const decoder = new OfflineAudioContext(1, 1, SAMPLE_RATE), buffer = await decoder.decodeAudioData(bytes.slice(0));
      return { buffer, baseMidi };
    } catch { return null; }
  })());
  return decodedSamples.get(key)!;
}
async function prepareSamples(score: Score) {
  const bank = new Map<string, LoadedSample | null>();
  const tasks: Promise<void>[] = [];
  for (const track of score.tracks) {
    if (track.voice === 'drums' || !SAMPLE_INSTRUMENT[track.voice]) continue;
    for (const note of track.notes) {
      const root = nearestRoot(note.pitch), key = `${track.voice}:${root}`;
      if (bank.has(key)) continue;
      bank.set(key, null);
      tasks.push(decodeRemoteSample(track.voice, note.pitch).then(sample => { bank.set(key, sample); }));
    }
  }
  await Promise.all(tasks); return bank;
}
function sampledTonal(ctx: BaseAudioContext, out: AudioNode, note: Note, voice: Voice, secondsPerBeat: number, sample: LoadedSample) {
  const start = note.beat * secondsPerBeat, duration = Math.max(.04, note.duration * secondsPerBeat), source = ctx.createBufferSource(), gain = ctx.createGain();
  source.buffer = sample.buffer; source.playbackRate.value = Math.pow(2, (note.pitch - sample.baseMidi) / 12);
  const attack = voice === 'pad' ? .16 : voice === 'flute' ? .035 : voice === 'violin' ? .065 : .006;
  const release = voice === 'pad' ? .62 : voice === 'keys' ? .4 : voice === 'flute' ? .16 : .2;
  const level = note.velocity * (voice === 'pad' ? .22 : voice === 'bass' ? .46 : voice === 'flute' ? .20 : voice === 'violin' ? .18 : voice === 'marimba' ? .34 : .38);
  gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), start + attack);
  gain.gain.setValueAtTime(Math.max(.0002, level * (voice === 'pad' ? .78 : .72)), start + Math.max(attack + .01, duration * .7));
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration + release);
  if (voice === 'pad' && sample.buffer.duration > .8 && duration > 1.1) { source.loop = true; source.loopStart = Math.min(.3, sample.buffer.duration * .2); source.loopEnd = Math.max(source.loopStart + .15, sample.buffer.duration - .12); }
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = voice === 'bass' ? 1800 : voice === 'pad' ? 6200 : 9800; source.connect(tone).connect(gain).connect(out);
  source.start(start); source.stop(start + duration + release + .06);
}

function adsr(ctx: BaseAudioContext, out: AudioNode, start: number, duration: number, level: number, attack: number, decay: number, sustain: number, release: number) {
  const gain = ctx.createGain();
  const hold = Math.max(start + attack + decay + .01, start + duration);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), start + attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * sustain), start + attack + decay);
  gain.gain.setValueAtTime(Math.max(.0002, level * sustain), hold);
  gain.gain.exponentialRampToValueAtTime(.0001, hold + release);
  gain.connect(out); return { gain, end: hold + release + .03 };
}
function osc(ctx: BaseAudioContext, destination: AudioNode, start: number, end: number, freq: number, type: OscillatorType, gainValue: number, detune = 0) {
  const source = ctx.createOscillator(), gain = ctx.createGain();
  source.type = type; source.frequency.value = freq; source.detune.value = detune; gain.gain.value = gainValue;
  source.connect(gain).connect(destination); source.start(start); source.stop(end); return source;
}
function tonal(ctx: BaseAudioContext, out: AudioNode, note: Note, voice: Voice, secondsPerBeat: number) {
  const start = note.beat * secondsPerBeat, duration = Math.max(.04, note.duration * secondsPerBeat), f = frequency(note.pitch);
  if (voice === 'bell') {
    const partials = [[1, .62, 1.5], [2.01, .28, .85], [3.98, .12, .5], [5.4, .06, .35]] as const;
    for (const [ratio, amp, decay] of partials) {
      const gain = ctx.createGain(), source = ctx.createOscillator(); source.type = 'sine'; source.frequency.value = f * ratio;
      gain.gain.setValueAtTime(Math.max(.0001, note.velocity * amp * .34), start);
      gain.gain.exponentialRampToValueAtTime(.0001, start + Math.max(.12, decay + duration * .18));
      source.connect(gain).connect(out); source.start(start); source.stop(start + Math.max(.18, decay + duration * .2));
    }
    return;
  }

  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = voice === 'pluck' ? 5.2 : voice === 'bass' ? 1.4 : 1.1; filter.connect(out);
  if (voice === 'keys') {
    filter.frequency.value = 4300;
    const env = adsr(ctx, filter, start, duration, note.velocity * .23, .009, .12, .36, .58);
    osc(ctx, env.gain, start, env.end, f, 'sine', 1);
    osc(ctx, env.gain, start, env.end, f * 2, 'sine', .24, 1.5);
    osc(ctx, env.gain, start, env.end, f, 'triangle', .17, -1.5);
  } else if (voice === 'pluck') {
    filter.frequency.setValueAtTime(Math.min(7200, Math.max(1200, f * 10)), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(420, f * 2.2), start + Math.min(.32, duration + .12));
    const env = adsr(ctx, filter, start, Math.min(duration, .38), note.velocity * .22, .004, .065, .18, .22);
    osc(ctx, env.gain, start, env.end, f, 'triangle', .75);
    osc(ctx, env.gain, start, env.end, f, 'sawtooth', .18, 4);
  } else if (voice === 'pad') {
    filter.frequency.value = Math.min(2600, 900 + f * 2.4);
    const env = adsr(ctx, filter, start, duration, note.velocity * .105, .22, .3, .82, .9);
    osc(ctx, env.gain, start, env.end, f, 'sawtooth', .18, -7);
    osc(ctx, env.gain, start, env.end, f, 'sawtooth', .18, 7);
    osc(ctx, env.gain, start, env.end, f, 'sine', .75);
  } else if (voice === 'bass') {
    filter.frequency.value = Math.min(900, Math.max(240, f * 5));
    const env = adsr(ctx, filter, start, duration, note.velocity * .31, .008, .09, .7, .16);
    osc(ctx, env.gain, start, env.end, f, 'sine', .8);
    osc(ctx, env.gain, start, env.end, f, 'triangle', .28);
    if (note.pitch > 40) osc(ctx, env.gain, start, env.end, f / 2, 'sine', .16);
  } else if (voice === 'flute') {
    filter.frequency.value = Math.min(5000, f * 5);
    const env = adsr(ctx, filter, start, duration, note.velocity * .14, .04, .08, .8, .16);
    osc(ctx, env.gain, start, env.end, f, 'sine', 1);
    osc(ctx, env.gain, start, env.end, f * 2, 'sine', .12);
    osc(ctx, env.gain, start, env.end, f * 3, 'sine', .04);
  } else if (voice === 'violin') {
    filter.frequency.value = Math.min(5000, f * 6);
    const env = adsr(ctx, filter, start, duration, note.velocity * .13, .07, .12, .78, .24);
    osc(ctx, env.gain, start, env.end, f, 'sawtooth', .38, -2);
    osc(ctx, env.gain, start, env.end, f, 'triangle', .45, 2);
  } else if (voice === 'marimba') {
    filter.frequency.value = Math.min(5800, f * 9);
    const env = adsr(ctx, filter, start, Math.min(duration, .4), note.velocity * .20, .004, .18, .12, .22);
    osc(ctx, env.gain, start, env.end, f, 'sine', 1);
    osc(ctx, env.gain, start, env.end, f * 4, 'sine', .12);
  }
}
function percussion(ctx: BaseAudioContext, out: AudioNode, note: Note, secondsPerBeat: number, noise: AudioBuffer) {
  const start = note.beat * secondsPerBeat;
  if (note.pitch === 36) {
    const gain = ctx.createGain(); gain.connect(out); gain.gain.setValueAtTime(note.velocity * .52, start); gain.gain.exponentialRampToValueAtTime(.0001, start + .32);
    const body = ctx.createOscillator(); body.type = 'sine'; body.frequency.setValueAtTime(145, start); body.frequency.exponentialRampToValueAtTime(44, start + .2); body.connect(gain); body.start(start); body.stop(start + .34);
    const click = ctx.createBufferSource(), clickFilter = ctx.createBiquadFilter(), clickGain = ctx.createGain(); click.buffer = noise; clickFilter.type = 'highpass'; clickFilter.frequency.value = 4200; clickGain.gain.setValueAtTime(note.velocity * .11, start); clickGain.gain.exponentialRampToValueAtTime(.0001, start + .025); click.connect(clickFilter).connect(clickGain).connect(out); click.start(start); click.stop(start + .04);
  } else if (note.pitch === 38) {
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), gain = ctx.createGain(); src.buffer = noise; hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = .65;
    gain.gain.setValueAtTime(note.velocity * .23, start); gain.gain.exponentialRampToValueAtTime(.0001, start + .2); src.connect(hp).connect(gain).connect(out); src.start(start); src.stop(start + .23);
    const tone = ctx.createOscillator(), toneGain = ctx.createGain(); tone.type = 'triangle'; tone.frequency.value = 185; toneGain.gain.setValueAtTime(note.velocity * .1, start); toneGain.gain.exponentialRampToValueAtTime(.0001, start + .11); tone.connect(toneGain).connect(out); tone.start(start); tone.stop(start + .13);
  } else {
    const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), gain = ctx.createGain(); src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7200;
    gain.gain.setValueAtTime(note.velocity * .12, start); gain.gain.exponentialRampToValueAtTime(.0001, start + .055); src.connect(hp).connect(gain).connect(out); src.start(start); src.stop(start + .07);
  }
}

/** Render isolated stems once; playback mix and WAV share the same graph. */
export async function renderStems(score: Score): Promise<AudioBuffer> {
  // Prefer real General MIDI samples; fall back to the lightweight synth if CDN/network is unavailable.
  const samples = await prepareSamples(score);
  const ctx = new OfflineAudioContext(4, Math.ceil((scoreSeconds(score) + TAIL) * SAMPLE_RATE), SAMPLE_RATE);
  const merger = ctx.createChannelMerger(4); merger.connect(ctx.destination);
  const noise = ctx.createBuffer(1, SAMPLE_RATE / 2, SAMPLE_RATE), rng = random(1789);
  const noiseData = noise.getChannelData(0); for (let i = 0; i < noiseData.length; i++) noiseData[i] = rng() * 2 - 1;
  score.tracks.forEach((track, index) => {
    const bus = ctx.createGain(); bus.gain.value = [1, .92, .96, .88][index] ?? 1; bus.connect(merger, 0, index);
    for (const note of track.notes) {
      if (track.voice === 'drums') percussion(ctx, bus, note, 60 / score.bpm, noise);
      else {
        const sample = samples.get(`${track.voice}:${nearestRoot(note.pitch)}`);
        if (sample) sampledTonal(ctx, bus, note, track.voice, 60 / score.bpm, sample);
        else tonal(ctx, bus, note, track.voice, 60 / score.bpm);
      }
    }
  });
  return ctx.startRendering();
}
function impulse(ctx: BaseAudioContext, seconds = 1.45) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds)), buffer = ctx.createBuffer(2, length, ctx.sampleRate), rng = random(9127);
  for (let ch = 0; ch < 2; ch++) { const data = buffer.getChannelData(ch); for (let i = 0; i < length; i++) { const t = 1 - i / length; data[i] = (rng() * 2 - 1) * Math.pow(t, 2.7) * (ch ? .94 : 1); } }
  return buffer;
}
function wireMix(ctx: BaseAudioContext, src: AudioBufferSourceNode, mix: Mix, masterVolume = 1) {
  const split = ctx.createChannelSplitter(4), dry = ctx.createGain(), wet = ctx.createGain(), verb = ctx.createConvolver(), tone = ctx.createBiquadFilter(), makeup = ctx.createGain(), compressor = ctx.createDynamicsCompressor(), master = ctx.createGain();
  dry.gain.value = .9; wet.gain.value = .17; verb.buffer = impulse(ctx); tone.type = 'lowpass'; tone.frequency.value = 15800; tone.Q.value = .3;
  // The previous graph was intentionally conservative and sounded noticeably quiet on laptop speakers.
  // Add gentle makeup gain before compression, then keep a user-controlled master after it.
  makeup.gain.value = 1.34; compressor.threshold.value = -12; compressor.knee.value = 9; compressor.ratio.value = 4.5; compressor.attack.value = .006; compressor.release.value = .2;
  master.gain.value = Math.max(0, Math.min(1.6, masterVolume));
  src.connect(split); dry.connect(tone); verb.connect(wet).connect(tone); tone.connect(makeup).connect(compressor).connect(master).connect(ctx.destination);
  const gains = [0, 1, 2, 3].map(index => {
    const gain = ctx.createGain(), pan = ctx.createStereoPanner(), send = ctx.createGain(); pan.pan.value = [-.08, -.28, .04, .2][index]; send.gain.value = [.08, .23, .08, .05][index];
    gain.gain.value = activeTrack(mix, index) ? mix[index].volume : 0;
    split.connect(gain, index); gain.connect(pan); pan.connect(dry); pan.connect(send).connect(verb); return gain;
  });
  return { gains, master };
}
export class Player {
  private ctx: AudioContext | null = null; private source: AudioBufferSourceNode | null = null; private gains: GainNode[] = []; private master: GainNode | null = null; private started = 0; private length = 0; private loopLength = 0; private isLoop = false; private request = 0;
  async unlock() { this.ctx ??= new AudioContext(); let timeout: ReturnType<typeof setTimeout> | undefined; try { await Promise.race([this.ctx.resume(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('浏览器尚未允许声音，请直接点击页面上的播放按钮。')), 1800); })]); } finally { clearTimeout(timeout); } }
  async play(buffer: AudioBuffer, mix: Mix, loopBeatsSeconds: number, loop: boolean, onEnd: () => void, masterVolume = 1) {
    this.stop(); const request = this.request; await this.unlock(); if (request !== this.request) return;
    const ctx = this.ctx!, source = ctx.createBufferSource(); source.buffer = buffer; source.loop = loop; source.loopStart = 0; source.loopEnd = loopBeatsSeconds;
    this.isLoop = loop; this.loopLength = loopBeatsSeconds; this.length = buffer.duration; const graph = wireMix(ctx, source, mix, masterVolume); this.gains = graph.gains; this.master = graph.master; this.source = source; this.started = ctx.currentTime;
    source.onended = () => { if (this.source === source) { this.source = null; source.disconnect(); onEnd(); } }; source.start();
  }
  updateMix(mix: Mix) { if (!this.ctx) return; this.gains.forEach((gain, i) => gain.gain.setTargetAtTime(activeTrack(mix, i) ? mix[i].volume : 0, this.ctx!.currentTime, .02)); }
  updateMasterVolume(value: number) { if (this.ctx && this.master) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1.6, value)), this.ctx.currentTime, .02); }
  position() { if (!this.ctx || !this.source) return 0; const time = this.ctx.currentTime - this.started; return this.isLoop ? time % this.loopLength : Math.min(time, this.length); }
  stop() { this.request++; if (this.source) { const old = this.source; this.source = null; old.onended = null; old.stop(); old.disconnect(); } this.gains.forEach(g => g.disconnect()); this.gains = []; this.master?.disconnect(); this.master = null; }
  async dispose() { this.stop(); await this.ctx?.close(); this.ctx = null; }
}
export async function renderMix(stems: AudioBuffer, mix: Mix, masterVolume = 1): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(stems.duration * 44100), 44100), source = ctx.createBufferSource(); source.buffer = stems; wireMix(ctx, source, mix, masterVolume); source.start(); return ctx.startRendering();
}

export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const frames = channels[0].length, count = channels.length, bytes = new Uint8Array(44 + frames * count * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, str: string) => [...str].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * count * 2, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) { const sample = Math.max(-1, Math.min(1, channels[channel][frame])); view.setInt16(44 + (frame * count + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); }
  return bytes;
}
