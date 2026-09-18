import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionSchema, savedCompositionSchema, compositionKey, compositionScore } from '../lib/ai-composition.ts';
import { mixForPlayback, readMasterVolume } from '../lib/playback-settings.ts';
import { generateThemes, defaultMix } from '../lib/music.ts';
import { EXAMPLES, defaultSettings, library, parseLibrary } from '../lib/project.ts';
import { encodeMidi } from '../lib/midi.ts';
import { GET, POST } from '../app/api/compose/route.ts';

const profile = EXAMPLES[0], theme = generateThemes(profile, 0)[0];
const input = { profile, theme, scene: 'daily', bpm: 100, voice: 'keys' };
function composition() {
  return {
    title: '测试乐谱', summary: '只用于校验，不是真实模型结果。', bpm: 100, beats: 64,
    sections: ['引子', '主题', '变化', '收尾'].map((name, i) => ({ name, startBeat: i * 16, description: name })),
    tracks: [
      { id: 'melody', name: '旋律', voice: 'keys', notes: Array.from({ length: 16 }, (_, i) => ({ pitch: 60 + Math.floor(i / 4) * 2 + i % 3, beat: i * 4, duration: 2, velocity: .7 })) },
      { id: 'chords', name: '和弦', voice: 'pad', notes: [0, 16, 32, 48].flatMap(beat => [48, 52, 55].map(pitch => ({ pitch, beat, duration: 8, velocity: .4 }))) },
      { id: 'bass', name: '贝斯', voice: 'bass', notes: [0, 8, 16, 24, 32, 40, 48, 56].map(beat => ({ pitch: 36, beat, duration: 4, velocity: .5 })) },
      { id: 'drums', name: '鼓', voice: 'drums', notes: Array.from({ length: 32 }, (_, i) => ({ pitch: i % 2 ? 38 : 36, beat: i * 2, duration: .25, velocity: .5 })) },
    ],
  };
}
const request = (body = input, signal) => new Request('http://local.test/api/compose', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://local.test' }, body: JSON.stringify(body), signal });
const providerReply = (score = composition()) => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(score) }] }] });

test('score validation rejects out-of-range notes, invalid drums, duplicate tracks and mechanical repetition', () => {
  assert.equal(compositionSchema.safeParse(composition()).success, true);
  for (const mutate of [
    score => { score.tracks[0].notes[0].beat = 63; score.tracks[0].notes[0].duration = 4; },
    score => { score.tracks[3].notes[0].pitch = 90; },
    score => { score.tracks[1].id = 'melody'; },
    score => { score.sections[2].startBeat = 16; },
    score => { score.tracks[0].notes.push({ ...score.tracks[0].notes[0] }); },
    score => { for (const track of score.tracks) { const first = track.notes.filter(n => n.beat < 16);track.notes = [0, 16, 32, 48].flatMap(offset => first.map(n => ({ ...n, beat: n.beat + offset }))); } },
  ]) { const score = composition(); mutate(score);assert.equal(compositionSchema.safeParse(score).success, false); }
});

test('AI scores round-trip in projects and snapshots while old projects still load', () => {
  const candidates = generateThemes(profile, 0);
  const saved = savedCompositionSchema.parse({ ...composition(), model: 'gpt-6-astra', scene: 'daily', createdAt: new Date().toISOString(), sourceKey: compositionKey(profile, theme, 'daily') });
  const draft = { profile, take: 0, candidates, theme, scene: 'daily', settings: defaultSettings(), loop: false };
  const aiDraft = { ...draft, aiScores: { daily: saved }, arrangementMode: 'ai' };
  assert.deepEqual(parseLibrary(JSON.stringify(library(aiDraft, []))).draft.aiScores.daily, saved);
  assert.deepEqual(parseLibrary(JSON.stringify(library(draft, []))).draft, draft);
  const invalid = structuredClone(aiDraft);invalid.aiScores.daily.scene = 'battle';
  assert.throws(() => parseLibrary(JSON.stringify(library(invalid, []))));
  const score = compositionScore(saved, 132, 'bell');
  assert.equal(score.bpm, 132);assert.equal(score.tracks[0].voice, 'bell');assert.equal(saved.bpm, 100);
  const midi = encodeMidi(score, defaultMix());
  assert.equal(new TextDecoder().decode(midi.subarray(0, 4)), 'MThd');
  assert.equal(new DataView(midi.buffer).getUint16(10), 5);
  assert.notEqual(compositionKey({ ...profile, description: '另一段故事' }, theme, 'daily'), saved.sourceKey);
  assert.notEqual(compositionKey({ ...profile, image: { fingerprint: 'image-a' } }, theme, 'daily'), compositionKey({ ...profile, image: { fingerprint: 'image-b' } }, theme, 'daily'));
});

