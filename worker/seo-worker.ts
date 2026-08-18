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
import { GEMINI_PROXY_MAX_BODY_BYTES } from '../constants/ai';
import { resolveAuth, enforceWriteUserId, isPaidTier } from './auth';
import { checkRateLimit, clientRateLimitKey } from './rateLimit';
import { syncUserTierFromStripe, tierFromPriceId, upsertUserTier } from './stripeTier';
import { isFounderAccount } from './founder';
import { submitWhisperTranscription, fetchWhisperTaskStatus } from './whisperTranscribe';
import { resolveBibleVerse } from './bibleVerse';
import { resolveSermonListUserId, requireAuthenticatedSermonWriter } from './sermonAccess';
import { handleTranscriptionJobsRoute } from './transcriptionJobs';
import { WHISPER_SERMON_PROMPT } from '../lib/transcriptionConstants';
import { parsePublicSummaryJson } from '../lib/publicSummary';

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
  /** Clerk publishable key — injected into HTML at runtime (safe to expose) */
  CLERK_PUBLISHABLE_KEY?: string;
  /** Comma-separated Clerk user IDs granted Harvest (founder) tier — set in dashboard only */
  FOUNDER_CLERK_IDS?: string;
  /** Comma-separated founder emails granted Harvest tier — set in dashboard only */
  FOUNDER_EMAILS?: string;
  /** Gemini API Key */
  GEMINI_API_KEY?: string;
  /** Whisper API (whisper-api.com) for long audio transcription */
  WHISPER_API_KEY?: string;
  /** API.Bible key (api.bible) — optional fallback for verse lookup */
  BIBLE_API_KEY?: string;
}

interface SermonKVEntry {
  title: string;
  mainTopic: string;
  scriptureCount: number;
  timestamp: number;
}

// ── Worker entry point ────────────────────────────────────────────────────────

