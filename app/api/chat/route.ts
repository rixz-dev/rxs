// app/api/chat/route.js
// ANERS — Direct chat endpoint (non-agentic)
// Bug #3 FIXED: minimax-m2.7 + deepseek-v3.2 added to allowlist

export const runtime = 'edge';

const ALLOWED_MODELS = new Set([
  // ── NEW: ANERS target models ───────────────────
  'minimaxai/minimax-m2.7',           // Aria default
  'deepseek-ai/deepseek-v3.2',        // Nexus default

  // ── Original models ────────────────────────────
  'minimaxai/minimax-m2.5',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'mistralai/mistral-large-2-instruct',
  'deepseek-ai/deepseek-r1',
  'deepseek-ai/deepseek-r1-0528',
  'qwen/qwq-32b',
  'google/gemma-3-27b-it',
  'microsoft/phi-4',
  'nvidia/mistral-nemo-minitron-8b-8k-instruct',
]);
const MODEL_FALLBACK = 'minimaxai/minimax-m2.7'; // Updated default

export async function POST(req: import("next/server").NextRequest) {
  try {
    const body = await req.json();
    const { messages, model, temperature, topP, maxTokens, apiKey } = body;

    const key = apiKey?.trim() || process.env.NVIDIA_API_KEY;

    if (!key) {
      return new Response(
        JSON.stringify({
          error: 'No API key configured. Add NVIDIA_API_KEY in Vercel env vars, or set it in the sidebar settings.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const safeModel = (typeof model === 'string' && ALLOWED_MODELS.has(model))
      ? model
      : MODEL_FALLBACK;

    // DeepSeek: inject thinking param automatically
    const isDeepSeek = safeModel.startsWith('deepseek');
    const extraParams = isDeepSeek
      ? { chat_template_kwargs: { thinking: true } }
      : {};

    const payload = {
      model:       safeModel,
      messages,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      top_p:       typeof topP       === 'number' ? topP       : 0.95,
      max_tokens:  typeof maxTokens  === 'number' ? maxTokens  : 8192,
      stream:      true,
      ...extraParams,
    };

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${key}`,
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

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection:          'keep-alive',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err instanceof Error ? err.message : 'Internal server error') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