test('fresh master volume is audible and theme auditions ignore arrangement mute/solo', () => {
  assert.equal(readMasterVolume(null), 1);assert.equal(readMasterVolume(''), 1);assert.equal(readMasterVolume('invalid'), 1);
  assert.equal(readMasterVolume('0'), 0);assert.equal(readMasterVolume('1.4'), 1.4);
  const mix = defaultMix();mix[0].mute = true;mix[2].solo = true;
  const preview = mixForPlayback('theme-test', mix);
  assert.ok(preview.every(track => !track.mute && !track.solo));
  assert.equal(mixForPlayback('arrangement', mix)[0].mute, true);
  const isolated = mixForPlayback('track-0', mix);
  assert.equal(isolated[0].mute, false);assert.ok(isolated.slice(1).every(t => t.mute));
  assert.ok(isolated.every(t => !t.solo));assert.equal(mix[0].mute, true);
});

test('new lead instruments preserve notes and stored scores while invalid chord roles fail', () => {
  for (const voice of ['flute', 'violin', 'marimba']) {
    const source = composition();source.tracks[0].voice = voice;
    const saved = savedCompositionSchema.parse({ ...source, model: 'gpt-6-astra', scene: 'daily', createdAt: new Date().toISOString(), sourceKey: compositionKey(profile, theme, 'daily') });
    const changed = compositionScore(saved, 100, voice);
    assert.equal(changed.tracks[0].voice, voice);
    assert.deepEqual(changed.tracks[0].notes, source.tracks[0].notes);
    assert.equal(changed.tracks.length, 4);
  }
  const invalid = composition();invalid.tracks[1].voice = 'flute';
  assert.equal(compositionSchema.safeParse(invalid).success, false);
  invalid.tracks[1].voice = 'marimba';assert.equal(compositionSchema.safeParse(invalid).success, true);
});

test('composer API validates inputs and outputs, protects credentials, and rejects duplicate requests', async t => {
  const oldProvider = process.env.AI_COMPOSER_PROVIDER;
  process.env.AI_COMPOSER_PROVIDER = 'openai';
  t.after(() => { if (oldProvider === undefined) delete process.env.AI_COMPOSER_PROVIDER;else process.env.AI_COMPOSER_PROVIDER = oldProvider; });
  const oldKey = process.env.OPENAI_API_KEY, oldFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY = oldKey; });
  let calls = 0, sent;
  globalThis.fetch = async (_url, options) => { calls++;sent = JSON.parse(options.body);return providerReply(); };
  delete process.env.OPENAI_API_KEY;
  assert.equal((await GET()).status, 200);assert.equal((await POST(request())).status, 503);assert.equal(calls, 0);
  process.env.OPENAI_API_KEY = 'unit-test-placeholder';
  assert.equal((await POST(request({ ...input, bpm: 999 }))).status, 400);
  const foreign = new Request('http://local.test/api/compose', { method: 'POST', headers: { Origin: 'https://elsewhere.test' }, body: JSON.stringify(input) });
  assert.equal((await POST(foreign)).status, 403);assert.equal(calls, 0);
  const response = await POST(request());const result = await response.json();
  assert.equal(response.status, 200);assert.equal(result.composition.sourceKey, compositionKey(profile, theme, 'daily'));
  assert.equal(sent.model, 'gpt-6-astra');assert.equal(sent.text.format.strict, true);assert.equal(sent.store, false);
  assert.match(sent.instructions, /Do NOT repeat/);
  assert.ok(!JSON.stringify(result).includes('unit-test-placeholder'));
  globalThis.fetch = async () => Response.json({ status: 'incomplete', output_text: JSON.stringify(composition()) });
  assert.equal((await POST(request())).status, 502);
  globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] });
  assert.equal((await POST(request())).status, 422);
  globalThis.fetch = async () => Response.json({ error: { message: 'Private upstream diagnostics' } }, { status: 401 });
  const denied = await POST(request());assert.equal(denied.status, 502);assert.ok(!(await denied.text()).includes('Private upstream diagnostics'));
  globalThis.fetch = async () => { const score = composition();score.tracks[0].notes[0].duration = 70;return providerReply(score); };
  assert.equal((await POST(request())).status, 502);
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  globalThis.fetch = async () => { began();return new Promise(resolve => { release = resolve; }); };
  const pending = POST(request());await started;
  const concurrent = await POST(request());assert.equal(concurrent.status, 429);
  release(providerReply());assert.equal((await pending).status, 200);
  const controller = new AbortController();
  globalThis.fetch = async (_url, options) => { controller.abort();options.signal.throwIfAborted();return providerReply(); };
  assert.equal((await POST(request(input, controller.signal))).status, 499);
  globalThis.fetch = async () => providerReply();assert.equal((await POST(request())).status, 200);
});