const whisperCors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Handle API Routes (Database & AI Proxy)
    if (path.startsWith('/v1/') || path.startsWith('/v1beta/')) {
      return handleGeminiProxyAPI(request, env);
    }

    if (path.startsWith('/api/sermons')) {
      return handleSermonsAPI(request, env);
    }

    if (path.startsWith('/api/community')) {
      return handleCommunityAPI(request, env);
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

    if (path === '/api/sync-subscription' && request.method === 'POST') {
      return handleSyncSubscriptionAPI(request, env);
    }

    if (path === '/api/transcribe/available' && request.method === 'GET') {
      return handleTranscribeAvailableAPI(env);
    }

    if (path === '/api/public-config' && request.method === 'GET') {
      return handlePublicConfigAPI(env);
    }

    if (path === '/api/bible/verse' && request.method === 'GET') {
      return handleBibleVerseAPI(request, env);
    }

    if (path === '/api/transcribe' && request.method === 'POST') {
      return handleTranscribeSubmitAPI(request, env);
    }

    if (path.startsWith('/api/transcribe/jobs')) {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), {
          status: 500,
          headers: whisperCors,
        });
      }
      const auth = await resolveAuth(request, env);
      if (!auth.authenticated || !auth.userId) {
        return new Response(JSON.stringify({ error: 'Sign in required for long-form transcription' }), {
          status: 401,
          headers: whisperCors,
        });
      }
      return handleTranscriptionJobsRoute(request, { DB: env.DB, WHISPER_API_KEY: env.WHISPER_API_KEY, GEMINI_API_KEY: env.GEMINI_API_KEY }, auth.userId, path, ctx);
    }

    const transcribeStatusMatch = path.match(/^\/api\/transcribe\/status\/([^/]+)$/);
    if (transcribeStatusMatch && request.method === 'GET') {
      return handleTranscribeStatusAPI(transcribeStatusMatch[1], request, env);
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
      // Only short-circuit real static files — not "/" (which also resolves to index.html
      // but must pass through HTMLRewriter for Clerk runtime config + SEO injection).
      if (asset.ok && isAssetRequest(path)) {
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
    const runtimeHTML = buildRuntimeConfigHTML(env);

    const htmlResponse = new HTMLRewriter()
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
      .on('head', new MetaInjector(runtimeHTML + metaHTML))
      .transform(assetResponse);

    const headers = new Headers(htmlResponse.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');

    return new Response(htmlResponse.body, {
      status: htmlResponse.status,
      statusText: htmlResponse.statusText,
      headers,
    });
  },
};

// ── API Handler ──────────────────────────────────────────────────────────────

async function handleSermonsAPI(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return new Response('Database not bound', { status: 500 });

  const url = new URL(request.url);
  // Remainder after /api/sermons — '' | ':id' | ':id/publish'
  const rest = url.pathname.replace('/api/sermons', '').replace(/^\//, '');
  const [sermonId, action] = rest ? rest.split('/') : [null, undefined];

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // GET /api/sermons — list sermons for authenticated user or guest-only library
    if (request.method === 'GET' && !sermonId) {
      const auth = await resolveAuth(request, env);
      const listAccess = resolveSermonListUserId(auth, url.searchParams.get('userId'));
      if ('error' in listAccess) return listAccess.error;

      const { results } = await env.DB.prepare(
        'SELECT id, user_id, title, main_topic, clean_transcript, source_type, created_at, summary_json, is_public FROM sermons WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100'
      ).bind(listAccess.userId).all();
      return new Response(JSON.stringify(results), { headers: cors });
    }

    // POST /api/sermons/:id/publish — share Summary only (Plan stays in summary_json)
    if (sermonId && action === 'publish' && (request.method === 'POST' || request.method === 'DELETE')) {
      const auth = await resolveAuth(request, env);
      const writer = requireAuthenticatedSermonWriter(auth);
      if ('error' in writer) return writer.error;

      const sermon = await env.DB.prepare(
        'SELECT user_id FROM sermons WHERE id = ? AND deleted_at IS NULL'
      ).bind(sermonId).first<{ user_id: string }>();

      if (!sermon) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
      }
      if (sermon.user_id !== writer.userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors });
      }

      const makePublic = request.method === 'POST' ? 1 : 0;
      await env.DB.prepare(
        'UPDATE sermons SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(makePublic, sermonId).run();

      return new Response(JSON.stringify({ success: true, is_public: makePublic === 1 }), { headers: cors });
    }

    // POST /api/sermons — create a sermon
    if (request.method === 'POST' && !sermonId) {
      const auth = await resolveAuth(request, env);
      const data: { user_id?: string; [key: string]: unknown } = await request.json();
      const id = (data.id as string) || crypto.randomUUID();
      const userId = enforceWriteUserId(auth, data.user_id as string | undefined);
      const allowedSources = ['youtube', 'upload', 'text', 'live'];
      const sourceTypeRaw = String(data.source_type || 'text');
      const sourceType = allowedSources.includes(sourceTypeRaw) ? sourceTypeRaw : 'text';

      await env.DB.prepare(
        `INSERT INTO sermons (id, user_id, title, main_topic, clean_transcript, bible_reference, transcript_status, source_type, summary_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        id,
        userId,
        data.title || 'Untitled Sermon',
        data.main_topic || '',
        data.clean_transcript || '',
        data.bible_reference || null,
        data.transcript_status || 'complete',
        sourceType,
        data.summary_json || null
      ).run();
      return new Response(JSON.stringify({ success: true, id }), { headers: cors });
    }

    // DELETE /api/sermons/:id
    if (request.method === 'DELETE' && sermonId && !action) {
      const auth = await resolveAuth(request, env);
      const writer = requireAuthenticatedSermonWriter(auth);
      if ('error' in writer) return writer.error;
      const requestingUserId = writer.userId;

      const sermon = await env.DB.prepare('SELECT user_id FROM sermons WHERE id = ?').bind(sermonId).first<{ user_id: string }>();
      
      if (!sermon) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
      }
      if (sermon.user_id !== requestingUserId && sermon.user_id !== 'guest') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors });
      }

      await env.DB.prepare('DELETE FROM sermons WHERE id = ?').bind(sermonId).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // PATCH /api/sermons/:id
    if (request.method === 'PATCH' && sermonId && !action) {
      const auth = await resolveAuth(request, env);
      const writer = requireAuthenticatedSermonWriter(auth);
      if ('error' in writer) return writer.error;
      const requestingUserId = writer.userId;

      const sermon = await env.DB.prepare('SELECT user_id FROM sermons WHERE id = ?').bind(sermonId).first<{ user_id: string }>();
      
      if (!sermon) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
      }

      const isOwner = sermon.user_id === requestingUserId;
      const isGuestClaim = sermon.user_id === 'guest';
      if (!isOwner && !isGuestClaim) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors });
      }

      const data = (await request.json()) as {
        title?: string;
        main_topic?: string;
        clean_transcript?: string;
        bible_reference?: string | null;
        transcript_status?: string;
        summary_json?: string | null;
      };
      await env.DB.prepare(
        `UPDATE sermons SET user_id = ?, title = ?, main_topic = ?, clean_transcript = ?, bible_reference = ?, transcript_status = ?, summary_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(
        requestingUserId,
        data.title,
        data.main_topic,
        data.clean_transcript,
        data.bible_reference ?? null,
        data.transcript_status || 'complete',
        data.summary_json || null,
        sermonId,
      ).run();
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function handleCommunityAPI(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return new Response('Database not bound', { status: 500 });

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const rest = new URL(request.url).pathname.replace('/api/community', '').replace(/^\//, '');
  const postId = rest || null;

  try {
    if (!postId) {
      const { results } = await env.DB.prepare(
        `SELECT id, title, created_at, summary_json
         FROM sermons
         WHERE is_public = 1 AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 100`
      ).all<{ id: string; title: string; created_at: string; summary_json: string | null }>();

      const posts = (results || []).map((row) => ({
        id: row.id,
        title: row.title,
        created_at: row.created_at,
        summary: parsePublicSummaryJson(row.summary_json),
      }));
      return new Response(JSON.stringify(posts), { headers: cors });
    }

    const row = await env.DB.prepare(
      `SELECT id, title, created_at, summary_json
       FROM sermons
       WHERE id = ? AND is_public = 1 AND deleted_at IS NULL`
    ).bind(postId).first<{ id: string; title: string; created_at: string; summary_json: string | null }>();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: cors });
    }

    return new Response(JSON.stringify({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      summary: parsePublicSummaryJson(row.summary_json),
    }), { headers: cors });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

async function handleCheckoutAPI(request: Request, env: Env): Promise<Response> {
  const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const auth = await resolveAuth(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: 'Sign in required to subscribe' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { priceId } = (await request.json()) as { priceId?: string };
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Missing priceId' }), { status: 400, headers: jsonHeaders });
    }
    
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), { 
        status: 500,
        headers: jsonHeaders,
      });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const url = new URL(request.url);
    const origin = url.origin;
    const userId = auth.userId;
    const userEmail = auth.email || '';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      customer_email: userEmail || undefined,
      metadata: { userId, priceId },
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: jsonHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500,
      headers: jsonHeaders,
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

  if (event.type === 'checkout.session.completed' && env.DB && env.STRIPE_SECRET_KEY) {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const customerEmail = session.customer_email || session.customer_details?.email;
    if (!userId) return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      await syncUserTierFromStripe(stripe, env.DB, userId, customerEmail || '', session.id);
    } catch (dbErr: any) {
      console.error('Stripe tier sync error:', dbErr.message);
      const priceId = session.metadata?.priceId || '';
      const tier = tierFromPriceId(priceId);
      try {
        await upsertUserTier(
          env.DB,
          userId,
          tier,
          customerEmail || '',
          typeof session.customer === 'string' ? session.customer : null,
          typeof session.subscription === 'string' ? session.subscription : null,
        );
      } catch (fallbackErr: any) {
        console.error('DB upsert fallback error:', fallbackErr.message);
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
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const auth = await resolveAuth(request, env);

  // Paid tier (pro / church) comes from D1 for every verified signed-in user — not a single admin email.
  if (auth.authenticated) {
    return new Response(JSON.stringify({ tier: auth.tier, userId: auth.userId }), { headers: cors });
  }

  return new Response(JSON.stringify({ tier: 'free' }), { headers: cors });
}

async function handleSyncSubscriptionAPI(request: Request, env: Env): Promise<Response> {
  const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const auth = await resolveAuth(request, env);

  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers: cors });
  }
  if (!env.DB || !env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Subscription sync unavailable' }), { status: 503, headers: cors });
  }

  let sessionId: string | undefined;
  let email = '';
  try {
    const body = (await request.json()) as { sessionId?: string; email?: string };
    sessionId = body.sessionId;
    email = body.email || '';
  } catch {
    /* optional body */
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    let tier = await syncUserTierFromStripe(stripe, env.DB, auth.userId, email, sessionId);

    if (tier === 'free' && isFounderAccount(env, auth.userId, email || auth.email)) {
      tier = 'church';
      await upsertUserTier(env.DB, auth.userId, 'church', email || auth.email || '');
    }

    return new Response(JSON.stringify({ tier, userId: auth.userId, synced: true }), { headers: cors });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Sync failed' }), { status: 500, headers: cors });
  }
}

