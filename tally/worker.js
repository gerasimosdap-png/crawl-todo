/* ============================================================
   Tally AI — Cloudflare Worker (Gemini proxy)
   modes: clarify, assist, stack, coach, ask   (default: coach)
   per-mode output budgets keep small calls cheap + fast.
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

    const mode = ['clarify', 'assist', 'stack', 'coach', 'ask'].includes(body.mode) ? body.mode : 'coach';

    const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 40) : [];
    const weekPct = Number.isFinite(body.weekPct) ? body.weekPct : 0;
    const streak = Number.isFinite(body.streak) ? body.streak : 0;
    const summary = tasks
      .map(t => `- ${String(t.title || '').slice(0, 80)} (${String(t.type || '')}): ${String(t.progress || '').slice(0, 40)}`)
      .join('\n');
    const insights = String(body.insights || '').slice(0, 800);
    const question = String(body.question || '').slice(0, 300);
    const lastTip = String(body.lastTip || '').slice(0, 300);

    let prompt;
    if (mode === 'clarify') {
      const title = String(body.title || '').slice(0, 120);
      if (!title) return json({ error: 'no title' }, 400, cors);
      prompt =
`Rewrite this personal task into a clearer, more doable version with a simple implementation intention (what, and when or where), under 12 words. Keep the person's intent and tone. Reply with ONLY the rewritten task — no quotes, no preamble, no options.
Task: ${title}`;
    } else if (mode === 'assist') {
      const title = String(body.title || '').slice(0, 120);
      if (!title) return json({ error: 'no title' }, 400, cors);
      prompt =
`The user has this task to do: "${title}". Actually help them do it — give a concrete, ready-to-use answer. For "plan a healthy meal" suggest one specific balanced meal; for a workout suggest a short routine; for "study X" a quick 10-minute plan; for an errand a brief checklist. Under 70 words, friendly and practical. Keep any food or exercise tips general and gentle — no medical, calorie, weight-loss, or clinical advice.`;
    } else if (mode === 'stack') {
      const title = String(body.title || '').slice(0, 120);
      if (!title) return json({ error: 'no title' }, 400, cors);
      const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, 10).map(a => String(a).slice(0, 60)) : [];
      prompt =
`The user wants to build this habit: "${title}". Habits they already do regularly: ${anchors.join(', ') || '(none given)'}. Suggest ONE habit stack in the form "After [an existing habit], I will [the new habit]." Pick the most natural existing anchor; if none fit, suggest a simple time-or-place cue instead. Under 20 words. Reply with only the one sentence.`;
    } else if (mode === 'ask') {
      prompt =
`The user is asking about their own habit-tracker data. Answer their question directly and warmly in under 80 words, grounded in the numbers below. If the data can't answer it, say so kindly and offer your best general tip. No medical, diet, or clinical advice. No preamble.
Question: ${question}
Week: ${weekPct}% of planned, a ${streak}-day streak.
Patterns detected: ${insights || '(none yet)'}
Tasks:
${summary || '(none)'}`;
    } else {
      // coach (default)
      prompt =
`You are a warm, sharp habit coach in a calm tracker called Tally. Using the user's real data, write a short coaching note under 75 words, in three beats: (1) a genuine win, (2) one pattern you notice (lean on the detected patterns), (3) one tiny, specific next step.
Week: ${weekPct}% of planned, a ${streak}-day streak.
Patterns detected: ${insights || '(none yet)'}
Tasks:
${summary || '(none)'}${lastTip ? `\nYour last tip to them was: "${lastTip}" — build on it, don't repeat it.` : ''}
Warm, plain language, no guilt, no bulleted advice, no medical or diet advice. No preamble.`;
    }

    const key = env.GEMINI_API_KEY;
    if (!key) return json({ error: 'no key configured' }, 500, cors);

    const maxTokens = { clarify: 60, stack: 70, assist: 256, coach: 256, ask: 288 }[mode] || 256;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key;
    let g;
    try {
      g = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
    } catch (e) { return json({ error: 'upstream' }, 502, cors); }

    if (!g.ok) { let d = ''; try { d = (await g.text()).slice(0, 400); } catch (e) {} return json({ error: 'gemini ' + g.status, detail: d }, 502, cors); }
    let data;
    try { data = await g.json(); } catch (e) { return json({ error: 'parse' }, 502, cors); }

    let text = '';
    try { text = data.candidates[0].content.parts[0].text.trim(); } catch (e) {}
    if (!text) return json({ error: 'empty' }, 502, cors);

    const keyName = { clarify: 'clarified', assist: 'assist', stack: 'stack', ask: 'answer' }[mode] || 'coach';
    return json({ [keyName]: text }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
