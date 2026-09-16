import test from 'node:test';
import assert from 'node:assert/strict';
import { generateThemes, arrange, defaultMix, SCENES, MOODS, scoreSeconds } from '../lib/music.ts';
import { encodeMidi } from '../lib/midi.ts';
import { encodeWav } from '../lib/audio.ts';
import { defaultSettings, draftSchema, library, parseLibrary, snapshot, EXAMPLES, safeFilename } from '../lib/project.ts';

function makeDraft() {
  const profile = EXAMPLES[0], candidates = generateThemes(profile, 0);
  return { profile: structuredClone(profile), candidates, theme: candidates[0], take: 0, scene: 'daily', settings: defaultSettings(), loop: false };
}
// Independent byte reader for standard MIDI chunks and events.
function readMidi(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), ascii = (start, n) => new TextDecoder().decode(bytes.slice(start, start + n));
  assert.equal(ascii(0, 4), 'MThd');assert.equal(view.getUint32(4), 6);
  const tracks = [], result = { format: view.getUint16(8), count: view.getUint16(10), ppq: view.getUint16(12), tracks };
  let pos = 14;
  const variable = () => { let n = 0, b;do { b = bytes[pos++];n = n * 128 + (b & 127); } while (b & 128);return n; };
  while (pos < bytes.length) {
    assert.equal(ascii(pos, 4), 'MTrk');const end = pos + 8 + view.getUint32(pos + 4);pos += 8;
    let tick = 0;const events = [];
    while (pos < end) {
      tick += variable();const status = bytes[pos++];
      if (status === 255) { const kind = bytes[pos++], length = variable(), data = [...bytes.slice(pos, pos + length)];pos += length;events.push({ tick, kind, data, meta: true }); }
      else { const kind = status >> 4, channel = status & 15, data = [bytes[pos++]];if (![12, 13].includes(kind)) data.push(bytes[pos++]);events.push({ tick, kind, channel, data }); }
    }
    assert.equal(pos, end);tracks.push(events);
  }
  assert.equal(tracks.length, result.count);return result;
}

test('themes are reproducible, distinct, and constrained to four bars and the chosen scale', () => {
  for (const profile of EXAMPLES) {
    const a = generateThemes(profile, 0);assert.deepEqual(a, generateThemes(profile, 0));assert.equal(new Set(a.map(t => JSON.stringify(t.notes))).size, 3);
    assert.notDeepEqual(a, generateThemes(profile, 1));
    for (const theme of a) for (const n of theme.notes) { assert.ok(n.beat >= 0 && n.beat + n.duration <= 16);assert.ok(MOODS[profile.mood].scale.includes((n.pitch - theme.root) % 12)); }
    assert.equal(draftSchema.safeParse({ ...makeDraft(), profile, candidates: a, theme: a[0] }).success, true);
  }
});

test('every scene repeats the exact selected theme, without changing pitch, rhythm or duration', () => {
  for (const profile of EXAMPLES) for (const theme of generateThemes(profile, 0)) for (const [scene, config] of Object.entries(SCENES)) {
    const score = arrange(theme, scene, config.bpm, config.voice);
    assert.equal(score.tracks.length, 4);assert.equal(score.beats, 64);
    for (let repeat = 0; repeat < 4; repeat++) {
      assert.deepEqual(score.tracks[0].notes.slice(repeat * theme.notes.length, (repeat + 1) * theme.notes.length).map(n => ({ ...n, beat: n.beat - repeat * 16 })), theme.notes);
    }
    for (const track of score.tracks) { assert.ok(track.notes.length > 0);for (const n of track.notes) assert.ok(n.beat + n.duration <= 64 && n.pitch >= 0 && n.pitch <= 127); }
  }
});