const WHISPER_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
// ── Transcription API ────────────────────────────────────────────────────────

async function handleTranscribeAvailableAPI(env: Env): Promise<Response> {
  return new Response(JSON.stringify({ available: Boolean(env.WHISPER_API_KEY) }), { headers: whisperCors });
}

async function handlePublicConfigAPI(env: Env): Promise<Response> {
  const key = env.CLERK_PUBLISHABLE_KEY;
  return new Response(
    JSON.stringify({
      clerkPublishableKey: key?.startsWith('pk_') ? key : null,
    }),
    { headers: whisperCors },
  );
}

async function handleBibleVerseAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference')?.trim();
  const translation = (url.searchParams.get('translation') || 'kjv').toLowerCase();

  if (!reference) {
    return new Response(JSON.stringify({ error: 'Missing reference query param' }), {
      status: 400,
      headers: whisperCors,
    });
  }

  const auth = await resolveAuth(request, env);
  const rateKey = clientRateLimitKey(request, auth.userId);
  const limit = checkRateLimit(`bible:${rateKey}`, 60, 60_000);
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Bible lookup rate limit exceeded', retryAfterSec: limit.retryAfterSec }),
      { status: 429, headers: { ...whisperCors, 'Retry-After': String(limit.retryAfterSec ?? 60) } },
    );
  }

  try {
    const result = await resolveBibleVerse(reference, translation, env.BIBLE_API_KEY);
    return new Response(
      JSON.stringify({
        reference: result.reference,
        text: result.text,
        translation: result.translation,
      }),
      { headers: whisperCors },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verse lookup failed';
    return new Response(JSON.stringify({ error: message }), { status: 404, headers: whisperCors });
  }
}