test('company gateway isolates keys, sends images and strict JSON schema, and fails closed', async t => {
  const oldFetch = globalThis.fetch;
  const names = ['AI_COMPOSER_PROVIDER', 'YOOZOO_API_KEY', 'OPENAI_API_KEY'];
  const old = names.map(name => process.env[name]);
  t.after(() => { globalThis.fetch = oldFetch;names.forEach((name, i) => { if (old[i] === undefined) delete process.env[name];else process.env[name] = old[i]; }); });
  process.env.AI_COMPOSER_PROVIDER = 'yoozoo';
  process.env.OPENAI_API_KEY = 'personal-key-must-not-be-used';
  delete process.env.YOOZOO_API_KEY;
  let calls = 0, sent, sentUrl, authorization;
  const chatReply = (overrides = {}) => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(composition()) }, ...overrides }] });
  globalThis.fetch = async (url, options) => { calls++;assert.equal(options.redirect, 'manual');sentUrl = url;authorization = options.headers.Authorization;sent = JSON.parse(options.body);return chatReply(); };
  assert.equal((await GET()).status, 200);
  assert.equal((await (await GET()).json()).available, false);
  assert.equal((await POST(request())).status, 503);assert.equal(calls, 0);
  process.env.YOOZOO_API_KEY = 'company-test-key';
  const thumbnail = 'data:image/png;base64,aGVsbG8=';
  const body = { ...input, profile: { ...profile, image: { fingerprint: 'test-image', thumbnail, palette: ['#abcdef'], visual: { brightness: 50, saturation: 50, contrast: 50, complexity: 50, warmth: 50 } } } };
  const response = await POST(request(body));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.composition.provider, 'yoozoo');
  assert.equal(savedCompositionSchema.parse(result.composition).provider, 'yoozoo');
  assert.equal(sentUrl, 'https://ai-gw-cn.uuzu.com/v1/chat/completions');
  assert.equal(authorization, 'Bearer company-test-key');
  assert.equal(sent.model, 'gpt-6-astra');assert.equal(sent.stream, false);
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.equal(sent.max_completion_tokens, 18000);
  assert.equal(sent.messages[0].role, 'system');
  assert.equal(JSON.parse(sent.messages[1].content[0].text).character.story, profile.description);
  assert.deepEqual(sent.messages[1].content[1], { type: 'image_url', image_url: { url: thumbnail, detail: 'low' } });
  assert.ok(!JSON.stringify(result).includes('company-test-key'));
  for (const voice of ['flute', 'violin', 'marimba']) {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(JSON.parse(body.messages[1].content[0].text).melodyVoice, voice);
      assert.ok(body.response_format.json_schema.schema.properties.tracks.items.properties.voice.enum.includes(voice));
      const score = composition();score.tracks[0].voice = voice;
      return chatReply({ message: { content: JSON.stringify(score) } });
    };
    const response = await POST(request({ ...input, voice }));
    assert.equal(response.status, 200);assert.equal((await response.json()).composition.tracks[0].voice, voice);
  }
  for (const reason of ['length', 'tool_calls']) {
    globalThis.fetch = async () => chatReply({ finish_reason: reason });
    assert.equal((await POST(request())).status, 502);
  }
  globalThis.fetch = async () => chatReply({ message: { content: null, refusal: 'refused' } });
  assert.equal((await POST(request())).status, 422);
  globalThis.fetch = async () => chatReply({ finish_reason: 'content_filter' });
  assert.equal((await POST(request())).status, 422);
  const invalid = composition();invalid.tracks[0].notes[0].pitch = 200;
  globalThis.fetch = async () => chatReply({ message: { content: JSON.stringify(invalid) } });
  assert.equal((await POST(request())).status, 502);
  globalThis.fetch = async () => Response.json({ choices: [] });
  assert.equal((await POST(request())).status, 502);
  let failures = 0;
  globalThis.fetch = async () => { failures++;return Response.json({ error: { type: 'insufficient_quota', code: 'credit_balance_exhausted', message: 'private diagnostics company-test-key' } }, { status: 429 }); };
  const failure = await POST(request());const message = await failure.text();
  assert.equal(failure.status, 502);assert.match(message, /余额或配额不足/);
  assert.ok(!message.includes('company-test-key'));assert.equal(failures, 1);
  let redirects = 0;
  globalThis.fetch = async () => { redirects++;return new Response(null, { status: 307, headers: { Location: 'https://untrusted.invalid' } }); };
  assert.equal((await POST(request())).status, 502);assert.equal(redirects, 1);
  process.env.AI_COMPOSER_PROVIDER = 'typo';
  assert.equal((await (await GET()).json()).available, false);
  assert.equal((await POST(request())).status, 503);assert.equal(failures, 1);
});
