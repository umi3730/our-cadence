import { activeTrack, type Score, type Mix, type Voice } from './music.ts';

const PPQ = 480;
const text = (s: string) => [...new TextEncoder().encode(s)];
const u16 = (n: number) => [n >>> 8 & 255, n & 255];
const u32 = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
function vlq(value: number): number[] { const result = [value & 127];while ((value = Math.floor(value / 128)) > 0) result.unshift((value & 127) | 128);return result; }
function chunk(tag: string, bytes: number[]) { return [...text(tag), ...u32(bytes.length), ...bytes]; }
const program: Record<Voice, number> = { keys: 4, bell: 10, pluck: 24, pad: 48, bass: 33, drums: 0 };

/** Standard MIDI format 1. Conductor + four named tracks; drums use channel 10. */
export function encodeMidi(score: Score, mix: Mix): Uint8Array {
  const tempo = Math.round(60_000_000 / score.bpm), end = Math.round(score.beats * PPQ);
  const conductor = [0, 0xff, 0x51, 3, ...u32(tempo).slice(1), 0, 0xff, 0x58, 4, 4, 2, 24, 8, ...vlq(end), 0xff, 0x2f, 0];
  const chunks = [chunk('MTrk', conductor)];
  score.tracks.forEach((track, i) => {
    const channel = track.voice === 'drums' ? 9 : i;
    const name = text(track.name);
    const data = [0, 0xff, 3, ...vlq(name.length), ...name, 0, 0xc0 | channel, program[track.voice], 0, 0xb0 | channel, 7, Math.round(mix[i].volume * 127)];
    const events: { tick: number; off: boolean; pitch: number; velocity: number }[] = [];
    if (activeTrack(mix, i) && mix[i].volume > 0) for (const n of track.notes) {
      events.push({ tick: Math.round(n.beat * PPQ), off: false, pitch: n.pitch, velocity: Math.max(1, Math.round(n.velocity * 110)) });
      events.push({ tick: Math.round((n.beat + n.duration) * PPQ), off: true, pitch: n.pitch, velocity: 0 });
    }
    events.sort((a, b) => a.tick - b.tick || Number(b.off) - Number(a.off) || a.pitch - b.pitch);
    let tick = 0;
    for (const event of events) { data.push(...vlq(event.tick - tick), (event.off ? 0x80 : 0x90) | channel, event.pitch, event.velocity);tick = event.tick; }
    data.push(...vlq(Math.max(0, end - tick)), 0xff, 0x2f, 0);chunks.push(chunk('MTrk', data));
  });
  return new Uint8Array([...chunk('MThd', [...u16(1), ...u16(chunks.length), ...u16(PPQ)]), ...chunks.flat()]);
}