async function handleTranscribeSubmitAPI(request: Request, env: Env): Promise<Response> {
  if (!env.WHISPER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Whisper not configured' }), { status: 503, headers: whisperCors });
  }

  const auth = await resolveAuth(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: 'Sign in required for transcription' }), { status: 401, headers: whisperCors });
  }

  const rateKey = `whisper:${auth.userId}`;
  if (!isPaidTier(auth.tier)) {
    const limit = checkRateLimit(rateKey, 5, 3_600_000);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Transcription limit reached. Upgrade for more, or paste a transcript from Voice Memos.',
          retryAfterSec: limit.retryAfterSec,
        }),
        { status: 429, headers: { ...whisperCors, 'Retry-After': String(limit.retryAfterSec ?? 3600) } },
      );
    }
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart file upload' }), { status: 400, headers: whisperCors });
  }

  const formData = await request.formData();
  const fileEntry = formData.get('file');
  if (!fileEntry || typeof fileEntry === 'string') {
    return new Response(JSON.stringify({ error: 'Missing audio file' }), { status: 400, headers: whisperCors });
  }
  const fileBlob = fileEntry as Blob;
  const fileName = (fileEntry as File).name || 'sermon.webm';
  if (fileBlob.size > WHISPER_MAX_UPLOAD_BYTES) {
    return new Response(JSON.stringify({ error: 'File too large (max 100 MB)' }), { status: 413, headers: whisperCors });
  }

  try {
    const result = await submitWhisperTranscription(env.WHISPER_API_KEY, fileBlob, fileName, {
      prompt: WHISPER_SERMON_PROMPT,
    });
    return new Response(JSON.stringify({ taskId: result.task_id, status: result.status }), { headers: whisperCors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Whisper upload failed';
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: whisperCors });
  }
}

