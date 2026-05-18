/**
 * functions/api/sermons.ts
 * 
 * API handler for sermon storage using Cloudflare D1.
 */

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Simple routing
  if (path === '/api/sermons' && method === 'GET') {
    return handleList(env);
  }
  
  if (path === '/api/sermons' && method === 'POST') {
    return handleCreate(request, env);
  }

  const idMatch = path.match(/^\/api\/sermons\/([^/]+)/);
  if (idMatch) {
    const id = idMatch[1];
    if (method === 'GET')    return handleGet(id, env);
    if (method === 'PATCH')  return handleUpdate(id, request, env);
    if (method === 'DELETE') return handleDelete(id, env);
  }

  return new Response('Not Found', { status: 404 });
};

async function handleList(env: Env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM sermons WHERE deleted_at IS NULL ORDER BY created_at DESC"
    ).all();
    return Response.json(results);
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
}

async function handleCreate(request: Request, env: Env) {
  try {
    const body: any = await request.json();
    const { id, user_id, title, main_topic, clean_transcript, source_type, summary_json } = body;

    await env.DB.prepare(
      "INSERT INTO sermons (id, user_id, title, main_topic, clean_transcript, source_type, summary_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, user_id || 'guest', title, main_topic, clean_transcript, source_type || 'text', summary_json || null).run();

    return new Response('Created', { status: 201 });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
}

async function handleGet(id: string, env: Env) {
  const result = await env.DB.prepare(
    "SELECT * FROM sermons WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).first();
  
  if (!result) return new Response('Not Found', { status: 404 });
  return Response.json(result);
}

async function handleUpdate(id: string, request: Request, env: Env) {
  const body: any = await request.json();
  const { title, main_topic, clean_transcript, summary_json } = body;

  await env.DB.prepare(
    "UPDATE sermons SET title = ?, main_topic = ?, clean_transcript = ?, summary_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(title, main_topic, clean_transcript, summary_json || null, id).run();

  return new Response('Updated');
}

async function handleDelete(id: string, env: Env) {
  await env.DB.prepare(
    "UPDATE sermons SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(id).run();
  return new Response('Deleted');
}
