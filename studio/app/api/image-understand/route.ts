export const runtime = 'nodejs';

const MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-5.6-luna';
const MAX_IMAGE_BYTES = 8_000_000;

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === 'output_text' && typeof content?.text === 'string') parts.push(content.text);
  return parts.join('\n');
}
function parseJsonLoose(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('视觉模型没有返回可解析的 JSON');
  }
}
function clamp(v: unknown, fallback = 50) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback; }
function normalize(raw: any) {
  const identity = raw?.identity ?? {};
  const normalizeStrings = (value: any, max = 8) => Array.isArray(value) ? value.filter((v: any) => typeof v === 'string' && v.trim()).slice(0, max).map((v: string) => v.trim()) : [];
  return {
    provider: 'openai-vlm',
    summary: String(raw?.summary ?? '').slice(0, 600),
    identity: {
      type: ['character', 'meme', 'scene', 'object', 'unknown'].includes(identity?.type) ? identity.type : 'unknown',
      name: identity?.name ? String(identity.name).slice(0, 120) : undefined,
      franchise: identity?.franchise ? String(identity.franchise).slice(0, 120) : undefined,
      confidence: clamp(identity?.confidence, 0),
    },
    subject: {
      description: String(raw?.subject?.description ?? '').slice(0, 500),
      elements: normalizeStrings(raw?.subject?.elements),
      emotions: normalizeStrings(raw?.subject?.emotions),
      action: String(raw?.subject?.action ?? '').slice(0, 160),
    },
    background: {
      description: String(raw?.background?.description ?? '').slice(0, 500),
      elements: normalizeStrings(raw?.background?.elements),
      setting: normalizeStrings(raw?.background?.setting),
    },
    style: normalizeStrings(raw?.style),
    memeContext: raw?.memeContext ? String(raw.memeContext).slice(0, 500) : undefined,
    musicAssociations: Array.isArray(raw?.musicAssociations) ? raw.musicAssociations.slice(0, 8).map((item: any) => ({
      title: String(item?.title ?? '').slice(0, 160),
      artist: item?.artist ? String(item.artist).slice(0, 160) : undefined,
      confidence: clamp(item?.confidence, 0),
      reason: String(item?.reason ?? '').slice(0, 320),
      sourceHint: item?.sourceHint ? String(item.sourceHint).slice(0, 240) : undefined,
    })).filter((item: any) => item.title) : [],
    target: {
      energy: clamp(raw?.target?.energy), warmth: clamp(raw?.target?.warmth), tension: clamp(raw?.target?.tension), mystery: clamp(raw?.target?.mystery), brightness: clamp(raw?.target?.brightness), elegance: clamp(raw?.target?.elegance), aggression: clamp(raw?.target?.aggression),
      bpmMin: Math.max(45, Math.min(190, Number(raw?.target?.bpmMin) || 75)), bpmMax: Math.max(50, Math.min(210, Number(raw?.target?.bpmMax) || 135)),
      genres: normalizeStrings(raw?.target?.genres), instruments: normalizeStrings(raw?.target?.instruments), descriptors: normalizeStrings(raw?.target?.descriptors),
    },
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ available: false, reason: 'OPENAI_API_KEY 未配置；当前只使用本地视觉分析。' });
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: '缺少图片文件' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: '用于高级识图的图片不能超过 8 MB' }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const imageUrl = `data:${file.type};base64,${bytes.toString('base64')}`;
  const local = String(form.get('local') ?? '').slice(0, 5000);
  const prompt = `你是一个“图像→音乐”分析器。请把前景主体和背景场景分开理解，不要只看颜色。\n\n重要任务：\n1. 判断图中主体是谁/是什么。若是已知游戏、动漫角色或常见 meme/梗图，只有把握较高时才给出名称、作品；不确定就写 unknown。\n2. 分别描述 SUBJECT（人物/前景）与 BACKGROUND（场景/背景）中的具体元素、动作、情绪、环境。透明背景要明确说明。\n3. 如果识别为已知角色或 meme，请结合你的知识，并在需要时使用 web search，寻找中文互联网尤其 Bilibili 上经常与它搭配的 BGM/歌曲/梗曲。musicAssociations 必须是真实歌曲名，不能编造。\n4. 独立计算一组目标 Music Profile。它表示“这张图最适合的音乐”，不是检索关键词：energy/warmth/tension/mystery/brightness/elegance/aggression 都是 0-100，并给 BPM 范围、genres、instruments、descriptors。\n5. meme 图优先考虑梗的语境和常见配乐，不要把截图颜色当作主要依据。游戏角色优先考虑角色身份、性格、战斗/剧情气质，再结合画面。\n\n本地视觉测量（只能当辅助，不可替代语义理解）：${local}\n\n只返回 JSON，不要 markdown，结构：\n{\n  "summary":"...",\n  "identity":{"type":"character|meme|scene|object|unknown","name":"可空","franchise":"可空","confidence":0},\n  "subject":{"description":"...","elements":["..."],"emotions":["..."],"action":"..."},\n  "background":{"description":"...","elements":["..."],"setting":["..."]},\n  "style":["..."],\n  "memeContext":"可空",\n  "musicAssociations":[{"title":"真实歌曲","artist":"可空","confidence":0,"reason":"为什么经常搭配或为什么高度相关","sourceHint":"可空，B站/其他出处线索"}],\n  "target":{"energy":0,"warmth":0,"tension":0,"mystery":0,"brightness":0,"elegance":0,"aggression":0,"bpmMin":70,"bpmMax":130,"genres":["..."],"instruments":["..."],"descriptors":["..."]}\n}`;
  const body: any = {
    model: MODEL,
    reasoning: { effort: 'low' },
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: imageUrl }] }],
    tools: [{ type: 'web_search' }],
  };
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
  if (!response.ok) return Response.json({ available: false, reason: `高级识图服务返回 ${response.status}` }, { status: 200 });
  const payload = await response.json();
  try { return Response.json({ available: true, analysis: normalize(parseJsonLoose(extractOutputText(payload))) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ available: false, reason: error instanceof Error ? error.message : '高级识图解析失败' }); }
}