async function handleTranscribeStatusAPI(taskId: string, request: Request, env: Env): Promise<Response> {
  if (!env.WHISPER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Whisper not configured' }), { status: 503, headers: whisperCors });
  }

  const auth = await resolveAuth(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers: whisperCors });
  }

  try {
    const data = await fetchWhisperTaskStatus(env.WHISPER_API_KEY, taskId);
    const normalizedStatus = (data.status || '').toLowerCase();
    return new Response(
      JSON.stringify({
        status: normalizedStatus === 'done' || normalizedStatus === 'success' ? 'completed' : normalizedStatus,
        transcript: data.result,
        error: data.error,
      }),
      { headers: whisperCors },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Whisper status check failed';
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: whisperCors });
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

function buildRuntimeConfigHTML(env: Env): string {
  const key = env.CLERK_PUBLISHABLE_KEY;
  if (!key?.startsWith('pk_')) return '';
  const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `<script>window.__RHEMA_RUNTIME__=Object.assign(window.__RHEMA_RUNTIME__||{},{"clerkPublishableKey":"${escaped}"});</script>`;
}

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
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Gemini API not configured on server' }), { status: 503 });
  }

  if (!env.CLERK_SECRET_KEY) {
    console.warn('CLERK_SECRET_KEY missing — signed-in users cannot be verified for AI proxy');
  }

  const auth = await resolveAuth(request, env);
  const rateKey = clientRateLimitKey(request, auth.userId);

  // Harvest / Vine: no app-side rate cap (long sermons = many transcription chunks)
  // Signed-in free: generous limit. Guests: strict limit.
  const skipRateLimit = auth.authenticated && isPaidTier(auth.tier);
  if (!skipRateLimit) {
    const maxReq = auth.authenticated ? 100 : 25;
    const limit = checkRateLimit(rateKey, maxReq, 60_000);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfterSec: limit.retryAfterSec,
          hint: auth.authenticated
            ? 'Long sermon processing sends many AI requests. Wait a minute and try again.'
            : 'Sign in for higher limits on long recordings.',
        }),
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } },
      );
    }
  }

  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > GEMINI_PROXY_MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Request body too large' }), { status: 413 });
  }

  const url = new URL(request.url);
  const targetUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('x-goog-api-key', env.GEMINI_API_KEY);
  headers.delete('host');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
  });

  const out = new Response(response.body, response);
  out.headers.set('X-Rhema-Auth', auth.authenticated ? 'verified' : 'guest');
  out.headers.set('X-Rhema-Tier', auth.tier);
  return out;
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

  const auth = await resolveAuth(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: 'Sign in required for YouTube import' }), { status: 401, headers: cors });
  }
  if (!isPaidTier(auth.tier)) {
    return new Response(JSON.stringify({ error: 'YouTube import requires The Vine or The Harvest plan' }), { status: 403, headers: cors });
  }

  const rateKey = clientRateLimitKey(request, auth.userId);
  const limit = checkRateLimit(`youtube:${rateKey}`, 20, 60_000);
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded', retryAfterSec: limit.retryAfterSec }),
      { status: 429, headers: { ...cors, 'Retry-After': String(limit.retryAfterSec ?? 60) } },
    );
  }

  try {
    const result = await getYouTubeTranscript(targetUrl, false);
    return new Response(JSON.stringify(result), { headers: cors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'YouTube transcript failed';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: cors });
  }
}


