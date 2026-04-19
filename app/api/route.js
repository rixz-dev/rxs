export const runtime = 'edge';

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, model, temperature, topP, maxTokens, apiKey } = body;

    // Resolve API key — client-supplied takes priority, then server env
    const key = apiKey?.trim() || process.env.NVIDIA_API_KEY;

    if (!key) {
      return new Response(
        JSON.stringify({
          error: 'No API key configured. Add NVIDIA_API_KEY in Vercel env vars, or set it in the sidebar settings.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      model: model || 'minimaxai/minimax-m2.5',
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      top_p: typeof topP === 'number' ? topP : 0.95,
      max_tokens: typeof maxTokens === 'number' ? maxTokens : 8192,
      stream: true,
    };

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const errorBody = await upstream.text();
      return new Response(errorBody, {
        status: upstream.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Stream the SSE response directly to the client
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