test('MIDI preserves note-on/off timing, tempo, four tracks and percussion channel', () => {
  const draft = makeDraft(), score = arrange(draft.theme, 'battle', 136, 'pluck'), parsed = readMidi(encodeMidi(score, defaultMix()));
  assert.equal(parsed.format, 1);assert.equal(parsed.count, 5);assert.equal(parsed.ppq, 480);
  const tempo = parsed.tracks[0].find(e => e.kind === 81).data;assert.equal((tempo[0] << 16) + (tempo[1] << 8) + tempo[2], Math.round(60_000_000 / 136));
  for (let i = 0; i < 4; i++) {
    const ons = parsed.tracks[i + 1].filter(e => e.kind === 9 && !e.meta), offs = parsed.tracks[i + 1].filter(e => e.kind === 8 && !e.meta);
    assert.equal(ons.length, score.tracks[i].notes.length);assert.equal(ons.length, offs.length);
    const expected = score.tracks[i].notes.map(n => [Math.round(n.beat * 480), n.pitch]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);assert.deepEqual(ons.map(e => [e.tick, e.data[0]]), expected);
    const endings = score.tracks[i].notes.map(n => [Math.round((n.beat + n.duration) * 480), n.pitch]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);assert.deepEqual(offs.map(e => [e.tick, e.data[0]]), endings);
    assert.equal(parsed.tracks[i + 1].at(-1).tick, 64 * 480);
    if (i === 3) assert.ok(ons.every(e => e.channel === 9));
  }
});

test('MIDI respects mute and solo; silence still retains named tracks', () => {
  const score = arrange(makeDraft().theme, 'daily', 100, 'keys'), mix = defaultMix();mix[2].solo = true;
  let parsed = readMidi(encodeMidi(score, mix));
  assert.deepEqual(parsed.tracks.slice(1).map(t => t.some(e => e.kind === 9 && !e.meta)), [false, false, true, false]);
  mix[2].mute = true;parsed = readMidi(encodeMidi(score, mix));assert.ok(parsed.tracks.slice(1).every(t => !t.some(e => e.kind === 9 && !e.meta)));
});

test('WAV is interleaved signed 16-bit PCM with valid sizes and bounded samples', () => {
  const bytes = encodeWav([new Float32Array([0, 1, -1, 2]), new Float32Array([0.25, -0.25, 0, -2])], 44100), view = new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');assert.equal(view.getUint32(4, true) + 8, bytes.length);assert.equal(view.getUint16(22, true), 2);assert.equal(view.getUint32(24, true), 44100);assert.equal(view.getUint32(40, true), 16);
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true)), [0, 8192, 32767, -8192, -32768, 0, 32767, -32768]);
});

test('saved notes/settings round-trip exactly and revision snapshots are immutable', () => {
  const draft = makeDraft();draft.settings.memory.bpm = 91;draft.settings.battle.mix[1].volume = 0.13;
  const version = snapshot(draft);draft.theme.notes[0].pitch += 12;
  assert.notEqual(version.draft.theme.notes[0].pitch, draft.theme.notes[0].pitch);
  const restored = parseLibrary(JSON.stringify(library(draft, [version])));assert.deepEqual(restored.draft, draft);assert.deepEqual(restored.versions[0], version);
  assert.equal(scoreSeconds(arrange(restored.draft.theme, 'memory', restored.draft.settings.memory.bpm, 'bell')), 64 * 60 / 91);
});

test('malformed, unbounded and future-version imports are rejected before touching state', () => {
  assert.throws(() => parseLibrary('not json'));
  for (const mutate of [x => { x.schemaVersion = 999; }, x => { x.draft.theme.notes[0].duration = 100; }, x => { x.draft.settings.daily.bpm = 0; }, x => { x.draft.settings.daily.mix = []; }, x => { x.draft.candidates = []; }, x => { x.draft.theme.scale = [0, 1, 1, 1, 1, 1, 1]; }]) {
    const value = library(makeDraft(), []);mutate(value);assert.throws(() => parseLibrary(JSON.stringify(value)));
  }
  assert.throws(() => parseLibrary(' '.repeat(2_000_001)));
  assert.equal(safeFilename('../角色:试音'), '.._角色_试音');
});
