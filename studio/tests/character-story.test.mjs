import test from 'node:test';
import assert from 'node:assert/strict';
import { musicWithStory } from '../lib/character-story.ts';
import { generateThemes } from '../lib/music.ts';
import { EXAMPLES, defaultSettings, library, parseLibrary } from '../lib/project.ts';

const baseline = { energy: 50, warmth: 50, tension: 50, mystery: 50, brightness: 50, elegance: 50, aggression: 50, hue: 220 };

test('story fallback changes direction without mutating or accumulating the image baseline', () => {
  const original = structuredClone(baseline);
  const fighter = musicWithStory(baseline, '她是经历征战的战士，决心复仇。');
  const healer = musicWithStory(baseline, '她很温柔，守护伙伴，治愈旅途上的人。');
  assert.ok(fighter.music.aggression > healer.music.aggression);
  assert.ok(healer.music.warmth > fighter.music.warmth);
  assert.deepEqual(musicWithStory(baseline, '她是经历征战的战士，决心复仇。'), fighter);
  assert.deepEqual(musicWithStory(baseline, '').music, baseline);
  assert.deepEqual(baseline, original);
  assert.equal(musicWithStory(baseline, '她不喜欢战斗，拒绝复仇。').clues.length, 0);
});

test('image baseline and story provenance survive project export and import', () => {
  const profile = { ...EXAMPLES[0], image: { fingerprint: 'story-fixture', thumbnail: '', palette: [], visual: { brightness: 50, saturation: 50, contrast: 50, complexity: 50, warmth: 50 }, musicBaseline: baseline, storyAnalyzed: true } };
  const candidates = generateThemes(profile, 0);
  const draft = { profile, take: 0, candidates, theme: candidates[0], scene: 'daily', settings: defaultSettings(), loop: false };
  const restored = parseLibrary(JSON.stringify(library(draft, [])));
  assert.deepEqual(restored.draft.profile.image.musicBaseline, baseline);
  assert.equal(restored.draft.profile.image.storyAnalyzed, true);
});

test('joint analysis sends the character story with the image (mocked provider)', async t => {
  const oldFetch = globalThis.fetch, oldKey = process.env.OPENAI_API_KEY;
  t.after(() => { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; });
  process.env.OPENAI_API_KEY = 'unit-test-placeholder';
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); sent = JSON.parse(options.body);
    return Response.json({ output_text: JSON.stringify({ summary: '测试联合分析', subject: { elements: ['角色'.repeat(100)] }, target: { energy: 70 } }) });
  };
  const { POST } = await import('../app/api/image-understand/route.ts');
  const form = new FormData();
  form.append('image', new Blob(['fixture'], { type: 'image/png' }), 'fixture.png');
  form.append('name', '测试角色');form.append('story', '失去故乡后守护伙伴的战士');
  const response = await POST(new Request('http://local.test/api/image-understand', { method: 'POST', body: form }));
  const result = await response.json();
  assert.equal(result.available, true);
  assert.equal(result.analysis.subject.elements[0].length, 80);
  assert.match(sent.input[0].content[0].text, /失去故乡后守护伙伴的战士/);
  assert.match(sent.input[0].content[0].text, /用户原创设定/);
  assert.equal(sent.input[0].content[1].type, 'input_image');
});
