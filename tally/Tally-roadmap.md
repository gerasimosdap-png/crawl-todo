# Tally — Product Roadmap
*Turning a calm tracker into a habit system that actually helps people change.*

---

## North star: Tally as a habit *system*, not a checklist

Today Tally records what you do. The opportunity is to make it quietly **coach** — nudge the right behaviour at the right moment and make showing up easier. James Clear's *Atomic Habits* gives us a clean spine for that, and almost everything below hangs off it.

### Atomic Habits in one breath
- **Systems beat goals.** "You do not rise to the level of your goals; you fall to the level of your systems." Tally's job is to build the *weekly system*, not just store the goal.
- **Identity-based habits.** "I'm someone who moves every day" beats "I want to exercise." Every completion is a small vote for that identity.
- **Compounding & the plateau of latent potential.** 1% gains compound, but results lag effort — so the tracker's real job is keeping you going through the flat stretch.
- **The Four Laws of Behaviour Change** — the practical engine. A habit runs cue → craving → response → reward, and each law targets one step:

| Law | Clear's rule | In Tally |
|---|---|---|
| 1 · Cue | Make it **obvious** | right task on the right day/time; reminders; *appear-from* dates; implementation intentions ("after X, I'll do Y"); habit stacking |
| 2 · Craving | Make it **attractive** | calm design, celebrations, reward prompts, identity framing |
| 3 · Response | Make it **easy** | one-tap logging, two-minute versions, scaling a goal down when you struggle, friction-busting help |
| 4 · Reward | Make it **satisfying** | the completion moment, the reward nudge, visible weekly progress, forgiving "never miss twice" |

### What Tally already does well
- **Law 4 (satisfying):** weekly-goal + 100% celebrations and the reward prompt — done.
- **Law 1 (obvious):** daily reminder + Mon–Sun week dots — partial.
- **Law 3 (easy):** one-tap logging, count-up goals — partial.
- We deliberately avoided punishing streaks (no "what-the-hell effect"), matching Clear's **never miss twice**.

### Gaps the framework says to close
1. **Cues & implementation intentions** — tasks need *when/where*, not just *what*. → date scheduling, time-of-day, habit stacking.
2. **Make it easy when failing** — when a goal is being missed, reduce friction, don't guilt. → AI friction-buster.
3. **Identity & reflection** — frame goals as identity; reflect weekly. → AI reflection + copy tweaks.
4. **Two-minute rule** — every habit should have a scaled-down version. → task field + AI suggestion.

---

## NOW — quick win: richer icon vocabulary (~30 min)

The keyword→icon dictionary is good but thin in places (pilates, calisthenics, "hobby", etc. fall through). Plan: broaden the keyword lists, reusing existing emoji where sensible and adding a handful of new ones. Examples to add:

- **Movement:** pilates, calisthenics, hiit, crossfit, climbing, dance, martial arts, boxing, rowing, skip/jump rope, physio/rehab
- **Hobbies/leisure:** hobby, paint/pottery/craft (broaden), board game, puzzle, garden (broaden), fishing, baking (broaden)
- **Mind/admin:** budget review, plan week, journal prompts, breathwork, podcast, audiobook
- **Care/home:** meal prep, water filter, change sheets, plants (broaden), pet vet
- Plus a sensible **default icon** (e.g. a soft dot/✦) when nothing matches, so no task looks bare.

Low risk, instantly visible. Can ship today.

---

## MEDIUM — date-scheduled & "appear-from" tasks (~half a day)

### The need
Not everything is a weekly habit. "Buy Christmas gifts" should sit hidden until ~Dec 10, then appear (ideally as a count-down), and disappear once done. That's **Law 1** done right: the cue shows up at the *right time* instead of cluttering your week for months.

### Design
Add two optional date fields to the task model:
- **Show from** (`startDate`) — task stays hidden until this date.
- **Due by** (`dueDate`, optional) — a soft deadline; afterwards it surfaces gently as overdue (never red/shouty).

These compose with the existing types:
- **Count-down + Show-from** = *"appears Dec 10, do it N times, then it's done"* — exactly the Christmas-gifts case.
- **One-off + Due-by** = *"Renew passport by 14 Mar"* (a light `once` behaviour).
- **Daily / weekly habits** ignore dates — unchanged. Week counter stays Mon–Sun.

### UX
- Editor gains an optional **Show from** and **Due by** picker, tucked under a "More" toggle so the calm default stays calm.
- Later: natural language — "buy gifts from dec 10", "passport by mar 14".
- A small, optional **"Coming up"** peek on Today, or keep future tasks fully hidden until the day — your call (I lean: hidden, with an optional peek).
- Ties nicely into the read-only Google Calendar strip.

### Sketch
`task.startDate` / `task.dueDate` (YYYY-MM-DD); `scheduledOnDate()` also checks `d >= startDate`; dated one-offs excluded from the weekly-habit rate (like finite goals). Editor + QA ≈ half a day, no external dependencies.

