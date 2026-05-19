/**
 * youtubeService.ts
 *
 * Extracts a real transcript + title from a YouTube URL.
 *
 * Proxy waterfall (each tried in order, first success wins):
 *   1. corsproxy.io        — raw text, no compression issues
 *   2. codetabs.com        — raw text, different infrastructure
 *   3. allorigins.win      — JSON wrapper, force identity encoding to avoid
 *                            the net::ERR_HTTP2_PROTOCOL_ERROR caused by
 *                            Cloudflare's zstd compression on large payloads
 *
 * Caption XML is fetched directly (no proxy) since YouTube's timedtext
 * endpoint allows cross-origin reads on its signed URLs.
 */

export interface YouTubeResult {
  title: string;
  transcript: string;
  videoId: string;
}

// ── Video ID extraction ───────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?&]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

// ── Proxy definitions ─────────────────────────────────────────────────────────

interface ProxyResult {
  text: string;
}

type ProxyFn = (targetUrl: string) => Promise<ProxyResult>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * allorigins.win — JSON wrapper { contents, status }.
 * Most permissive for YouTube-sized pages.
 * Force identity encoding to avoid Cloudflare zstd H2 stream errors.
 */
const tryAllorigins: ProxyFn = async (targetUrl) => {
  const bust = Date.now();
  const res = await fetch(
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&_=${bust}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('allorigins rate limited (429)');
  if (!res.ok) throw new Error(`allorigins returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('allorigins returned empty contents');
  return { text };
};

/**
 * codetabs.com — raw text response, different infrastructure.
 */
const tryCodetabs: ProxyFn = async (targetUrl) => {
  const res = await fetch(
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('codetabs rate limited (429)');
  if (!res.ok) throw new Error(`codetabs returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('codetabs returned empty body');
  return { text };
};

/**
 * corsproxy.io — raw text, no Cloudflare.
 * Kept as last resort since it rate-limits aggressively on free tier.
 */
const tryCorsproxy: ProxyFn = async (targetUrl) => {
  const res = await fetch(
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      },
    },
  );
  if (res.status === 429) throw new Error('corsproxy.io rate limited (429)');
  if (!res.ok) throw new Error(`corsproxy.io returned ${res.status}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error('corsproxy.io returned empty body');
  return { text };
};

// Try codetabs first as it's currently most reliable, then corsproxy, then allorigins (which has HTTP2 issues)
const PROXY_CHAIN: ProxyFn[] = [tryCodetabs, tryCorsproxy, tryAllorigins];

async function proxyFetch(targetUrl: string): Promise<string> {
  const errors: string[] = [];

  for (let i = 0; i < PROXY_CHAIN.length; i++) {
    if (i > 0) await sleep(600); // brief pause before trying next proxy
    try {
      const { text } = await PROXY_CHAIN[i](targetUrl);
      return text;
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  throw new Error(
    `All proxies failed.\n${errors.join(' | ')}`,
  );
}

// ── Caption track parsing ─────────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" = auto-generated
  name: string;
}

function parseCaptionTracks(html: string): CaptionTrack[] {
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return [];
  try {
    const raw = match[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\u003d/g, '=');
    const tracks: any[] = JSON.parse(raw);
    return tracks.map(t => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode ?? '',
      kind: t.kind,
      name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? '',
    }));
  } catch {
    return [];
  }
}

function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  // Manual English > auto-generated English > any language
  return (
    tracks.find(t => t.languageCode.startsWith('en') && t.kind !== 'asr') ??
    tracks.find(t => t.languageCode.startsWith('en')) ??
    tracks[0]
  );
}

// ── Caption XML → plain text ──────────────────────────────────────────────────

function xmlToPlainText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Title extraction ──────────────────────────────────────────────────────────

function parseTitle(html: string): string {
  // og:title is the most reliable — it's the exact video title
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  if (og) return decodeHTMLEntities(og[1]);

  const title = html.match(/<title>([^<]+)<\/title>/);
  if (title) return title[1].replace(/ - YouTube$/, '').trim();

  return 'YouTube Sermon';
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── Blocked content detection ──────────────────────────────────────────────────

function isBlocked(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  
  // Specific Google block page checks
  if (text.includes('<title>Sorry...</title>')) return true;
  if (lower.includes('automated queries') && lower.includes('google')) return true;
  if (lower.includes('unusual traffic') && lower.includes('computer network')) return true;
  
  // Proxy specific errors
  if (lower.includes('free usage is limited to localhost')) return true;
  if (lower.includes('request timeout') && lower.includes('oops')) return true;
  
  return false;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function getYouTubeTranscript(url: string, useBackendFirst = true): Promise<YouTubeResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(
      "That doesn't look like a valid YouTube URL. " +
      'Try https://www.youtube.com/watch?v=… or https://youtu.be/…',
    );
  }

  // 1. Try our own backend proxy first (if in browser and allowed)
  if (useBackendFirst && typeof window !== 'undefined') {
    try {
      const backendUrl = `/api/youtube-transcript?url=${encodeURIComponent(url)}`;
      const res = await fetch(backendUrl);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.transcript && data.title) {
          return {
            title: data.title,
            transcript: data.transcript,
            videoId: data.videoId || videoId
          };
        }
      }
      const errData = (await res.json().catch(() => ({}))) as any;
      console.warn('Backend transcript fetch failed, falling back to client-side waterfall:', errData?.error);
    } catch (err) {
      console.warn('Backend transcript fetch failed, falling back to client-side waterfall:', err);
    }
  }

  const errors: string[] = [];

  // --- Method A: InnerTube Android Client API (Most reliable direct fetch) ---
  try {
    const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
    const INNERTUBE_CLIENT_VERSION = '20.10.38';
    const INNERTUBE_CONTEXT = {
      client: {
        clientName: 'ANDROID',
        clientVersion: INNERTUBE_CLIENT_VERSION,
      },
    };
    const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

    const resp = await fetch(INNERTUBE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT,
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        videoId: videoId,
      }),
    });

    if (resp.ok) {
      const data: any = await resp.json();
      const title = data?.videoDetails?.title || 'YouTube Sermon';
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(captionTracks) && captionTracks.length > 0) {
        const track = pickBestTrack(captionTracks.map(t => ({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode ?? '',
          kind: t.kind,
          name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? '',
        })));

        if (track) {
          const xmlResp = await fetch(track.baseUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
          });
          if (xmlResp.ok) {
            const xml = await xmlResp.text();
            if (!isBlocked(xml)) {
              const transcript = xmlToPlainText(xml);
              if (transcript) {
                return { title, transcript, videoId };
              }
            }
          }
        }
      } else if (data?.playabilityStatus?.status === 'UNPLAYABLE') {
        throw new Error('NO_CAPTIONS_FOUND');
      }
    }
    errors.push('InnerTube: Empty or failed response');
  } catch (e: any) {
    if (e?.message === 'NO_CAPTIONS_FOUND') {
      throw new Error(
        'No captions found for this video. ' +
        'The channel may have disabled transcripts, or the video is private or age-restricted. ' +
        'Try uploading the audio file directly instead.'
      );
    }
    errors.push(`InnerTube: ${e?.message ?? String(e)}`);
  }

  // --- Method B: Direct fetch + Proxy Waterfall (Coupled) ---
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const tryFetchMethod = async (
    name: string,
    fetchFn: (targetUrl: string) => Promise<string>
  ) => {
    // A. Fetch watch page HTML
    const html = await fetchFn(watchUrl);
    if (isBlocked(html)) {
      throw new Error('Watch page blocked');
    }

    // B. Parse title and tracks
    const title = parseTitle(html);
    const tracks = parseCaptionTracks(html);

    if (!tracks.length) {
      throw new Error('NO_CAPTIONS_FOUND');
    }

    const track = pickBestTrack(tracks);
    if (!track) throw new Error('Could not select caption track');

    // C. Fetch caption XML
    const xml = await fetchFn(track.baseUrl);
    if (isBlocked(xml)) {
      throw new Error('Caption XML blocked');
    }

    const transcript = xmlToPlainText(xml);
    if (!transcript) {
      throw new Error('Transcript empty');
    }

    return { title, transcript, videoId };
  };

  const methods = [
    {
      name: 'direct',
      fn: async (targetUrl: string) => {
        const res = await fetch(targetUrl, {
          headers: { 'Accept-Encoding': 'identity' }
        });
        if (!res.ok) throw new Error(`Direct fetch returned ${res.status}`);
        return res.text();
      }
    },
    ...PROXY_CHAIN.map(p => ({
      name: p.name || 'Proxy',
      fn: async (targetUrl: string) => {
        const { text } = await p(targetUrl);
        return text;
      }
    }))
  ];

  for (let i = 0; i < methods.length; i++) {
    const method = methods[i];
    await sleep(600); // pause between attempts
    try {
      return await tryFetchMethod(method.name, method.fn);
    } catch (e: any) {
      if (e?.message === 'NO_CAPTIONS_FOUND') {
        throw new Error(
          'No captions found for this video. ' +
          'The channel may have disabled transcripts, or the video is private or age-restricted. ' +
          'Try uploading the audio file directly instead.'
        );
      }
      errors.push(`${method.name}: ${e?.message ?? String(e)}`);
    }
  }

  throw new Error(
    `All transcript download methods failed. Please try again later.\nDetails: ${errors.join(' | ')}`
  );
}

