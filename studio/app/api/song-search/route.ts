type MusicProfile = {
  energy: number; warmth: number; tension: number; mystery: number;
  brightness: number; elegance: number; aggression: number; hue: number;
};
type Understanding = { identity?: { type?: string; name?: string; franchise?: string; confidence?: number }; musicAssociations?: { title?: string; artist?: string; confidence?: number; reason?: string }[]; target?: { genres?: string[]; instruments?: string[]; descriptors?: string[] } };
type Input = { music?: MusicProfile; semantics?: string[]; country?: string; direction?: string; understanding?: Understanding };
type ProviderName = 'Apple Music' | 'Deezer' | 'QQ音乐' | '网易云音乐' | '哔哩哔哩';
type OnlineSong = {
  id: string; title: string; artist: string; album?: string; genre?: string; year?: number;
  artwork?: string; url?: string; previewUrl?: string; provider: ProviderName; score: number; reasons: string[];
};
type ProviderLink = { provider: ProviderName; url: string; query: string };

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const safe = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? clamp(v) : 50;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153 Safari/537.36';
function validateMusic(value: unknown): MusicProfile | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return { energy: safe(v.energy), warmth: safe(v.warmth), tension: safe(v.tension), mystery: safe(v.mystery), brightness: safe(v.brightness), elegance: safe(v.elegance), aggression: safe(v.aggression), hue: typeof v.hue === 'number' ? clamp(v.hue, 0, 360) : 180 };
}