---

## LONG — an AI coach inside Tally

### "Can we link Claude or ChatGPT for free?"
Honest answer: **not through their APIs.** Neither OpenAI (ChatGPT) nor Anthropic (Claude) has a free programmatic tier — both bill per token. So wiring those two in "for free" isn't realistic for a hosted app.

**Free is very possible with other providers**, and we can build provider-agnostic:
- **Google Gemini API** — the most generous free tier: ~**1,500 requests/day** on Gemini Flash, **no credit card**, just a Google account. More than enough for personal/beta coaching.
- **Groq** — free, no card, and extremely fast (Llama 3.3 70B at 700+ tokens/sec), ~1,000 req/day. Great for snappy suggestions.
- **Recommendation:** start on **Gemini Flash** (quality + free), keep Groq as a fast fallback.

### The key architecture question (cost & safety)
An API key embedded in a public web app can be extracted and abused. Two clean options:
1. **Bring-your-own-key (recommended first):** the user pastes their own free Gemini key in Settings; calls go straight from their browser. Free for them, no shared quota, zero abuse exposure for you. Ideal for a beta.
2. **Tiny serverless proxy:** a free **Cloudflare Worker** holds *your* key, rate-limits per user, and the app calls the Worker. Users do nothing, but it's a small build + ongoing guardrails.

Ship BYO-key first; add a Worker proxy if it goes wider.

### What the coach does — mapped to the four laws (and not just exercise)
Each task already carries a category from the icon engine, which gives the AI context.

1. **Task clarifier — Law 1 (obvious).** On adding a vague task, offer a sharper version with a cue + implementation intention: *"Exercise" → "10-minute walk after lunch, Mon/Wed/Fri."* One tap to accept. Turns wishes into cued behaviours.
2. **Two-minute / scale-down — Law 3 (easy).** Every habit gets an optional tiny version. Set "Run 3×/week" and it offers *"On hard days: just put your shoes on and step outside."* Lowers the activation energy.
3. **Friction-buster / proactive check-in — Law 3, kindly.** *Your idea:* when you're behind (e.g. 0/3 by Thursday), Tally gently asks *"Want help with this one?"* → a 2–3 question mini-interview (What's getting in the way — time? energy? not sure how?) → a tailored, **smaller** next step. Stretching → a 5-min routine; French → 10-min Duolingo + a cue; tidying → a 5-minute reset. Domain-agnostic because it **asks** instead of assuming. Always framed as help, never a scold.
4. **Weekly reflection & identity — Laws 4 & 2.** A short, warm Sunday note from your data: what you showed up for, a gentle pattern ("mornings work better for you"), and identity framing ("you're becoming someone who reads").
5. **Habit-stacking — Law 1.** *"You already make coffee daily — stack 'take vitamins' right after it."* Uses your existing daily tasks as anchors.

### Guardrails (non-negotiable)
- **Opt-in & transparent:** AI off by default; a clear note that task text is sent to the provider when on; **minimal payload** (the relevant task + a little context, never your whole history).
- **Tone:** supportive life-coach, never judgmental; celebrate effort over outcome.
- **Safety:** no medical/clinical advice; for exercise, food, sleep or mood it offers gentle, general, non-prescriptive ideas and defers to professionals for anything health-significant. No calorie targets, no intense regimens.
- **Privacy:** BYO-key keeps data flowing only between the user and their own Google account.

### Rollout
- **Phase A:** task clarifier + scale-down (one API call on task create). Low risk, high delight.
- **Phase B:** proactive friction-buster check-in (triggered by missed goals).
- **Phase C:** weekly reflection + habit-stacking.

---

## Suggested sequence
1. **Now:** icon vocabulary (~30 min).
2. **Next:** date-scheduled / appear-from tasks (~½ day) — concrete, no external deps, unlocks the Christmas-gifts case.
3. **Then:** AI Phase A with a bring-your-own free Gemini key (~½–1 day), opt-in.
4. **Later:** AI Phases B–C + optional Cloudflare proxy as it scales.

## Decisions I need from you
1. **Future-dated tasks:** fully hidden until the day, or a faint "Coming up" peek?
2. **AI keys:** start with bring-your-own free Gemini key, or should I stand up a free Cloudflare Worker proxy so users do nothing?
3. **AI scope first:** just the task clarifier, or clarifier **+** the proactive "need help?" check-in?

---

### Sources
- James Clear — *Atomic Habits* summary & the Four Laws of Behaviour Change: https://jamesclear.com/atomic-habits-summary
- Free LLM API tiers in 2026 (Gemini, Groq, comparisons): https://openrouter.ai/blog/tutorials/free-llm-apis-compared/ · https://tokenmix.ai/blog/gemini-api-free-tier-limits
