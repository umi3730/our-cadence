export const runtime = 'nodejs';
const ALLOWED_HOSTS = ['audio-ssl.itunes.apple.com', 'audio.itunes.apple.com', 'cdns-preview', 'preview-deezer', 'cdns-preview-'];
function allowed(host: string) { return host.endsWith('itunes.apple.com') || host.endsWith('dzcdn.net') || ALLOWED_HOSTS.some(part => host.includes(part)); }
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('url');
  if (!source) return new Response('missing url', { status: 400 });
  let url: URL; try { url = new URL(source); } catch { return new Response('bad url', { status: 400 }); }
  if (url.protocol !== 'https:' || !allowed(url.hostname)) return new Response('host not allowed', { status: 403 });
  const upstream = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 OurCadence/0.5' }, signal: AbortSignal.timeout(12_000) });
  if (!upstream.ok || !upstream.body) return new Response('preview unavailable', { status: 502 });
  return new Response(upstream.body, { status: 200, headers: { 'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } });
}