const DIRECTIONS: Record<string, { en: string; zh: string }> = {
  character: { en: 'character theme game ost', zh: '角色主题 游戏原声' },
  daily: { en: 'bright daily anime instrumental', zh: '轻快 日常 动画 纯音乐' },
  memory: { en: 'emotional piano memory soundtrack', zh: '回忆 抒情 钢琴 纯音乐' },
  battle: { en: 'battle electronic game soundtrack', zh: '战斗 电子 游戏原声' },
  mechanical: { en: 'industrial electronic mechanical soundtrack', zh: '工业 机械 电子 纯音乐' },
  dreamy: { en: 'dreamy ambient ethereal instrumental', zh: '梦幻 空灵 氛围 纯音乐' },
  suspense: { en: 'dark suspense ambient soundtrack', zh: '黑暗 悬疑 氛围 原声' },
  retro: { en: 'retro synthwave electronic instrumental', zh: '复古 合成器 电子 纯音乐' },
  'anime-op': { en: 'anime opening japanese rock energetic', zh: '动画 OP 日系摇滚 高燃' },
};
function profileQuery(m: MusicProfile, semantics: string[], direction?: string) {
  const chosen = direction && DIRECTIONS[direction];
  if (chosen) return chosen;
  const tags = new Set(semantics);
  if (m.aggression >= 72 || (m.energy >= 78 && m.tension >= 62)) return { en: 'battle rock electronic soundtrack', zh: '战斗 高燃 摇滚 电子' };
  if (m.energy >= 72 && m.brightness >= 58) return { en: 'anime pop rock energetic', zh: '动画 OP 日系 流行 摇滚' };
  if (m.mystery >= 70 && m.brightness <= 42) return { en: 'dark ambient suspense soundtrack', zh: '黑暗 悬疑 氛围 纯音乐' };
  if (m.elegance >= 72 && m.energy <= 48) return { en: 'emotional piano orchestral soundtrack', zh: '抒情 钢琴 弦乐 原声' };
  if (tags.has('红黑调') || tags.has('强轮廓')) return { en: 'stylish action electronic soundtrack', zh: '角色 战斗 电子 风格化' };
  if (tags.has('霓虹')) return { en: 'synthwave neon night instrumental', zh: '霓虹 合成器 电子 夜景' };
  if (m.warmth <= 35 || m.tension >= 70) return { en: 'electronic cinematic instrumental', zh: '电子 电影感 纯音乐' };
  return { en: 'cinematic character soundtrack', zh: '角色主题 电影感 原声' };
}
function searchLinks(q: { en: string; zh: string }, country: string): ProviderLink[] {
  const encEn = encodeURIComponent(q.en), encZh = encodeURIComponent(q.zh);
  return [
    { provider: 'Apple Music', query: q.en, url: `https://music.apple.com/${country.toLowerCase()}/search?term=${encEn}` },
    { provider: 'Deezer', query: q.en, url: `https://www.deezer.com/search/${encEn}` },
    { provider: 'QQ音乐', query: q.zh, url: `https://y.qq.com/n/ryqq/search?w=${encZh}&t=song` },
    { provider: '网易云音乐', query: q.zh, url: `https://music.163.com/#/search/m/?s=${encZh}&type=1` },
    { provider: '哔哩哔哩', query: `${q.zh} BGM`, url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${q.zh} BGM`)}` },
  ];
}
function targetForGenre(genre = '') {
  const g = genre.toLowerCase();
  if (/electronic|dance|techno|house/.test(g)) return { energy: 76, warmth: 24, tension: 54, mystery: 45, brightness: 56, elegance: 45, aggression: 44 };
  if (/rock|metal|punk/.test(g)) return { energy: 84, warmth: 32, tension: 68, mystery: 30, brightness: 50, elegance: 38, aggression: 75 };
  if (/classical|orchestra/.test(g)) return { energy: 36, warmth: 64, tension: 42, mystery: 48, brightness: 52, elegance: 90, aggression: 10 };
  if (/soundtrack|score/.test(g)) return { energy: 54, warmth: 50, tension: 56, mystery: 58, brightness: 46, elegance: 74, aggression: 30 };
  if (/jazz/.test(g)) return { energy: 52, warmth: 64, tension: 44, mystery: 30, brightness: 56, elegance: 78, aggression: 20 };
  if (/pop|j-pop/.test(g)) return { energy: 72, warmth: 54, tension: 34, mystery: 24, brightness: 75, elegance: 54, aggression: 30 };
  return { energy: 56, warmth: 50, tension: 46, mystery: 44, brightness: 52, elegance: 56, aggression: 30 };
}
function scoreByGenre(m: MusicProfile, genre: string, rank: number) {
  const t = targetForGenre(genre);
  const distance = Math.abs(m.energy - t.energy) * .2 + Math.abs(m.warmth - t.warmth) * .12 + Math.abs(m.tension - t.tension) * .18 + Math.abs(m.mystery - t.mystery) * .16 + Math.abs(m.brightness - t.brightness) * .1 + Math.abs(m.elegance - t.elegance) * .12 + Math.abs(m.aggression - t.aggression) * .12;
  return Math.round(clamp(96 - distance * .72 + Math.max(0, 8 - rank), 28, 98));
}
function scoreByRank(m: MusicProfile, rank: number, providerBoost = 0) {
  const distinctiveness = (Math.abs(m.energy - 50) + Math.abs(m.tension - 50) + Math.abs(m.mystery - 50)) / 150;
  return Math.round(clamp(83 - rank * 2.5 + distinctiveness * 8 + providerBoost, 35, 94));
}
function stripHtml(value = '') { return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(); }

