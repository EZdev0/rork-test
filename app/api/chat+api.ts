import { ExpoRequest } from 'expo-router/server';

export async function POST(request: ExpoRequest) {
  try {
    const clonedReq = request.clone();
    let body;
    try {
      body = await clonedReq.json();
    } catch {
      body = {};
    }
    
    let endpoint = body.endpoint || 'https://toolkit.rork.com/agent/chat';

    if (!endpoint.startsWith('https://toolkit.rork.com')) {
      return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    // Forward the original request body as text
    const textBody = await request.text();

    const fetchConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: textBody
    };

    const response = await fetch(endpoint, fetchConfig);
    
    // Return the response directly to preserve streaming
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      }
    });
  } catch (error: any) {
    console.error('API proxy error:', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
