# Tally AI — v1 Scope (agreed)
*On-demand weekly suggestion, powered by a free Cloudflare Worker + Gemini. Opt-in, privacy-minimal.*

## What we're building
A single button (on the **Stats** tab) called **"Get a suggestion."** When you tap it, Tally sends a small summary of your week to a tiny serverless function, which asks Google's free Gemini model for **one** specific, encouraging, Atomic-Habits-informed suggestion, and shows it in a calm card. Nothing happens unless you tap. AI is **off by default**.

## How it's powered (your chosen option)
```
Tally (browser)  ──POST──▶  Cloudflare Worker  ──▶  Gemini API
   suggestion card  ◀──────   (holds the key,    ◀──   (free tier)
                               rate-limits)
```
- A free **Cloudflare Worker** holds ONE Gemini API key as a secret. Users never see or need a key.
- The Worker rate-limits (per-day cap) and only accepts requests from Tally's domain, so the key can't be abused.
- Both tiers are free: Gemini ~1,500 requests/day, Cloudflare 100,000 requests/day.

## Data sent (privacy-minimal)
Only what's needed for a useful suggestion — **no notes, no full history, no identifiers**:
- Overall: this week's completion % and current day-streak.
- Per active task: title, type (daily / weekday / weekly goal / count-down), target, and this-week progress (e.g. "Stretch — 1/3 this week").
That's it. A clear in-app note says exactly this when you switch AI on.

## What comes back
One short response (< 60 words): warm, specific, non-judgmental — e.g. *"You've hit 'Read' 5 days running — lovely. 'Stretch' is at 1/3; try stacking it right after your evening brush so the cue's automatic."* Tone is a supportive coach; **no medical/clinical advice** (enforced in the prompt + output cap).

## In-app UX
- **Settings → Smart suggestions (AI):** an off-by-default toggle + the privacy note.
- **Stats → "Get a suggestion":** appears only when AI is on. Tap → brief spinner → suggestion card (reuses the calm info-card style). Tap again for another. Needs a connection; fails gracefully offline.
- **AI disclosure on every response:** each suggestion card carries a clear, visible label — “✨ AI-generated — a suggestion, not gospel” — so it's never mistaken for fact or a person. Always shown, never optional.

## Guardrails
Opt-in · minimal payload · transparent · **visible AI-generated disclosure on every response** · coach tone · no medical advice · short output · Worker-side rate limit + origin check.

## What I'll build (no accounts needed yet)
1. `worker.js` — the Cloudflare Worker: CORS for your domain, payload validation, Gemini call with the coaching prompt, daily rate-limit, error handling.
2. Tally side — the Settings toggle, the Stats button, the suggestion card, the fetch + states (loading/error), all behind the AI flag.
3. QA — verify the UI/flow with a mocked Worker response (no live key needed for tests).

## What you'll need to provide (one-time, to go live)
1. A **free Gemini API key** from Google AI Studio (no credit card).
2. A **free Cloudflare account** (you create it — I can't make accounts or enter credentials).
Then I'll guide you to paste the Worker code in Cloudflare's dashboard, set the key as a secret, and copy the Worker URL into Tally. ~10 minutes together.

## Sequence
- **Now:** I build the Worker code + Tally integration + QA (works with a mock).
- **Then:** you grab the Gemini key + Cloudflare account; we deploy the Worker and wire the URL in.
- **Later (separate phase):** proactive "need help?" check-in, task clarifier — only after this loop is proven.

## Cost: £0 within free tiers.
