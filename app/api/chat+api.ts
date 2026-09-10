import { ExpoRequest } from 'expo-router/server';

export async function POST(request: ExpoRequest) {
  try {
    const body = await request.json();
    let endpoint = body.endpoint;

    // If the SDK uses this route directly without specifying an endpoint wrapper
    if (!endpoint) {
      endpoint = 'https://toolkit.rork.com/agent/chat';
    }

    if (!endpoint.startsWith('https://toolkit.rork.com')) {
      return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const fetchConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body.messages ? { messages: body.messages } : body)
    };

    const response = await fetch(endpoint, fetchConfig);
    const data = await response.json();

    if (!response.ok) {
        return Response.json({ error: data }, { status: response.status });
    }

    return Response.json(data);
  } catch (error: any) {
    console.error('API proxy error:', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