async function searchApple(query: string, country: string, m: MusicProfile): Promise<OnlineSong[]> {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query); url.searchParams.set('country', country); url.searchParams.set('media', 'music'); url.searchParams.set('entity', 'song'); url.searchParams.set('limit', '12'); url.searchParams.set('explicit', 'No');
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`Apple ${response.status}`);
  const json = await response.json() as { results?: Array<Record<string, unknown>> };
  return (json.results ?? []).slice(0, 8).flatMap((track, rank) => {
    if (!track.trackId || !track.trackName || !track.artistName) return [];
    const genre = String(track.primaryGenreName ?? 'Music');
    return [{ id: `apple-${track.trackId}`, title: String(track.trackName), artist: String(track.artistName), album: String(track.collectionName ?? ''), genre, year: track.releaseDate ? Number(String(track.releaseDate).slice(0, 4)) || undefined : undefined, artwork: typeof track.artworkUrl100 === 'string' ? track.artworkUrl100.replace('100x100bb', '300x300bb') : undefined, url: String(track.trackViewUrl ?? track.collectionViewUrl ?? ''), previewUrl: typeof track.previewUrl === 'string' ? track.previewUrl : undefined, provider: 'Apple Music', score: scoreByGenre(m, genre, rank), reasons: [`Apple 在线召回 · ${query}`, `${genre} 与当前音乐方向接近`] }];
  });
}
async function searchDeezer(query: string, m: MusicProfile): Promise<OnlineSong[]> {
  const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=12`, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`Deezer ${response.status}`);
  const json = await response.json() as { data?: Array<any> };
  return (json.data ?? []).slice(0, 8).map((track, rank) => ({ id: `deezer-${track.id}`, title: String(track.title ?? ''), artist: String(track.artist?.name ?? ''), album: String(track.album?.title ?? ''), genre: 'Deezer catalog', artwork: track.album?.cover_medium, url: track.link, previewUrl: track.preview, provider: 'Deezer' as const, score: scoreByRank(m, rank, 3), reasons: [`Deezer 在线召回 · ${query}`, '可提供公开试听片段时会显示试听'] })).filter(song => song.title && song.artist);
}
async function searchQQ(query: string, m: MusicProfile): Promise<OnlineSong[]> {
  const url = new URL('https://c.y.qq.com/soso/fcgi-bin/client_search_cp');
  for (const [k, v] of Object.entries({ p: '1', n: '12', w: query, format: 'json', t: '0', aggr: '1', lossless: '1', cr: '1', catZhida: '1', remoteplace: 'txt.yqq.song', platform: 'yqq.json', needNewCode: '0' })) url.searchParams.set(k, v);
  const response = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://y.qq.com/' }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`QQ ${response.status}`);
  const json = await response.json() as any;
  const list = json?.data?.song?.list ?? [];
  return list.slice(0, 8).map((track: any, rank: number) => ({ id: `qq-${track.songmid ?? track.songid ?? rank}`, title: String(track.songname ?? track.songorig ?? ''), artist: (track.singer ?? []).map((s: any) => s.name).filter(Boolean).join(' / '), album: String(track.albumname ?? ''), genre: 'QQ音乐', artwork: track.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.albummid}.jpg?max_age=2592000` : undefined, url: track.songmid ? `https://y.qq.com/n/ryqq/songDetail/${track.songmid}` : `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(track.songname ?? query)}&t=song`, provider: 'QQ音乐' as const, score: scoreByRank(m, rank, 4), reasons: [`QQ音乐在线搜索 · ${query}`, '平台只负责召回；最终会再做语义/试听音频重排'] })).filter((song: OnlineSong) => song.title && song.artist);
}
async function searchNetease(query: string, m: MusicProfile): Promise<OnlineSong[]> {
  const endpoint = 'https://music.163.com/api/search/get/web';
  const headers = { 'User-Agent': UA, Referer: 'https://music.163.com/', Accept: 'application/json' };
  const url = new URL(endpoint); url.searchParams.set('s', query); url.searchParams.set('type', '1'); url.searchParams.set('limit', '12'); url.searchParams.set('offset', '0');
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(6500) });
  let json = response.ok ? await response.json() as any : null;
  if (!json?.result?.songs?.length) {
    response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ s: query, type: '1', limit: '12', offset: '0' }), signal: AbortSignal.timeout(6500) });
    if (!response.ok) throw new Error(`NetEase ${response.status}`);
    json = await response.json() as any;
  }
  const list = json?.result?.songs ?? [];
  return list.slice(0, 8).map((track: any, rank: number) => ({ id: `netease-${track.id}`, title: String(track.name ?? ''), artist: (track.artists ?? track.ar ?? []).map((a: any) => a.name).filter(Boolean).join(' / '), album: String(track.album?.name ?? track.al?.name ?? ''), genre: '网易云音乐', artwork: track.album?.picUrl ?? track.al?.picUrl, url: `https://music.163.com/#/song?id=${track.id}`, provider: '网易云音乐' as const, score: scoreByRank(m, rank, 4), reasons: [`网易云在线搜索 · ${query}`, '平台只负责召回；最终会再做语义/试听音频重排'] })).filter((song: OnlineSong) => song.title && song.artist);
}
async function searchBilibili(query: string, m: MusicProfile): Promise<OnlineSong[]> {
  // Bilibili's structured web search may enforce WBI/cookies. This adapter attempts it and gracefully falls back to the always-valid search link returned separately.
  const url = new URL('https://api.bilibili.com/x/web-interface/search/type');
  url.searchParams.set('search_type', 'video'); url.searchParams.set('keyword', `${query} BGM`); url.searchParams.set('page', '1');
  const response = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' }, signal: AbortSignal.timeout(6500) });
  if (!response.ok) throw new Error(`Bilibili ${response.status}`);
  const json = await response.json() as any;
  if (json?.code !== 0) throw new Error(`Bilibili API ${json?.code ?? 'blocked'}`);
  const list = json?.data?.result ?? [];
  return list.slice(0, 6).map((video: any, rank: number) => ({ id: `bili-${video.bvid ?? video.aid ?? rank}`, title: stripHtml(String(video.title ?? '')), artist: String(video.author ?? 'Bilibili UP'), album: String(video.typename ?? '音乐视频'), genre: 'Bilibili BGM / 视频', artwork: typeof video.pic === 'string' ? (video.pic.startsWith('//') ? `https:${video.pic}` : video.pic) : undefined, url: video.bvid ? `https://www.bilibili.com/video/${video.bvid}` : `https://search.bilibili.com/all?keyword=${encodeURIComponent(query + ' BGM')}`, provider: '哔哩哔哩' as const, score: scoreByRank(m, rank), reasons: [`B站视频搜索 · ${query} BGM`, '用于角色/梗语境关联；不把搜索顺序直接当最终相似度'] })).filter((song: OnlineSong) => song.title);
}


