/* ============================================================
   Tally AI — Cloudflare Worker (Gemini proxy)
   Holds the Gemini key as a secret, restricts to Tally's origin,
   and returns ONE short coaching suggestion.

   Deploy:
   1. Cloudflare dashboard → Workers & Pages → Create → Worker.
   2. Replace the code with this file, Deploy.
   3. Settings → Variables → add a SECRET named GEMINI_API_KEY.
   4. Copy the Worker URL (…workers.dev) into Tally's app.js (AI_WORKER_URL).
   ============================================================ */

const ALLOWED_ORIGIN = 'https://gerasimosdap-png.github.io';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);

    const origin = request.headers.get('Origin') || '';
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403, cors);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors); }

    const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 40) : [];
    const weekPct = Number.isFinite(body.weekPct) ? body.weekPct : 0;
    const streak = Number.isFinite(body.streak) ? body.streak : 0;

    const summary = tasks
      .map(t => `- ${String(t.title || '').slice(0, 80)} (${String(t.type || '')}): ${String(t.progress || '').slice(0, 40)}`)
      .join('\n');

    const prompt =
`You are a warm, encouraging habit coach inside a calm personal task-tracker called Tally, informed by James Clear's Atomic Habits.

The user's week so far (Monday to Sunday):
Overall completion: ${weekPct}%. Current day-streak: ${streak}.
Tasks:
${summary || '(no active tasks yet)'}

Give ONE short suggestion (under 55 words) to help them this week. Be specific to their data, celebrate what is going well, and offer one tiny, easy next step (habit stacking, a two-minute version, or a clearer cue). Warm, non-judgmental, plain language. No medical, diet, weight, or clinical advice. No preamble or sign-off — just the suggestion.`;

    const key = env.GEMINI_API_KEY;
    if (!key) return json({ error: 'no key configured' }, 500, cors);

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key;
    let g;
    try {
      g = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 220, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
    } catch (e) { return json({ error: 'upstream' }, 502, cors); }

    if (!g.ok) { let d = ''; try { d = (await g.text()).slice(0, 400); } catch (e) {} return json({ error: 'gemini ' + g.status, detail: d }, 502, cors); }
    let data;
    try { data = await g.json(); } catch (e) { return json({ error: 'parse' }, 502, cors); }

    let text = '';
    try { text = data.candidates[0].content.parts[0].text.trim(); } catch (e) {}
    if (!text) return json({ error: 'empty' }, 502, cors);

    return json({ suggestion: text }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
