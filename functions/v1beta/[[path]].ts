interface Env {
  GEMINI_API_KEY: string;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  
  // The original URL requested by the frontend
  const url = new URL(request.url);
  
  // We want to forward the exact same path to the Google API
  // e.g., /v1beta/models/gemini-2.5-flash:generateContent
  const targetUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;
  
  // Clone the request headers so we can modify them
  const headers = new Headers(request.headers);
  
  // Inject the API key from the Cloudflare environment variable
  headers.set('x-goog-api-key', env.GEMINI_API_KEY || '');
  
  // Delete host header to prevent SSL mismatches
  headers.delete('host');
  
  // Forward the request to Google
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });
  
  // Return the response directly to the client
  return response;
};
