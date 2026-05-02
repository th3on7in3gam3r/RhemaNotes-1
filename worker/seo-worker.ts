/// <reference types="@cloudflare/workers-types" />

/**
 * worker/seo-worker.ts
 *
 * Cloudflare Worker — serves RhemaNotes with dynamic SEO meta tags
 * injected server-side so Google, Facebook, Twitter and WhatsApp crawlers
 * see real metadata without executing JavaScript.
 *
 * Deploy:
 *   npx wrangler deploy worker/seo-worker.ts --name rhemanotes
 *
 * How it works:
 *   1. Fetch the static index.html from the asset binding (your Vite build)
 *   2. Detect the request path to determine which page is being served
 *   3. Build the correct meta tags for that page
 *   4. Use HTMLRewriter to inject them into <head> before sending to client
 *
 * Routes handled:
 *   /              → homepage meta
 *   /history       → history page meta
 *   /note/:id      → dynamic sermon meta (fetched from KV store)
 *   everything else → homepage meta as fallback
 */

import { buildMetaHTML, buildSermonMeta, HOME_META, HISTORY_META } from '../services/seoService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Env {
  /** Cloudflare Pages / Workers Sites asset binding */
  ASSETS: Fetcher;
  /**
   * KV namespace storing sermon data.
   * Key:   sermon ID (string)
   * Value: JSON string of { title, mainTopic, scriptureCount, timestamp }
   */
  SERMONS_KV?: KVNamespace;
  /** D1 Database for history and search */
  DB?: D1Database;
}

interface SermonKVEntry {
  title: string;
  mainTopic: string;
  scriptureCount: number;
  timestamp: number;
}

// ── Worker entry point ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle API Routes (Database)
    if (path.startsWith('/api/sermons')) {
      return handleSermonsAPI(request, env);
    }

    // 2. Handle robots.txt & sitemap
    if (path === '/robots.txt') return new Response(generateRobotsTxt(), { headers: { 'content-type': 'text/plain' } });
    if (path === '/sitemap.xml') return new Response(await generateSitemap(env), { headers: { 'content-type': 'application/xml' } });

    // 3. Serve static assets (JS, CSS, Images, Icons)
    // If the request is for a file that exists in the build, serve it directly
    try {
      const asset = await env.ASSETS.fetch(request);
      if (asset.ok || isAssetRequest(path)) {
        return asset;
      }
    } catch (e) {
      console.error('Asset fetch error:', e);
    }

    // 4. Fetch the base index.html for SPA routing + SEO injection
    const assetResponse = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
    if (!assetResponse.ok) return assetResponse;

    const metaHTML = await resolveMetaHTML(path, env);

    return new HTMLRewriter()
      .on('title', { element: (el) => { el.remove(); } })
      .on('meta', {
        element: (el) => {
          const name = el.getAttribute('name');
          const prop = el.getAttribute('property');
          if (['description', 'keywords', 'og:title', 'og:description'].includes(name || prop || '')) {
            el.remove();
          }
        }
      })
      .on('head', new MetaInjector(metaHTML))
      .transform(assetResponse);
  },
};

// ── API Handler ──────────────────────────────────────────────────────────────

async function handleSermonsAPI(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return new Response('Database not bound', { status: 500 });

  const url = new URL(request.url);
  // Extract optional sermon ID from path e.g. /api/sermons/abc-123
  const sermonId = url.pathname.replace('/api/sermons', '').replace(/^\//, '') || null;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // GET /api/sermons — list all sermons
    if (request.method === 'GET' && !sermonId) {
      const { results } = await env.DB.prepare(
        'SELECT id, title, main_topic, source_type, created_at FROM sermons ORDER BY created_at DESC LIMIT 100'
      ).all();
      return new Response(JSON.stringify(results), { headers: cors });
    }

    // POST /api/sermons — create a sermon
    if (request.method === 'POST') {
      const data: any = await request.json();
      const id = data.id || crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO sermons (id, user_id, title, main_topic, clean_transcript, source_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        id,
        data.user_id || 'guest',
        data.title || 'Untitled Sermon',
        data.main_topic || '',
        data.clean_transcript || '',
        data.source_type || 'text'
      ).run();
      return new Response(JSON.stringify({ success: true, id }), { headers: cors });
    }

    // DELETE /api/sermons/:id
    if (request.method === 'DELETE' && sermonId) {
      await env.DB.prepare('DELETE FROM sermons WHERE id = ?').bind(sermonId).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // PATCH /api/sermons/:id
    if (request.method === 'PATCH' && sermonId) {
      const data: any = await request.json();
      await env.DB.prepare(
        `UPDATE sermons SET title = ?, main_topic = ?, clean_transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(data.title, data.main_topic, data.clean_transcript, sermonId).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }

  return new Response('Method not allowed', { status: 405 });
}

// ── Static Assets & Robots ───────────────────────────────────────────────────

function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://rhemanotes.jerlessm.workers.dev/sitemap.xml
`;
}

async function generateSitemap(env: Env): Promise<string> {
  const baseUrl = 'https://rhemanotes.jerlessm.workers.dev';
  const staticRoutes = ['', '/history'];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add static routes
  for (const route of staticRoutes) {
    sitemap += `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>daily</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  }

  // Add dynamic notes from KV
  if (env.SERMONS_KV) {
    try {
      const list = await env.SERMONS_KV.list();
      for (const key of list.keys) {
        sitemap += `
  <url>
    <loc>${baseUrl}/note/${key.name}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    } catch (e) {
      console.error('Sitemap KV error:', e);
    }
  }

  sitemap += '\n</urlset>';
  return sitemap;
}

// ── Route → meta resolution ───────────────────────────────────────────────────

async function resolveMetaHTML(path: string, env: Env): Promise<string> {
  // /note/:id  — dynamic sermon page
  const noteMatch = path.match(/^\/note\/([^/]+)/);
  if (noteMatch) {
    const id = noteMatch[1];
    const sermon = await fetchSermonFromKV(id, env);
    if (sermon) {
      return buildMetaHTML(buildSermonMeta({ id, ...sermon }));
    }
    // Sermon not found — serve a generic "note" meta
    return buildMetaHTML({
      title: 'Sermon Note — RhemaNotes',
      description:
        'View this sermon note with scripture references, study tools and personal reflections on RhemaNotes.',
      canonical: `https://rhemanotes.jerlessm.workers.dev/note/${id}`,
      ogType: 'article',
    });
  }

  // /history
  if (path.startsWith('/history')) {
    return buildMetaHTML(HISTORY_META);
  }

  // / and everything else
  return buildMetaHTML(HOME_META);
}

// ── KV lookup ─────────────────────────────────────────────────────────────────

async function fetchSermonFromKV(
  id: string,
  env: Env,
): Promise<SermonKVEntry | null> {
  if (!env.SERMONS_KV) return null;
  try {
    const raw = await env.SERMONS_KV.get(id);
    if (!raw) return null;
    return JSON.parse(raw) as SermonKVEntry;
  } catch {
    return null;
  }
}

// ── HTMLRewriter handler ──────────────────────────────────────────────────────

class MetaInjector {
  private html: string;
  constructor(html: string) { this.html = html; }

  element(element: any): void {
    // Remove the static placeholder tags that index.html already has
    // so we don't end up with duplicate title/description/og tags.
    // We prepend our dynamic block right after <head> opens.
    element.prepend(this.html, { html: true });
  }
}

// ── Asset detection ───────────────────────────────────────────────────────────

const ASSET_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.css', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot',
  '.json', '.map', '.webp', '.avif',
]);

function isAssetRequest(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  return ASSET_EXTENSIONS.has(ext);
}
