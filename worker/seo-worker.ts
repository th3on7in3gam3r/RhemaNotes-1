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
import Stripe from 'stripe';
import { getYouTubeTranscript } from '../services/youtubeService';

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
  /** Stripe Secret Key */
  STRIPE_SECRET_KEY: string;
  /** Stripe Webhook Signing Secret */
  STRIPE_WEBHOOK_SECRET: string;
  /** Clerk Secret Key */
  CLERK_SECRET_KEY: string;
  /** Gemini API Key */
  GEMINI_API_KEY?: string;
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

    // 1. Handle API Routes (Database & AI Proxy)
    if (path.startsWith('/v1/') || path.startsWith('/v1beta/')) {
      return handleGeminiProxyAPI(request, env);
    }

    if (path.startsWith('/api/sermons')) {
      return handleSermonsAPI(request, env);
    }

    if (path === '/api/checkout' && request.method === 'POST') {
      return handleCheckoutAPI(request, env);
    }

    if (path === '/api/webhook' && request.method === 'POST') {
      return handleWebhookAPI(request, env);
    }

    if (path === '/api/user' && request.method === 'GET') {
      return handleUserAPI(request, env);
    }

    if (path === '/api/youtube-transcript' && request.method === 'GET') {
      return handleYouTubeTranscriptAPI(request, env);
    }

    // 2. Handle robots.txt & sitemap
    if (path === '/robots.txt') return new Response(generateRobotsTxt(), { headers: { 'content-type': 'text/plain' } });
    if (path === '/sitemap.xml') return new Response(await generateSitemap(env), { headers: { 'content-type': 'application/xml' } });

    // 3. Serve static assets (JS, CSS, Images, Icons)
    if (!env.ASSETS) {
      return new Response(
        "Static assets binding (ASSETS) is undefined. Please verify that compatibility_date in wrangler.toml is set to a modern date like '2024-11-01' or later.", 
        { status: 500 }
      );
    }

    try {
      const asset = await env.ASSETS.fetch(request.clone() as any);
      if (asset.ok || isAssetRequest(path)) {
        return asset;
      }
    } catch (e) {
      console.error('Asset fetch error:', e);
    }

    // 4. Fetch the base index.html for SPA routing + SEO injection
    const indexUrl = new URL('/index.html', url.origin);
    const assetResponse = await env.ASSETS.fetch(indexUrl.toString());
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
    // GET /api/sermons — list only the requested user's sermons
    if (request.method === 'GET' && !sermonId) {
      const userId = url.searchParams.get('userId') || 'guest';
      const { results } = await env.DB.prepare(
        'SELECT id, user_id, title, main_topic, clean_transcript, source_type, created_at, summary_json FROM sermons WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100'
      ).bind(userId).all();
      return new Response(JSON.stringify(results), { headers: cors });
    }

    // POST /api/sermons — create a sermon
    if (request.method === 'POST') {
      const data: any = await request.json();
      const id = data.id || crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO sermons (id, user_id, title, main_topic, clean_transcript, source_type, summary_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        id,
        data.user_id || 'guest',
        data.title || 'Untitled Sermon',
        data.main_topic || '',
        data.clean_transcript || '',
        data.source_type || 'text',
        data.summary_json || null
      ).run();
      return new Response(JSON.stringify({ success: true, id }), { headers: cors });
    }

    // DELETE /api/sermons/:id
    if (request.method === 'DELETE' && sermonId) {
      const requestingUserId = request.headers.get('X-User-Id') || url.searchParams.get('userId') || 'guest';

      // Require a real user ID — never allow 'guest' to delete from D1
      if (requestingUserId === 'guest') {
        return new Response(JSON.stringify({ error: 'Sign in required to delete sermons' }), { status: 401, headers: cors });
      }

      const sermon = await env.DB.prepare('SELECT user_id FROM sermons WHERE id = ?').bind(sermonId).first() as any;
      
      if (!sermon) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
      }
      // Allow delete if: owner matches, OR the sermon was a guest sermon being claimed
      if (sermon.user_id !== requestingUserId && sermon.user_id !== 'guest') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors });
      }

      await env.DB.prepare('DELETE FROM sermons WHERE id = ?').bind(sermonId).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // PATCH /api/sermons/:id
    if (request.method === 'PATCH' && sermonId) {
      const requestingUserId = request.headers.get('X-User-Id') || url.searchParams.get('userId') || 'guest';
      const sermon = await env.DB.prepare('SELECT user_id FROM sermons WHERE id = ?').bind(sermonId).first() as any;
      
      if (!sermon) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
      }

      // Allow update if:
      //   a) the requesting user is the creator, OR
      //   b) the sermon was saved as 'guest' and a real user is now claiming it
      //      (happens when a sermon is created before sign-in)
      const isOwner = sermon.user_id === requestingUserId;
      const isGuestClaim = sermon.user_id === 'guest' && requestingUserId !== 'guest';
      if (!isOwner && !isGuestClaim) {
        return new Response(JSON.stringify({ error: 'Forbidden', stored: sermon.user_id, requesting: requestingUserId }), { status: 403, headers: cors });
      }

      const data: any = await request.json();
      await env.DB.prepare(
        `UPDATE sermons SET user_id = ?, title = ?, main_topic = ?, clean_transcript = ?, summary_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(requestingUserId, data.title, data.main_topic, data.clean_transcript, data.summary_json || null, sermonId).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function handleCheckoutAPI(request: Request, env: Env): Promise<Response> {
  try {
    const { priceId, userId, userEmail } = await request.json() as any;
    
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const url = new URL(request.url);
    const origin = url.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: { userId: userId },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Stripe Webhook Handler ────────────────────────────────────────────────────

async function handleWebhookAPI(request: Request, env: Env): Promise<Response> {
  const sig = request.headers.get('stripe-signature');
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature', { status: 400 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return new Response('Cannot read body', { status: 400 });
  }

  // Verify Stripe signature using Web Crypto
  let event: any;
  try {
    event = await verifyStripeWebhook(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return new Response(`Webhook signature invalid: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const customerEmail = session.customer_email || session.customer_details?.email;
    const stripeCustomerId = session.customer;
    const stripeSubscriptionId = session.subscription;

    // Map price ID to tier
    const lineItems = session.display_items || [];
    const priceId = session.line_items?.data?.[0]?.price?.id || '';
    let tier = 'pro'; // default to pro
    if (priceId === 'price_1TSmOfDaUBBsjt5mjrJLVLLK') tier = 'church';
    else if (priceId === 'price_1TSmM0DaUBBsjt5mlh09smbe') tier = 'free';

    if (env.DB && userId) {
      try {
        // Upsert user with new tier
        await env.DB.prepare(`
          INSERT INTO users (id, email, tier, stripe_customer_id, stripe_subscription_id, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            tier = excluded.tier,
            stripe_customer_id = excluded.stripe_customer_id,
            stripe_subscription_id = excluded.stripe_subscription_id,
            updated_at = CURRENT_TIMESTAMP
        `).bind(userId, customerEmail || '', tier, stripeCustomerId || '', stripeSubscriptionId || '').run();
      } catch (dbErr: any) {
        console.error('DB upsert error:', dbErr.message);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify Stripe webhook signature using Web Crypto API (Edge compatible)
async function verifyStripeWebhook(body: string, signature: string, secret: string): Promise<any> {
  const parts = signature.split(',').reduce((acc: any, part) => {
    const [key, val] = part.split('=');
    acc[key] = val;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) throw new Error('Invalid signature format');

  const signed = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signed));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (expected !== sig) throw new Error('Signature mismatch');
  return JSON.parse(body);
}

// ── User Tier API ─────────────────────────────────────────────────────────────

async function handleUserAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!userId || !env.DB) {
    return new Response(JSON.stringify({ tier: 'free' }), { headers: cors });
  }

  try {
    const result = await env.DB.prepare(
      'SELECT tier FROM users WHERE id = ?'
    ).bind(userId).first<{ tier: string }>();
    
    return new Response(JSON.stringify({ tier: result?.tier || 'free' }), { headers: cors });
  } catch {
    return new Response(JSON.stringify({ tier: 'free' }), { headers: cors });
  }
}

// ── Static Assets & Robots ───────────────────────────────────────────────────

function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://rhemanotes.biblefunland.com/sitemap.xml
`;
}

async function generateSitemap(env: Env): Promise<string> {
  const baseUrl = 'https://rhemanotes.biblefunland.com';
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
      canonical: `https://rhemanotes.biblefunland.com/note/${id}`,
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

// ── Gemini AI Proxy Handler ────────────────────────────────────────────────────

async function handleGeminiProxyAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;
  
  const headers = new Headers(request.headers);
  headers.set('x-goog-api-key', env.GEMINI_API_KEY || '');
  headers.delete('host');
  
  // Forward request body if method is not GET/HEAD
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: hasBody ? request.body : undefined,
  });
  
  return response;
}

async function handleYouTubeTranscriptAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: cors });
  }

  try {
    const result = await getYouTubeTranscript(targetUrl, false);
    return new Response(JSON.stringify(result), { headers: cors });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}


