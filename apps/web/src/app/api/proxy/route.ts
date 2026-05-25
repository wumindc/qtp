import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, method, headers, body } = await req.json();

    // Remove headers that might cause issues with fetch
    const cleanHeaders: Record<string, string> = { ...headers };
    delete cleanHeaders['Host'];
    delete cleanHeaders['Content-Length'];
    
    // In order to support SSE correctly, we just use fetch
    const response = await fetch(url, {
      method,
      headers: cleanHeaders,
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      // If we needed to bypass SSL, we'd need a custom http(s) agent here,
      // but since it's an http:// IP address, standard fetch is fine.
    });

    if (!response.ok) {
      return new Response(await response.text(), {
        status: response.status,
        statusText: response.statusText,
      });
    }

    // Proxy the stream back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