function normalizeText(value = '') { return value.toLowerCase().replace(/[\s·・_\-—–:：()（）\[\]【】'"“”‘’]/g, ''); }
function associationBoost(song: OnlineSong, understanding?: Understanding) {
  if (!understanding) return 0;
  const haystack = normalizeText(`${song.title} ${song.artist} ${song.album ?? ''}`);
  let boost = 0;
  for (const assoc of understanding.musicAssociations ?? []) {
    const title = normalizeText(assoc.title ?? ''), artist = normalizeText(assoc.artist ?? '');
    if (title && haystack.includes(title)) boost = Math.max(boost, 14 + (Number(assoc.confidence) || 0) * .12);
    if (artist && haystack.includes(artist)) boost = Math.max(boost, 8 + (Number(assoc.confidence) || 0) * .08);
  }
  const identity = normalizeText(understanding.identity?.name ?? ''), franchise = normalizeText(understanding.identity?.franchise ?? '');
  if (identity && haystack.includes(identity)) boost = Math.max(boost, 10);
  if (franchise && haystack.includes(franchise)) boost = Math.max(boost, 6);
  return Math.min(26, boost);
}
function recallQueries(m: MusicProfile, semantics: string[], direction: string | undefined, understanding?: Understanding) {
  const fallback = profileQuery(m, semantics, direction);
  const zh: string[] = [], en: string[] = [];
  for (const assoc of (understanding?.musicAssociations ?? []).slice(0, 3)) {
    if (!assoc.title) continue;
    const exact = `${assoc.title}${assoc.artist ? ` ${assoc.artist}` : ''}`.trim(); zh.push(exact); en.push(exact);
  }
  const name = understanding?.identity?.name?.trim(), franchise = understanding?.identity?.franchise?.trim();
  if (name) { zh.push(`${name} BGM 配乐`); en.push(`${name} theme OST`); }
  else if (franchise) { zh.push(`${franchise} BGM 原声`); en.push(`${franchise} soundtrack OST`); }
  const genres = (understanding?.target?.genres ?? []).slice(0, 3).join(' '), descriptors = (understanding?.target?.descriptors ?? []).slice(0, 2).join(' ');
  if (genres) { zh.push(`${genres} ${descriptors}`.trim()); en.push(`${genres} ${descriptors}`.trim()); }
  zh.push(fallback.zh); en.push(fallback.en);
  const unique = (items: string[]) => [...new Set(items.map(v => v.trim()).filter(Boolean))].slice(0, 3);
  return { zh: unique(zh), en: unique(en), fallback };
}
function dedupeAndDiversify(groups: OnlineSong[][]) {
  const all = groups.flat().sort((a, b) => b.score - a.score);
  const seen = new Set<string>(), unique: OnlineSong[] = [];
  for (const song of all) {
    const key = `${song.title.toLowerCase().replace(/\s+/g, '')}|${song.artist.toLowerCase().replace(/\s+/g, '')}`;
    if (seen.has(key)) continue;
    seen.add(key); unique.push(song);
  }
  const providers: ProviderName[] = ['QQ音乐', '网易云音乐', '哔哩哔哩', 'Apple Music', 'Deezer'];
  const diversified: OnlineSong[] = [];
  for (const provider of providers) {
    const hit = unique.find(song => song.provider === provider && !diversified.includes(song));
    if (hit) diversified.push(hit);
  }
  for (const song of unique) if (!diversified.includes(song) && diversified.length < 10) diversified.push(song);
  return diversified.slice(0, 10);
}

export async function POST(request: Request) {
  let body: Input;
  try { body = await request.json() as Input; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const music = validateMusic(body.music);
  if (!music) return Response.json({ error: 'Missing Music Profile' }, { status: 400 });
  const semantics = Array.isArray(body.semantics) ? body.semantics.filter(v => typeof v === 'string').slice(0, 10) : [];
  const country = typeof body.country === 'string' && /^[A-Z]{2}$/i.test(body.country) ? body.country.toUpperCase() : 'JP';
  const queries = recallQueries(music, semantics, body.direction, body.understanding);
  const linkQuery = { zh: queries.zh[0] ?? queries.fallback.zh, en: queries.en[0] ?? queries.fallback.en };
  const providers = searchLinks(linkQuery, country);

  const providerJobs: Array<{ provider: ProviderName; run: (query: string) => Promise<OnlineSong[]>; queries: string[] }> = [
    { provider: 'Apple Music', queries: queries.en, run: q => searchApple(q, country, music) },
    { provider: 'Deezer', queries: queries.en, run: q => searchDeezer(q, music) },
    { provider: 'QQ音乐', queries: queries.zh, run: q => searchQQ(q, music) },
    { provider: '网易云音乐', queries: queries.zh, run: q => searchNetease(q, music) },
    { provider: '哔哩哔哩', queries: queries.zh, run: q => searchBilibili(q, music) },
  ];
  const providerSettled = await Promise.all(providerJobs.map(async job => {
    const settled = await Promise.allSettled(job.queries.map(q => job.run(q)));
    const songs = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const ok = settled.some(result => result.status === 'fulfilled');
    const error = settled.find(result => result.status === 'rejected');
    return { provider: job.provider, ok, error: error && error.status === 'rejected' ? String(error.reason instanceof Error ? error.reason.message : error.reason) : undefined, songs };
  }));
  const groups = providerSettled.map(group => group.songs.map(song => {
    const association = associationBoost(song, body.understanding);
    return { ...song, score: Math.round(clamp(song.score * .55 + 30 + association, 25, 98)), reasons: association >= 10 ? [`角色/梗关联加权 +${Math.round(association)}`, ...song.reasons] : song.reasons };
  }));
  const songs = dedupeAndDiversify(groups);
  const status = providerSettled.map(group => ({ provider: group.provider, ok: group.ok, error: group.error }));
  return Response.json({ queries: [...queries.zh, ...queries.en].slice(0, 6), songs, providers, status, ranking: 'recall -> semantic association -> client preview-audio feature distance' }, { headers: { 'Cache-Control': 'no-store' } });
}
