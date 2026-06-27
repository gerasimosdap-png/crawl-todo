/* ============================================================
   Tally — calm personal task tracker.  Vanilla JS, no deps.
   ============================================================ */

const STORE_KEY = 'tally.v1';
const THEMES = ['sage', 'sand', 'sky', 'blush', 'lavender', 'slate', 'charcoal'];
const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index 0..6 => Mon..Sun
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let S = null;
let currentView = 'today';
let editingId = null;
let lastUndo = null;        // { taskId, ts } for undo
let reminderTimer = null;
let viewDayKey = null;      // null => live "today"; otherwise a YYYY-MM-DD within this week

/* ---------------- Auto-icons + encouraging tips ----------------
   Curated keyword->icon dictionary (matched as word-prefixes against the
   task title). Order matters: more specific entries come first. Each entry
   maps to an emoji + a tip key used by the discreet info button.
----------------------------------------------------------------- */
const ICONS = [
  { kw: ['plant', 'garden', 'flower', 'repot'], emoji: '🪴', tip: 'nature' },
  { kw: ['water', 'hydrat', 'drink'], emoji: '💧', tip: 'hydration' },
  { kw: ['coffee'], emoji: '☕', tip: 'coffee' },
  { kw: ['tea'], emoji: '🍵', tip: 'coffee' },
  { kw: ['run', 'jog', 'sprint', 'marathon', 'parkrun'], emoji: '🏃', tip: 'movement' },
  { kw: ['walk', 'steps', 'stroll'], emoji: '🚶', tip: 'movement' },
  { kw: ['yoga'], emoji: '🧘', tip: 'movement' },
  { kw: ['stretch', 'mobility', 'physio', 'rehab'], emoji: '🤸', tip: 'movement' },
  { kw: ['pilates', 'calisthenic', 'callisthenic', 'core workout', 'bodyweight', 'gymnastics'], emoji: '🤸', tip: 'movement' },
  { kw: ['gym', 'workout', 'lift', 'weight', 'exercise', 'train', 'pushup', 'press-up', 'plank', 'hiit', 'crossfit', 'bootcamp', 'strength', 'squat', 'lunge', 'situp', 'sit-up', 'burpee', 'kettlebell', 'dumbbell', 'deadlift', 'treadmill', 'elliptical', 'spin class'], emoji: '🏋️', tip: 'movement' },
  { kw: ['swim'], emoji: '🏊', tip: 'movement' },
  { kw: ['bike', 'cycl'], emoji: '🚴', tip: 'movement' },
  { kw: ['climb', 'bouldering'], emoji: '🧗', tip: 'movement' },
  { kw: ['dance', 'dancing', 'zumba', 'ballet', 'barre'], emoji: '💃', tip: 'movement' },
  { kw: ['boxing', 'kickbox', 'sparring', 'martial', 'karate', 'judo', 'taekwondo', 'jiu', 'mma'], emoji: '🥊', tip: 'movement' },
  { kw: ['row', 'rowing', 'kayak', 'canoe', 'paddleboard'], emoji: '🚣', tip: 'movement' },
  { kw: ['surf'], emoji: '🏄', tip: 'movement' },
  { kw: ['football', 'soccer'], emoji: '⚽', tip: 'movement' },
  { kw: ['basketball', 'netball'], emoji: '🏀', tip: 'movement' },
  { kw: ['tennis', 'padel', 'badminton', 'squash'], emoji: '🎾', tip: 'movement' },
  { kw: ['table tennis', 'ping pong'], emoji: '🏓', tip: 'movement' },
  { kw: ['golf'], emoji: '⛳', tip: 'movement' },
  { kw: ['cricket'], emoji: '🏏', tip: 'movement' },
  { kw: ['rugby'], emoji: '🏉', tip: 'movement' },
  { kw: ['skiing', 'snowboard'], emoji: '🎿', tip: 'movement' },
  { kw: ['skate', 'skateboard', 'rollerblade'], emoji: '🛹', tip: 'movement' },
  { kw: ['sport'], emoji: '🏅', tip: 'movement' },
  { kw: ['meditat', 'breath', 'mindful'], emoji: '🧘', tip: 'mind' },
  { kw: ['pray', 'scripture', 'church', 'bible', 'worship'], emoji: '🙏', tip: 'mind' },
  { kw: ['therapy', 'therapist', 'counsel'], emoji: '🧠', tip: 'mind' },
  { kw: ['sleep', 'nap', 'bedtime', 'lights out'], emoji: '😴', tip: 'sleep' },
  { kw: ['read', 'book', 'chapter'], emoji: '📖', tip: 'reading' },
  { kw: ['study', 'revis', 'homework', 'learn', 'course', 'lecture'], emoji: '📚', tip: 'study' },
  { kw: ['podcast', 'audiobook'], emoji: '🎧', tip: 'reading' },
  { kw: ['news', 'newspaper'], emoji: '📰', tip: 'reading' },
  { kw: ['languag', 'spanish', 'french', 'german', 'italian', 'duolingo'], emoji: '🗣️', tip: 'language' },
  { kw: ['journal', 'diary', 'gratitude'], emoji: '📓', tip: 'journal' },
  { kw: ['writ', 'blog'], emoji: '✍️', tip: 'journal' },
  { kw: ['draw', 'paint', 'sketch', 'art', 'craft', 'knit', 'crochet', 'sew'], emoji: '🎨', tip: 'practice' },
  { kw: ['hobby', 'hobbies', 'pottery', 'ceramics', 'origami', 'calligraphy', 'scrapbook', 'woodwork', 'whittl', 'model kit', 'lego'], emoji: '🎨', tip: 'practice' },
  { kw: ['photo', 'camera', 'photograph'], emoji: '📷', tip: 'practice' },
  { kw: ['piano', 'guitar', 'music', 'practi', 'sing', 'violin', 'drums'], emoji: '🎵', tip: 'practice' },
  { kw: ['puzzle', 'jigsaw', 'crossword', 'sudoku', 'chess', 'board game', 'wordle'], emoji: '🧩', tip: 'selfcare' },
  { kw: ['game', 'gaming', 'xbox', 'playstation'], emoji: '🎮', tip: 'selfcare' },
  { kw: ['movie', 'netflix', 'cinema'], emoji: '🎬', tip: 'selfcare' },
  { kw: ['floss', 'brush', 'teeth', 'dental'], emoji: '🦷', tip: 'dental' },
  { kw: ['skincare', 'skin care', 'moisturi', 'serum', 'sunscreen', 'spf'], emoji: '🧴', tip: 'selfcare' },
  { kw: ['shower', 'bath'], emoji: '🚿', tip: 'selfcare' },
  { kw: ['haircut', 'barber', 'salon', 'nails', 'shave'], emoji: '💇', tip: 'selfcare' },
  { kw: ['makeup', 'make-up'], emoji: '💄', tip: 'selfcare' },
  { kw: ['spa day', 'sauna', 'hot tub', 'massage'], emoji: '🧖', tip: 'selfcare' },
  { kw: ['relax', 'unwind', 'me time', 'me-time', 'self-care', 'rest day', 'wind down', 'leisure'], emoji: '🌿', tip: 'selfcare' },
  { kw: ['doctor', 'dentist', 'appointment', 'appt', 'clinic'], emoji: '🩺', tip: 'health' },
  { kw: ['pill', 'meds', 'medic', 'supplement', 'vitamin'], emoji: '💊', tip: 'meds' },
  { kw: ['cook', 'meal', 'breakfast', 'lunch', 'dinner', 'bake'], emoji: '🍳', tip: 'nutrition' },
  { kw: ['fruit', 'veg', 'salad', 'greens', 'recipe', 'snack', 'smoothie'], emoji: '🥗', tip: 'nutrition' },
  { kw: ['laundry', 'iron', 'ironing'], emoji: '🧺', tip: 'chores' },
  { kw: ['dishes', 'dishwash'], emoji: '🍽️', tip: 'chores' },
  { kw: ['clean', 'tidy', 'vacuum', 'hoover', 'declutter', 'wash', 'mop', 'make bed'], emoji: '🧹', tip: 'chores' },
  { kw: ['bin', 'bins', 'rubbish', 'trash', 'recycle', 'recycling'], emoji: '🗑️', tip: 'chores' },
  { kw: ['fix', 'repair', 'diy', 'assemble'], emoji: '🔧', tip: 'work' },
  { kw: ['mow', 'lawn', 'weed', 'rake'], emoji: '🌿', tip: 'nature' },
  { kw: ['nature', 'outdoor', 'outside', 'fresh air', 'park', 'hike'], emoji: '🌳', tip: 'nature' },
  { kw: ['camping', 'campsite'], emoji: '🏕️', tip: 'nature' },
  { kw: ['fishing', 'angling'], emoji: '🎣', tip: 'nature' },
  { kw: ['birdwatch', 'birding'], emoji: '🐦', tip: 'nature' },
  { kw: ['dog'], emoji: '🐕', tip: 'pet' },
  { kw: ['cat'], emoji: '🐈', tip: 'pet' },
  { kw: ['pet', 'litter'], emoji: '🐾', tip: 'pet' },
  { kw: ['call', 'phone', 'ring'], emoji: '📞', tip: 'social' },
  { kw: ['text', 'message'], emoji: '💬', tip: 'social' },
  { kw: ['famil', 'mum', 'mom', 'dad', 'parent', 'partner', 'friend', 'sister', 'brother', 'grandma', 'grandpa'], emoji: '💛', tip: 'social' },
  { kw: ['kids', 'children', 'baby', 'school run', 'nursery', 'playdate'], emoji: '🧸', tip: 'social' },
  { kw: ['date night', 'anniversary dinner'], emoji: '💞', tip: 'social' },
  { kw: ['birthday', 'gift', 'anniversary'], emoji: '🎁', tip: 'social' },
  { kw: ['volunteer', 'charity', 'donate'], emoji: '🤝', tip: 'social' },
  { kw: ['email', 'inbox'], emoji: '✉️', tip: 'work' },
  { kw: ['meeting', 'standup'], emoji: '📅', tip: 'work' },
  { kw: ['code', 'coding', 'program', 'debug'], emoji: '💻', tip: 'work' },
  { kw: ['clothes', 'shop', 'shopping', 'outfit', 'wardrobe', 'shoes'], emoji: '🛍️', tip: 'shopping' },
  { kw: ['grocer', 'supermarket', 'food shop'], emoji: '🛒', tip: 'errands' },
  { kw: ['errand', 'post office', 'pharmacy', 'returns'], emoji: '🧾', tip: 'errands' },
  { kw: ['travel', 'holiday', 'vacation', 'flight', 'plane', 'airport', 'pack', 'hotel'], emoji: '✈️', tip: 'travel' },
  { kw: ['car', 'drive', 'fuel', 'petrol', 'tyre'], emoji: '🚗', tip: 'car' },
  { kw: ['pay', 'bill', 'rent', 'budget', 'saving', 'money', 'invoice', 'finance'], emoji: '💰', tip: 'finance' },
  { kw: ['investment', 'investing', 'stocks', 'shares', 'trading', 'portfolio', 'crypto', 'pension', 'isa'], emoji: '📈', tip: 'finance' },
  { kw: ['plan', 'organi', 'schedule', 'todo', 'to-do'], emoji: '🗂️', tip: 'work' },
  { kw: ['work', 'report', 'project', 'admin'], emoji: '💼', tip: 'work' }
];

const TIPS = {
  hydration: { lead: 'Small sips add up. 💧', points: ['Even mild hydration supports focus, mood and steady energy.', 'Keep a glass where you’ll see it — a visible cue makes it easy.'] },
  movement: { lead: 'Every bit of movement counts.', points: ['Moving your body lifts your mood and clears your head — even five minutes helps.', 'Done beats perfect. Show up, keep it light, be proud you moved.'] },
  mind: { lead: 'A few slow breaths is enough to begin.', points: ['Short, regular practice gently calms the nervous system over time.', 'You don’t need to “empty your mind” — simply noticing is the practice.'] },
  sleep: { lead: 'Rest is productive too.', points: ['A steady wind-down tells your body it’s safe to switch off.', 'Dimming screens before bed makes falling asleep easier.'] },
  reading: { lead: 'A single page is still progress.', points: ['Regular reading sharpens focus and eases stress.', 'Leave the book somewhere visible — momentum loves a cue.'] },
  study: { lead: 'Consistency beats cramming.', points: ['Short, frequent sessions help things actually stick.', 'Start before you feel ready — beginning is the hardest part.'] },
  journal: { lead: 'A line a day is plenty.', points: ['Noting a few good moments trains your attention toward them.', 'No need for polished prose — bullet points count.'] },
  dental: { lead: 'Tiny habit, real payoff.', points: ['Daily brushing and flossing protect your gums and overall health.', 'Pair it with something you already do so it sticks.'] },
  selfcare: { lead: 'Caring for yourself isn’t a luxury.', points: ['Small rituals are steadying anchors in a busy day.', 'Be as kind to yourself as you’d be to a good friend.'] },
  meds: { lead: 'Future-you says thank you.', points: ['Taking it at the same time each day makes it automatic.', 'Keep it beside something you use daily as a gentle reminder.'] },
  nutrition: { lead: 'Add, don’t restrict.', points: ['One extra serving of veg or fruit is a genuine win.', 'Cooking at home is a quiet act of self-care — and it counts.'] },
  chores: { lead: 'A tidy space, a calmer mind.', points: ['Five focused minutes is often enough to break the inertia.', 'Done in small pieces still gets done.'] },
  nature: { lead: 'A little green goes a long way.', points: ['Time outdoors lifts mood and lowers stress.', 'Morning daylight helps you sleep better that night.'] },
  pet: { lead: 'They’re lucky to have you.', points: ['Caring routines are good for them and grounding for you.', 'A walk together counts as movement, too.'] },
  social: { lead: 'Connection is a real need, not a nicety.', points: ['A short hello can lift two people’s days at once.', 'Reaching out builds the support you’ll be glad to have later.'] },
  work: { lead: 'Start small, build momentum.', points: ['Two minutes in often turns into real progress.', 'One clear next step beats a vague, looming task.'] },
  finance: { lead: 'Small, steady steps build security.', points: ['Handling it now saves a lot of future stress.', 'Automate what you can so it quietly takes care of itself.'] },
  practice: { lead: 'Skill grows in small, regular reps.', points: ['Short daily practice outperforms rare long sessions.', 'Enjoy the process — that’s what keeps you coming back.'] },
  language: { lead: 'A few words a day compounds.', points: ['Tiny, daily exposure beats the occasional marathon.', 'Mistakes are how it sticks — keep going.'] },
  coffee: { lead: 'A warm moment to yourself.', points: ['A mindful pause with your drink is a small daily reset.', 'Pairing it with water keeps you comfortably hydrated.'] },
  shopping: { lead: 'A little planning makes shopping calmer.', points: ['A quick list keeps it focused — and saves money.', 'Buying what you genuinely need is care, not indulgence.'] },
  errands: { lead: 'Knock the little jobs out together.', points: ['Batching errands saves time and mental load.', 'One small errand done is one less thing on your mind.'] },
  travel: { lead: 'A bit of prep, a smoother trip.', points: ['Packing a little early turns travel from stressful to exciting.', 'Trips and breaks recharge you — they are not time wasted.'] },
  car: { lead: 'A cared-for car is one less worry.', points: ['Small upkeep now prevents bigger costs later.', 'Future-you will be glad you sorted it.'] },
  health: { lead: 'Your health deserves to be a priority.', points: ['Booking and keeping appointments is real self-care.', 'A quick check now brings peace of mind.'] },
  generic: { lead: 'Showing up is the whole game.', points: ['Small actions, repeated, quietly become who you are.', 'Be proud of consistency over intensity.'] }
};

function matchIcon(title) {
  const s = (title || '').toLowerCase();
  for (const e of ICONS) { for (const k of e.kw) { if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(s)) return e; } }
  return null;
}
function taskIcon(t) { const m = matchIcon(t.title); return m ? m.emoji : ''; }
function getTip(title) { const m = matchIcon(title); return TIPS[(m && m.tip) || 'generic']; }

/* ---------------- Date helpers (local, Monday-start) ---------------- */
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayKey() { return dateKey(new Date()); }
// Monday = 0 ... Sunday = 6
function dowMon(d) { return (d.getDay() + 6) % 7; }
function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - dowMon(x)); return x; }
function weekKey(d) { return dateKey(mondayOf(d || new Date())); }
function weekDates(ref) { const m = mondayOf(ref || new Date()); return Array.from({ length: 7 }, (_, i) => { const x = new Date(m); x.setDate(m.getDate() + i); return x; }); }
function sameWeek(k, ref) { return weekKey(new Date(k)) === weekKey(ref || new Date()); }

/* ---------------- State ---------------- */
function defaultState() {
  return {
    version: 1,
    tasks: [],
    settings: { theme: 'sage', notify: false, reminderTime: '20:00', name: '', lastNotifyDay: '', gcalConnected: false, gcalShow: true, gcalClientId: '', celebratedWeek: '', syncEnabled: false, aiEnabled: false },
    onboarded: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) S = Object.assign(defaultState(), JSON.parse(raw)); } catch (e) {}
  if (!S) S = defaultState();
  if (!S.settings) S.settings = defaultState().settings;
  if (!Array.isArray(S.tasks)) S.tasks = [];
}
function save() { S.updatedAt = Date.now(); try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} if (typeof fbSchedulePush === 'function') fbSchedulePush(); }
function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------------- Task model helpers ----------------
   task = { id, title, type:'daily'|'weekdays'|'weekly'|'finite',
            days:[0..6], target:N, completions:[ISO...], archived:bool, createdAt }
-------------------------------------------------------- */
function newTask(o) {
  return Object.assign({ id: uid(), title: '', type: 'daily', days: [], target: 3, completions: [], archived: false, startDate: '', dueDate: '', createdAt: Date.now() }, o);
}
function compsOn(t, key) { return (t.completions || []).filter(ts => dateKey(new Date(ts)) === key).length; }
function compsThisWeek(t, ref) { return (t.completions || []).filter(ts => sameWeek(dateKey(new Date(ts)), ref)).length; }
function totalComps(t) { return (t.completions || []).length; }
function doneToday(t) { return compsOn(t, todayKey()) > 0; }

// Is the task expected to appear in Today's list at all?
function scheduledToday(t) {
  if (t.archived) return false;
  if (t.startDate && todayKey() < t.startDate) return false;
  if (t.type === 'daily') return true;
  if (t.type === 'weekdays') return (t.days || []).includes(dowMon(new Date()));
  if (t.type === 'weekly') return true;       // always available to log toward the week
  if (t.type === 'finite') return true;
  return false;
}
// Is this card "done" in the Today context?
function isDoneInToday(t) {
  if (t.type === 'daily' || t.type === 'weekdays') return doneToday(t);
  if (t.type === 'weekly') return compsThisWeek(t) >= t.target;
  if (t.type === 'finite') return totalComps(t) >= t.target;
  return false;
}

/* ---- Selected-day helpers (browse any day this week) ---- */
function activeDayKey() { return viewDayKey || todayKey(); }
function scheduledOnDate(t, d) {
  if (t.archived) return false;
  if (t.startDate && dateKey(d) < t.startDate) return false;
  if (t.type === 'daily') return true;
  if (t.type === 'weekdays') return (t.days || []).includes(dowMon(d));
  // weekly / finite goals are week-level — only surface them on the live "today" view
  if (t.type === 'weekly') return compsThisWeek(t) < t.target;
  if (t.type === 'finite') return totalComps(t) < t.target;
  return false;
}
function dayDone(t, day) {
  if (t.type === 'weekly') return compsThisWeek(t) >= t.target;
  if (t.type === 'finite') return totalComps(t) >= t.target;
  return compsOn(t, day.key) > 0;
}
function logOnDate(t, key) {
  const has = compsOn(t, key) > 0;
  let added = false;
  if (has) t.completions = (t.completions || []).filter(ts => dateKey(new Date(ts)) !== key);
  else { t.completions.push(new Date(key + 'T12:00:00').toISOString()); added = true; celebrate(t); }
  save(); renderCurrent(); renderHeader();
  if (added) runCelebrations(null);
}
function selectDay(idx) {
  if (idx === null) viewDayKey = null;
  else { const k = dateKey(weekDates()[idx]); viewDayKey = (k === todayKey() ? null : k); }
  renderHeader();
  if (currentView !== 'today') setView('today'); else renderToday();
}

/* ---------------- Actions ---------------- */
function logTask(t) {
  const k = todayKey();
  let added = false, reachedWeekly = null;
  if (t.type === 'daily' || t.type === 'weekdays') {
    if (doneToday(t)) {
      t.completions = (t.completions || []).filter(ts => dateKey(new Date(ts)) !== k);
    } else {
      t.completions.push(new Date().toISOString()); added = true; celebrate(t);
    }
  } else {
    t.completions.push(new Date().toISOString()); added = true;
    lastUndo = { taskId: t.id, ts: t.completions[t.completions.length - 1] };
    if (t.type === 'finite' && totalComps(t) >= t.target) { t.archived = true; toast('Goal complete \u2014 beautifully done.'); }
    else if (t.type === 'weekly' && compsThisWeek(t) === t.target) { reachedWeekly = t; }
    else { toast('Logged \u00b7 tap to undo', () => undoLast()); }
    celebrate(t);
  }
  save(); renderCurrent(); renderHeader();
  if (added) runCelebrations(reachedWeekly);
}
function undoLast() {
  if (!lastUndo) return;
  const t = S.tasks.find(x => x.id === lastUndo.taskId);
  if (t) { t.completions = t.completions.filter(ts => ts !== lastUndo.ts); if (t.archived && totalComps(t) < t.target) t.archived = false; save(); renderCurrent(); renderHeader(); }
  lastUndo = null;
}
function celebrate(t) { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} } }

function addTask(o) { const t = newTask(o); S.tasks.push(t); save(); return t; }
function deleteTask(id) { S.tasks = S.tasks.filter(t => t.id !== id); save(); }

/* ---------------- Lightweight quick parse for the add field ---------------- */
function parseQuick(text) {
  const res = { title: text.trim(), type: 'daily', days: [], target: 3 };
  let s = ' ' + text.toLowerCase() + ' ';
  const dayMap = { mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, weds: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3, fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6 };
  let matched = false;
  // "N times a week" / "Nx a week" / "N a week"
  let m = s.match(/(\d+)\s*(?:x|times)?\s*(?:a|per|\/)\s*week/);
  if (m) { res.type = 'weekly'; res.target = Math.max(1, parseInt(m[1], 10)); matched = true; res.title = clean(text, m[0]); }
  // "N times total" / "N times then done"
  if (!matched) { m = s.match(/(\d+)\s*times(?:\s*(?:total|in all|then\s*done))/); if (m) { res.type = 'finite'; res.target = Math.max(1, parseInt(m[1], 10)); matched = true; res.title = clean(text, m[0]); } }
  if (!matched && /\bweekdays\b/.test(s)) { res.type = 'weekdays'; res.days = [0, 1, 2, 3, 4]; matched = true; res.title = clean(text, 'weekdays'); }
  if (!matched && /\bweekends?\b/.test(s)) { res.type = 'weekdays'; res.days = [5, 6]; matched = true; res.title = clean(text, 'weekend'); }
  if (!matched && (/\bevery\s*day\b/.test(s) || /\bdaily\b/.test(s))) { res.type = 'daily'; matched = true; res.title = clean(text, /every\s*day|daily/i); }
  if (!matched) {
    const found = [];
    Object.keys(dayMap).forEach(k => { if (new RegExp('\\b' + k + '\\b').test(s)) found.push(dayMap[k]); });
    if (found.length) { res.type = 'weekdays'; res.days = [...new Set(found)].sort((a, b) => a - b); matched = true; }
  }
  if (!res.title) res.title = text.trim();
  return res;
}
function clean(text, frag) {
  let out = text;
  if (frag instanceof RegExp) out = out.replace(frag, ' ');
  else { const i = out.toLowerCase().indexOf(frag.trim().toLowerCase()); if (i >= 0) out = out.slice(0, i) + out.slice(i + frag.trim().length); }
  return out.replace(/\s{2,}/g, ' ').trim().replace(/[,;:]+$/, '').trim();
}

/* ---------------- Rendering ---------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

const CHK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>';

function niceDate(key) { const d = new Date(key + 'T12:00:00'); const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mo[d.getMonth()] + ' ' + d.getDate(); }
function dateTagEls(t) {
  const out = []; const tk = todayKey();
  if (t.startDate && t.startDate > tk) out.push(el('span', 'tag', 'From ' + niceDate(t.startDate)));
  if (t.dueDate) {
    const done = (t.type === 'finite') ? totalComps(t) >= t.target : compsOn(t, tk) > 0;
    if (!done && tk > t.dueDate) out.push(el('span', 'tag overdue', 'Overdue'));
    else out.push(el('span', 'tag', 'Due ' + niceDate(t.dueDate)));
  }
  return out;
}
function typeTag(t) {
  if (t.type === 'daily') return 'Every day';
  if (t.type === 'weekdays') return (t.days || []).map(d => DOW_SHORT[d]).join(' · ') || 'Set days';
  if (t.type === 'weekly') return compsThisWeek(t) + '/' + t.target + ' this week';
  if (t.type === 'finite') return totalComps(t) + '/' + t.target + ' done';
  return '';
}

function taskCard(t, day) {
  day = day || { key: todayKey(), isToday: true, isFuture: false, isPast: false };
  const isGoal = (t.type === 'weekly' || t.type === 'finite');
  const done = isGoal ? isDoneInToday(t) : compsOn(t, day.key) > 0;
  const card = el('div', 'card');
  if (done) card.classList.add('done');
  if (day.isFuture && !isGoal) card.classList.add('future');

  const chk = el('button', 'check');
  if (isGoal) {
    const c = t.type === 'weekly' ? compsThisWeek(t) : totalComps(t);
    if (done) { chk.classList.add('on'); chk.innerHTML = CHK; }
    else { chk.classList.add('count'); chk.textContent = c; }
  } else {
    if (done) chk.classList.add('on');
    chk.innerHTML = CHK;
  }
  chk.setAttribute('aria-label', done ? 'Mark not done' : 'Log ' + t.title);
  chk.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isGoal) { logTask(t); return; }
    if (day.isFuture) { toast('That day’s still ahead — check back then.'); return; }
    if (day.isToday) logTask(t); else logOnDate(t, day.key);
  });

  const ico = taskIcon(t);
  const body = el('div', 'card-body');
  body.appendChild(el('div', 'card-title', (ico ? '<span class="ttl-ico">' + ico + '</span>' : '') + escapeHtml(t.title)));
  const meta = el('div', 'card-meta');
  meta.appendChild(el('span', 'tag accent', typeTag(t)));
  dateTagEls(t).forEach(s => meta.appendChild(s));
  body.appendChild(meta);

  if (isGoal) {
    const cur = t.type === 'weekly' ? compsThisWeek(t) : totalComps(t);
    const prog = el('div', 'miniprog'); const span = el('span'); span.style.width = Math.min(100, (cur / t.target) * 100) + '%'; prog.appendChild(span); body.appendChild(prog);
  }
  body.addEventListener('click', () => openEditor(t.id));

  card.appendChild(chk); card.appendChild(body); card.appendChild(infoBtn(t));
  return card;
}

function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---- Discreet info button + suggestion popover ---- */
function infoBtn(t) {
  const b = el('button', 'info-btn'); b.type = 'button';
  b.setAttribute('aria-label', 'Why this helps');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none"/></svg>';
  b.addEventListener('click', (e) => { e.stopPropagation(); openInfo(t); });
  return b;
}
function openInfo(t) {
  const tip = getTip(t.title); const ico = taskIcon(t) || '✨';
  const pop = $('#infoPop'); if (!pop) return;
  pop.innerHTML = '<div class="info-card" role="dialog" aria-modal="true">'
    + '<div class="info-head"><span class="info-emoji">' + ico + '</span>'
    + '<div><div class="info-title">' + escapeHtml(t.title) + '</div><div class="info-lead">' + tip.lead + '</div></div></div>'
    + '<ul class="info-points">' + tip.points.map(p => '<li>' + p + '</li>').join('') + '</ul>'
    + '<button class="btn block" id="infoClose">Got it</button></div>';
  pop.hidden = false;
  $('#infoClose').addEventListener('click', closeInfo);
}
function closeInfo() { const p = $('#infoPop'); if (p) p.hidden = true; }
function longDay(d) { return DOW_LONG[dowMon(d)] + ' ' + d.getDate(); }

function renderToday() {
  const v = $('#view-today'); v.innerHTML = '';
  const key = activeDayKey();
  const d = new Date(key + 'T12:00:00');
  const day = { key, isToday: key === todayKey(), isFuture: key > todayKey(), isPast: key < todayKey() };

  if (!day.isToday) {
    const banner = el('div', 'day-banner');
    banner.appendChild(el('span', null, (day.isFuture ? 'Planned for ' : 'Looking back · ') + longDay(d)));
    const back = el('button', 'daylink', 'Back to today'); back.addEventListener('click', () => selectDay(null));
    banner.appendChild(back);
    v.appendChild(banner);
  }

  const sched = S.tasks.filter(t => scheduledOnDate(t, d));
  if (sched.length === 0) {
    if (day.isToday) v.appendChild(emptyState('🌱', 'A calm, clear week', 'Add your first task with the + button. Tasks can repeat daily, on chosen days, or count toward a weekly goal.'));
    else v.appendChild(emptyState('🗓️', 'Nothing scheduled', 'No daily or chosen-day tasks fall on ' + longDay(d) + '.'));
    renderDayCalendar(v, key);
    return;
  }
  const todo = sched.filter(t => !dayDone(t, day));
  const done = sched.filter(t => dayDone(t, day));

  if (todo.length === 0 && day.isToday) {
    v.appendChild(emptyState('✨', "That's everything for today", 'You showed up. Rest is part of the rhythm too — see you tomorrow.'));
  } else if (todo.length) {
    v.appendChild(el('div', 'section-title', day.isToday ? 'To do today' : (day.isFuture ? 'Expected' : 'To do')));
    todo.forEach(t => v.appendChild(taskCard(t, day)));
  }
  if (done.length) {
    v.appendChild(el('div', 'section-title', day.isToday ? 'Done today' : 'Completed'));
    done.forEach(t => v.appendChild(taskCard(t, day)));
  }
  renderDayCalendar(v, key);
}

/* Read-only Google Calendar events for the active day */
function renderDayCalendar(v, key) {
  if (!S.settings.gcalConnected || S.settings.gcalShow === false) return;
  if (gcalEventsByDay[key] === undefined) {
    if (gcalToken && Date.now() < gcalTokenExp) { gcalFetchDay(key); return; }
    v.appendChild(el('div', 'section-title', 'From your calendar'));
    const lb = el('button', 'btn ghost', 'Load calendar events'); lb.style.marginBottom = '10px';
    lb.addEventListener('click', () => { gcalFetchDay(key); });
    v.appendChild(lb);
    return;
  }
  const evs = gcalEventsByDay[key];
  if (!evs || !evs.length) return;
  v.appendChild(el('div', 'section-title', 'From your calendar'));
  evs.forEach(e => {
    const c = el('div', 'card cal-event');
    c.appendChild(el('div', 'cal-ico', '📅'));
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', escapeHtml(e.title || '(busy)')));
    const meta = el('div', 'card-meta');
    meta.appendChild(el('span', 'tag', e.timeLabel || (e.allDay ? 'All day' : '')));
    meta.appendChild(el('span', 'tag', 'Google Calendar'));
    body.appendChild(meta);
    c.appendChild(body);
    v.appendChild(c);
  });
}

function renderTasks() {
  const v = $('#view-tasks'); v.innerHTML = '';
  const active = S.tasks.filter(t => !t.archived);
  const archived = S.tasks.filter(t => t.archived);
  if (S.tasks.length === 0) {
    v.appendChild(emptyState('📋', 'No tasks yet', 'Tap + to create one. You decide how often it repeats and whether it has a goal.'));
    return;
  }
  const groups = [
    ['Every day', active.filter(t => t.type === 'daily')],
    ['Certain days', active.filter(t => t.type === 'weekdays')],
    ['Weekly goals', active.filter(t => t.type === 'weekly')],
    ['Count-down goals', active.filter(t => t.type === 'finite')]
  ];
  groups.forEach(([name, arr]) => {
    if (!arr.length) return;
    v.appendChild(el('div', 'section-title', name));
    arr.forEach(t => v.appendChild(manageRow(t)));
  });
  if (archived.length) {
    v.appendChild(el('div', 'section-title', 'Completed goals'));
    archived.forEach(t => v.appendChild(manageRow(t)));
  }
}
function manageRow(t) {
  const card = el('div', 'card');
  const body = el('div', 'card-body');
  const ico = taskIcon(t);
  body.appendChild(el('div', 'card-title', (ico ? '<span class="ttl-ico">' + ico + '</span>' : '') + escapeHtml(t.title)));
  const meta = el('div', 'card-meta');
  meta.appendChild(el('span', 'tag', t.archived ? 'Completed' : typeTag(t)));
  if (!t.archived) dateTagEls(t).forEach(s => meta.appendChild(s));
  body.appendChild(meta);
  body.addEventListener('click', () => openEditor(t.id));
  const chev = el('div', 'tag', 'Edit');
  card.appendChild(body); card.appendChild(chev);
  return card;
}

function emptyState(big, lead, sub) {
  const e = el('div', 'empty');
  e.appendChild(el('div', 'big', big));
  e.appendChild(el('div', 'lead', lead));
  e.appendChild(el('div', 'sub', sub));
  return e;
}

/* ---------------- Stats ---------------- */
function weeklyRate() {
  // returns {done, expected, pct}
  let done = 0, expected = 0;
  const today = new Date(); const daysElapsed = dowMon(today) + 1; // Mon..today inclusive
  const wd = weekDates();
  S.tasks.forEach(t => {
    if (t.startDate && t.startDate > dateKey(wd[daysElapsed - 1])) return;
    if (t.type === 'daily') {
      for (let i = 0; i < daysElapsed; i++) { if (t.startDate && dateKey(wd[i]) < t.startDate) continue; expected++; if (compsOn(t, dateKey(wd[i])) > 0) done++; }
    } else if (t.type === 'weekdays') {
      for (let i = 0; i < daysElapsed; i++) { if ((t.days || []).includes(i)) { if (t.startDate && dateKey(wd[i]) < t.startDate) continue; expected++; if (compsOn(t, dateKey(wd[i])) > 0) done++; } }
    } else if (t.type === 'weekly') {
      expected += t.target; done += Math.min(t.target, compsThisWeek(t));
    }
    // finite excluded from weekly rate
  });
  const pct = expected ? Math.round((done / expected) * 100) : 0;
  return { done, expected, pct };
}
function perDayCounts() {
  const wd = weekDates();
  return wd.map(d => {
    const k = dateKey(d);
    let c = 0; S.tasks.forEach(t => c += compsOn(t, k));
    return c;
  });
}
function currentStreak() {
  let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    const k = dateKey(d);
    const any = S.tasks.some(t => compsOn(t, k) > 0);
    if (any) streak++;
    else if (i === 0) { /* today not done yet — keep checking yesterday */ }
    else break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
function donut(pct) {
  const r = 42, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return '<svg width="104" height="104" viewBox="0 0 104 104">'
    + '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="var(--ring-track)" stroke-width="11"/>'
    + '<circle cx="52" cy="52" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 52 52)"/>'
    + '</svg>';
}
function renderStats() {
  const v = $('#view-stats'); v.innerHTML = '';
  if (S.tasks.length === 0) { v.appendChild(emptyState('📊', 'No data yet', 'Once you start logging tasks, your weekly picture appears here — completion rate, daily activity, and progress per task.')); return; }

  const rate = weeklyRate();
  const ringCard = el('div', 'stat-card');
  ringCard.innerHTML = '<h3>This week</h3><p class="hint">Monday to Sunday · how much of what you planned you\'ve done so far</p>';
  const rw = el('div', 'ring-wrap');
  rw.innerHTML = '<div class="ring-fig">' + donut(rate.pct) + '</div>'
    + '<div><div class="ring-read">' + rate.pct + '%</div><div class="ring-sub">' + rate.done + ' of ' + rate.expected + ' completed</div></div>';
  ringCard.appendChild(rw);
  ringCard.appendChild(el('div', 'reward-hint', '\ud83c\udf81 Hit a weekly goal or a full 100% week and Tally celebrates with you \u2014 with a nudge to reward yourself.'));
  v.appendChild(ringCard);
  if (S.settings.aiEnabled) {
    const ac = el('div', 'stat-card');
    const ab = el('button', 'btn block', '✨ Get a suggestion'); ab.id = 'aiBtn';
    ab.addEventListener('click', aiSuggest);
    ac.appendChild(ab);
    const aout = el('div', null); aout.id = 'aiOut'; aout.style.marginTop = '12px';
    ac.appendChild(aout);
    v.appendChild(ac);
  }

  // big numbers
  const counts = perDayCounts();
  const totalWeek = counts.reduce((a, b) => a + b, 0);
  const row = el('div', 'bigrow');
  row.appendChild(numCard(totalWeek, 'logged this week'));
  row.appendChild(numCard(currentStreak(), 'day streak'));
  row.appendChild(numCard(S.tasks.filter(t => !t.archived).length, 'active tasks'));
  v.appendChild(row);

  // bars per day
  const barsCard = el('div', 'stat-card');
  barsCard.innerHTML = '<h3>Your week</h3><p class="hint">Tasks completed each day</p>';
  const max = Math.max(1, ...counts);
  const bars = el('div', 'bars');
  const td = dowMon(new Date());
  counts.forEach((c, i) => {
    const col = el('div', 'bar-col');
    col.appendChild(el('div', 'bar-val', c || ''));
    const bar = el('div', 'bar' + (c ? '' : ' empty'));
    bar.style.height = (c ? Math.max(8, (c / max) * 96) : 4) + 'px';
    col.appendChild(bar);
    const lbl = el('div', 'bar-lbl', DOW_SHORT[i][0]);
    if (i === td) lbl.style.color = 'var(--accent-ink)';
    col.appendChild(lbl);
    bars.appendChild(col);
  });
  barsCard.appendChild(bars);
  v.appendChild(barsCard);

  // per-task progress
  const active = S.tasks.filter(t => !t.archived);
  if (active.length) {
    const pc = el('div', 'stat-card');
    pc.innerHTML = '<h3>By task</h3><p class="hint">Progress this week</p>';
    active.forEach(t => {
      let cur, goal, label;
      if (t.type === 'weekly') { cur = compsThisWeek(t); goal = t.target; label = cur + '/' + goal + ' this week'; }
      else if (t.type === 'finite') { cur = totalComps(t); goal = t.target; label = cur + '/' + goal + ' total'; }
      else if (t.type === 'weekdays') { const exp = expectedWeekdaySoFar(t); cur = daysDoneThisWeek(t); goal = Math.max(1, exp); label = cur + '/' + (weekdayCountFull(t)) + ' days'; }
      else { const exp = dowMon(new Date()) + 1; cur = daysDoneThisWeek(t); goal = 7; label = cur + '/7 days'; }
      const tp = el('div', 'tprog');
      tp.innerHTML = '<div class="tprog-top"><span>' + escapeHtml(t.title) + '</span><span class="n">' + label + '</span></div>'
        + '<div class="tprog-bar"><span style="width:' + Math.min(100, (cur / goal) * 100) + '%"></span></div>';
      pc.appendChild(tp);
    });
    v.appendChild(pc);
  }
}
function numCard(n, label) { const c = el('div', 'stat-card'); c.innerHTML = '<div class="bignum">' + n + '</div><div class="biglbl">' + label + '</div>'; return c; }
function daysDoneThisWeek(t) { return weekDates().filter(d => compsOn(t, dateKey(d)) > 0).length; }
function weekdayCountFull(t) { return (t.days || []).length || 1; }
function expectedWeekdaySoFar(t) { const td = dowMon(new Date()); return (t.days || []).filter(d => d <= td).length; }

/* ---------------- Settings ---------------- */
function renderSettings() {
  const v = $('#view-settings'); v.innerHTML = '';
  v.appendChild(el('div', 'section-title', 'Appearance'));
  const tg = el('div', 'set-group');
  const themeRow = el('div', 'themes');
  THEMES.forEach(name => {
    const b = el('button', 'swatch' + (S.settings.theme === name ? ' sel' : ''));
    const dot = el('span', 'dot'); dot.style.background = swatchColor(name);
    dot.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>';
    b.appendChild(dot);
    b.appendChild(el('span', 'nm', name[0].toUpperCase() + name.slice(1)));
    b.addEventListener('click', () => { S.settings.theme = name; applyTheme(); save(); renderSettings(); });
    themeRow.appendChild(b);
  });
  tg.appendChild(themeRow);
  v.appendChild(tg);

  v.appendChild(el('div', 'section-title', 'Reminders'));
  const rg = el('div', 'set-group');
  const r1 = el('div', 'set-row');
  r1.innerHTML = '<div class="lblwrap"><div class="lbl">Daily reminder</div><div class="sub">A gentle nudge to check in</div></div>';
  const sw = el('label', 'switch'); sw.innerHTML = '<input type="checkbox" id="notifyToggle"' + (S.settings.notify ? ' checked' : '') + '><span class="slider"></span>';
  r1.appendChild(sw);
  rg.appendChild(r1);
  const r2 = el('div', 'set-row');
  r2.innerHTML = '<div class="lblwrap"><div class="lbl">Reminder time</div><div class="sub">When to nudge you each day</div></div>';
  const ti = el('input', 'time-input'); ti.type = 'time'; ti.value = S.settings.reminderTime || '20:00'; ti.id = 'reminderTime';
  r2.appendChild(ti);
  rg.appendChild(r2);
  v.appendChild(rg);
  const note = el('div', 'about', 'Tip: install Tally to your home screen first (Share → Add to Home Screen). An installed app can send notifications on its own, without changing your browser-wide settings.');
  v.appendChild(note);

  v.appendChild(el('div', 'section-title', 'Connections'));
  const cg = el('div', 'set-group');
  const crow = el('div', 'set-row');
  crow.innerHTML = '<div class="lblwrap"><div class="lbl">Google Calendar</div><div class="sub">' + (S.settings.gcalConnected ? 'Connected \u00b7 your events show in the day view' : 'Show your calendar events beside your tasks') + '</div></div>';
  const cbtn = el('button', 'btn ghost', S.settings.gcalConnected ? 'Disconnect' : 'Connect'); cbtn.id = 'gcalBtn';
  cbtn.addEventListener('click', () => { if (S.settings.gcalConnected) gcalDisconnect(); else gcalConnect(); });
  crow.appendChild(cbtn); cg.appendChild(crow);
  if (S.settings.gcalConnected) {
    const srow = el('div', 'set-row');
    srow.innerHTML = '<div class="lblwrap"><div class="lbl">Show calendar events</div><div class="sub">In your day view</div></div>';
    const sw2 = el('label', 'switch'); sw2.innerHTML = '<input type="checkbox" id="gcalShowToggle"' + (S.settings.gcalShow !== false ? ' checked' : '') + '><span class="slider"></span>';
    srow.appendChild(sw2); cg.appendChild(srow);
  }
  const srowSync = el('div', 'set-row');
  if (fbUser) {
    srowSync.innerHTML = '<div class="lblwrap"><div class="lbl">Device sync</div><div class="sub">Signed in as ' + escapeHtml(fbUser.email || 'your account') + ' \u00b7 tasks sync everywhere</div></div>';
    const out = el('button', 'btn ghost', 'Sign out'); out.id = 'syncSignOut'; out.addEventListener('click', fbSignOut);
    srowSync.appendChild(out);
  } else {
    srowSync.innerHTML = '<div class="lblwrap"><div class="lbl">Device sync</div><div class="sub">Back up &amp; sync your tasks across phone and laptop</div></div>';
    const sin = el('button', 'btn ghost', 'Sign in'); sin.id = 'syncSignIn'; sin.addEventListener('click', fbSignIn);
    srowSync.appendChild(sin);
  }
  cg.appendChild(srowSync);
  v.appendChild(cg);
  v.appendChild(el('div', 'about', 'Read-only \u2014 Tally shows your Google Calendar but never changes it. Needs Tally opened from its web address (not a local file).'));

  v.appendChild(el('div', 'section-title', 'Smart suggestions'));
  const ag = el('div', 'set-group');
  const arow = el('div', 'set-row');
  arow.innerHTML = '<div class="lblwrap"><div class="lbl">Smart suggestions (AI)</div><div class="sub">' + (S.settings.aiEnabled ? 'On · tap “Get a suggestion” on Stats' : 'Off · gentle AI tips from your week') + '</div></div>';
  const asw = el('label', 'switch'); asw.innerHTML = '<input type="checkbox" id="aiToggle"' + (S.settings.aiEnabled ? ' checked' : '') + '><span class="slider"></span>';
  arow.appendChild(asw); ag.appendChild(arow);
  v.appendChild(ag);
  v.appendChild(el('div', 'about', 'AI is off until you turn it on. It only ever sees this week’s task names and progress — never your notes or history — and every suggestion is clearly labelled AI-generated.'));

  v.appendChild(el('div', 'section-title', 'You'));
  const yg = el('div', 'set-group');
  const ny = el('div', 'set-row');
  ny.innerHTML = '<div class="lblwrap"><div class="lbl">Your name</div><div class="sub">Used in your greeting</div></div>';
  const ni = el('input', 'text-input'); ni.type = 'text'; ni.placeholder = 'Optional'; ni.value = S.settings.name || ''; ni.id = 'nameInput'; ni.style.maxWidth = '150px';
  ny.appendChild(ni);
  yg.appendChild(ny);
  v.appendChild(yg);

  v.appendChild(el('div', 'section-title', 'Your data'));
  const dg = el('div', 'set-group');
  const exp = el('div', 'set-row'); exp.innerHTML = '<div class="lblwrap"><div class="lbl">Back up / restore</div><div class="sub">Everything is stored on this device</div></div>';
  dg.appendChild(exp);
  const acts = el('div', 'set-row');
  const expBtn = el('button', 'btn ghost', 'Export'); expBtn.addEventListener('click', exportData);
  const impBtn = el('button', 'btn ghost', 'Import'); impBtn.addEventListener('click', importData);
  const wrap = el('div'); wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.width = '100%'; wrap.appendChild(expBtn); wrap.appendChild(impBtn);
  expBtn.style.flex = impBtn.style.flex = '1';
  acts.appendChild(wrap);
  dg.appendChild(acts);
  v.appendChild(dg);

  const reset = el('button', 'btn danger block', 'Reset all data');
  reset.addEventListener('click', () => { if (confirm('Erase all tasks and history? This cannot be undone.')) { S = defaultState(); save(); applyTheme(); renderAll(); } });
  v.appendChild(reset);

  v.appendChild(el('div', 'about', 'Tally · a calm weekly tracker. Your week runs Monday to Sunday. Made to help you show up — not to nag you.'));

  // wire
  $('#notifyToggle').addEventListener('change', onNotifyToggle);
  $('#reminderTime').addEventListener('change', (e) => { S.settings.reminderTime = e.target.value; save(); scheduleReminders(); });
  if ($('#aiToggle')) $('#aiToggle').addEventListener('change', (e) => { if (e.target.checked) openAIConsent(); else { S.settings.aiEnabled = false; save(); renderCurrent(); } });
  if ($('#gcalShowToggle')) $('#gcalShowToggle').addEventListener('change', (e) => { S.settings.gcalShow = e.target.checked; save(); renderCurrent(); });
  $('#nameInput').addEventListener('input', (e) => { S.settings.name = e.target.value.trim(); save(); renderHeader(); });
}
function swatchColor(name) {
  const map = { sage: '#8aa088', sand: '#c9a978', sky: '#8bb0c9', blush: '#d3a1aa', lavender: '#a99bc9', slate: '#94a2a8', charcoal: '#3a3f4b' };
  return map[name] || '#8aa088';
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'tally-backup-' + todayKey() + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importData() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { try { const d = JSON.parse(fr.result); if (d && d.tasks) { S = Object.assign(defaultState(), d); save(); applyTheme(); renderAll(); toast('Backup restored.'); } else toast('That file does not look like a Tally backup.'); } catch (e) { toast('Could not read that file.'); } };
    fr.readAsText(f);
  });
  inp.click();
}

/* ---------------- Editor sheet ---------------- */
let draft = null;
function openEditor(id) {
  editingId = id || null;
  const t = id ? S.tasks.find(x => x.id === id) : null;
  draft = t ? JSON.parse(JSON.stringify(t)) : newTask({});
  const body = $('#sheetBody'); body.innerHTML = '';
  body.appendChild(el('h2', null, id ? 'Edit task' : 'New task'));

  const fTitle = el('div', 'field');
  fTitle.innerHTML = '<label>What is it?</label><input type="text" id="ef-title" placeholder="e.g. Stretch, Read, Drink water" />';
  body.appendChild(fTitle);

  const fType = el('div', 'field');
  fType.innerHTML = '<label>How often?</label>';
  const grid = el('div', 'type-grid');
  const opts = [
    ['daily', 'Every day', 'Shows up daily'],
    ['weekdays', 'Certain days', 'Pick days of the week'],
    ['weekly', 'Weekly goal', 'Do it N times a week'],
    ['finite', 'Count-down', 'Do it N times, then done']
  ];
  opts.forEach(([val, t1, d1]) => {
    const o = el('button', 'type-opt' + (draft.type === val ? ' on' : ''));
    o.innerHTML = '<div class="t">' + t1 + '</div><div class="d">' + d1 + '</div>';
    o.addEventListener('click', () => { draft.type = val; renderEditorParams(); $$('.type-opt').forEach(x => x.classList.remove('on')); o.classList.add('on'); });
    grid.appendChild(o);
  });
  fType.appendChild(grid);
  body.appendChild(fType);

  const fParams = el('div', 'field'); fParams.id = 'ef-params';
  body.appendChild(fParams);

  const fDates = el('div', 'field');
  fDates.innerHTML = '<label>Dates (optional)</label>'
    + '<div class="date-row">'
    + '<div class="date-col"><span class="date-lbl">Show from</span><input type="date" id="ef-start" /></div>'
    + '<div class="date-col"><span class="date-lbl">Due by</span><input type="date" id="ef-due" /></div>'
    + '</div>'
    + '<div class="about" style="padding:4px 0 0">Hidden until the start date \u2014 pair with a count-down for things like \u201cbuy gifts from Dec 10\u201d.</div>';
  body.appendChild(fDates);

  const acts = el('div', 'sheet-actions');
  const cancel = el('button', 'btn ghost', 'Cancel'); cancel.addEventListener('click', closeSheet);
  const saveBtn = el('button', 'btn', id ? 'Save' : 'Add task'); saveBtn.id = 'ef-save'; saveBtn.addEventListener('click', saveEditor);
  acts.appendChild(cancel); acts.appendChild(saveBtn);
  body.appendChild(acts);

  if (id) {
    const del = el('button', 'btn danger block', 'Delete task'); del.style.marginTop = '10px';
    del.addEventListener('click', () => { deleteTask(id); closeSheet(); renderAll(); });
    body.appendChild(del);
  }

  $('#ef-title').value = draft.title || '';
  if ($('#ef-start')) $('#ef-start').value = draft.startDate || '';
  if ($('#ef-due')) $('#ef-due').value = draft.dueDate || '';
  renderEditorParams();
  $('#sheet').hidden = false;
  setTimeout(() => { $('#ef-title').focus(); }, 60);
}
function renderEditorParams() {
  const p = $('#ef-params'); if (!p) return; p.innerHTML = '';
  if (draft.type === 'weekdays') {
    p.innerHTML = '<label>Which days?</label>';
    const chips = el('div', 'chips');
    DOW_SHORT.forEach((d, i) => {
      const c = el('button', 'chip daychip' + ((draft.days || []).includes(i) ? ' on' : ''), d[0]);
      c.addEventListener('click', () => { draft.days = draft.days || []; const idx = draft.days.indexOf(i); if (idx >= 0) draft.days.splice(idx, 1); else draft.days.push(i); c.classList.toggle('on'); });
      chips.appendChild(c);
    });
    p.appendChild(chips);
  } else if (draft.type === 'weekly' || draft.type === 'finite') {
    p.innerHTML = '<label>' + (draft.type === 'weekly' ? 'Times per week' : 'Times in total') + '</label>';
    const st = el('div', 'stepper');
    const minus = el('button', null, '−'); const val = el('span', 'val', draft.target || 3); const plus = el('button', null, '+');
    minus.addEventListener('click', () => { draft.target = Math.max(1, (draft.target || 3) - 1); val.textContent = draft.target; });
    plus.addEventListener('click', () => { draft.target = Math.min(99, (draft.target || 3) + 1); val.textContent = draft.target; });
    st.appendChild(minus); st.appendChild(val); st.appendChild(plus);
    p.appendChild(st);
  } else {
    p.innerHTML = '<label>Schedule</label><div class="about" style="padding:0">This task will appear every day until you remove it.</div>';
  }
}
function saveEditor() {
  const title = ($('#ef-title').value || '').trim();
  if (!title) { $('#ef-title').focus(); return; }
  draft.title = title;
  const sd = $('#ef-start') ? $('#ef-start').value : '';
  const dd = $('#ef-due') ? $('#ef-due').value : '';
  if (draft.type === 'weekdays' && (!draft.days || !draft.days.length)) draft.days = [dowMon(new Date())];
  if (editingId) {
    const t = S.tasks.find(x => x.id === editingId);
    Object.assign(t, { title: draft.title, type: draft.type, days: draft.days, target: draft.target, startDate: sd, dueDate: dd });
    if (t.type === 'finite' && totalComps(t) < t.target) t.archived = false;
  } else {
    addTask({ title: draft.title, type: draft.type, days: draft.days, target: draft.target, startDate: sd, dueDate: dd });
  }
  save(); closeSheet(); renderAll();
}
function closeSheet() { $('#sheet').hidden = true; editingId = null; draft = null; }

/* ---------------- Header / week dots ---------------- */
function greeting() {
  const h = new Date().getHours();
  let g = 'Hello';
  if (h < 12) g = 'Good morning'; else if (h < 18) g = 'Good afternoon'; else g = 'Good evening';
  if (S.settings.name) g += ', ' + S.settings.name;
  return g;
}
function renderHeader() {
  $('#greet').textContent = greeting();
  const wd = weekDates();
  $('#weekLabel').textContent = fmtRange(wd[0], wd[6]);
  const dots = $('#weekDots'); dots.innerHTML = '';
  const td = dowMon(new Date());
  const selKey = activeDayKey();
  wd.forEach((d, i) => {
    const k = dateKey(d);
    const scheduledThatDay = S.tasks.filter(t => {
      if (t.type === 'daily') return true;
      if (t.type === 'weekdays') return (t.days || []).includes(i);
      return false;
    });
    const doneCount = S.tasks.filter(t => compsOn(t, k) > 0).length;
    const allDone = scheduledThatDay.length > 0 && scheduledThatDay.every(t => compsOn(t, k) > 0);
    const cell = el('button', 'wd');
    cell.type = 'button';
    cell.setAttribute('aria-label', 'Show ' + DOW_LONG[i]);
    cell.appendChild(el('div', 'wd-lbl', DOW_SHORT[i][0]));
    let cls = 'wd-dot';
    if (allDone) cls += ' full';
    else if (doneCount > 0) cls += ' has';
    if (i === td) cls += ' today';
    if (k === selKey) cls += ' sel';
    const dot = el('div', cls);
    if (allDone) dot.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>';
    cell.appendChild(dot);
    cell.addEventListener('click', () => selectDay(i));
    dots.appendChild(cell);
  });
}
function fmtRange(a, b) {
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return mo[a.getMonth()] + ' ' + a.getDate() + ' – ' + mo[b.getMonth()] + ' ' + b.getDate();
}

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg, action) {
  const t = $('#toast'); t.innerHTML = '';
  t.appendChild(document.createTextNode(msg));
  if (action) { const b = el('span'); b.style.cssText = 'margin-left:10px;text-decoration:underline;font-weight:700'; b.textContent = 'Undo'; b.addEventListener('click', () => { action(); t.hidden = true; }); t.appendChild(b); }
  t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 4000 : 2200);
}

/* ---------------- Theme + views ---------------- */
function applyTheme() { document.documentElement.setAttribute('data-theme', S.settings.theme || 'sage'); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', swatchColor(S.settings.theme)); }
function setView(view) {
  currentView = view;
  $$('.view').forEach(v => v.hidden = v.dataset.view !== view);
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  renderCurrent();
}
function renderCurrent() {
  if (currentView === 'today') renderToday();
  else if (currentView === 'tasks') renderTasks();
  else if (currentView === 'stats') renderStats();
  else if (currentView === 'settings') renderSettings();
}
function renderAll() { renderHeader(); renderCurrent(); }

/* ---------------- Notifications ---------------- */
async function onNotifyToggle(e) {
  if (e.target.checked) {
    if (!('Notification' in window)) { toast('This device cannot show notifications.'); e.target.checked = false; return; }
    let perm = Notification.permission;
    if (perm !== 'granted') { try { perm = await Notification.requestPermission(); } catch (_) {} }
    if (perm === 'granted') { S.settings.notify = true; save(); scheduleReminders(); toast('Reminders on. I will nudge you daily.'); }
    else { e.target.checked = false; toast('Notifications are blocked. Allow them for Tally in your settings.'); }
  } else { S.settings.notify = false; save(); scheduleReminders(); }
}
function scheduleReminders() {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
  if (!S.settings.notify) return;
  reminderTimer = setInterval(checkReminder, 30000);
  checkReminder();
}
function checkReminder() {
  if (!S.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(); const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const tk = todayKey();
  if (hm === (S.settings.reminderTime || '20:00') && S.settings.lastNotifyDay !== tk) {
    const left = S.tasks.filter(t => scheduledToday(t) && !isDoneInToday(t)).length;
    const body = left ? (left === 1 ? 'One task left for today.' : left + ' tasks left for today.') : 'All done today — nice. A quick check-in?';
    fireNotification('Tally', body);
    S.settings.lastNotifyDay = tk; save();
  }
}
function fireNotification(title, body) {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'notify', title, body, tag: 'tally-daily' });
    } else if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'icons/icon-192.png' });
    }
  } catch (e) {}
}

/* ---------------- Onboarding ---------------- */
function showIntro() {
  const i = $('#intro');
  i.innerHTML = '<div class="intro-card">'
    + '<div class="intro-mark"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg></div>'
    + '<h1>Welcome to Tally</h1>'
    + '<p>A calm place to track what matters this week — no streaks to shame you, just a clear picture of how you are showing up.</p>'
    + '<div class="feats">'
    + feat('Repeat tasks your way', 'Every day, certain days, or a weekly goal like stretch 3 times a week.')
    + feat('Browse any day', 'Tap a day at the top to see what is planned — past or future, all week.')
    + feat('See your week clearly', 'Simple charts show your completion rate and daily rhythm, Monday to Sunday.')
    + feat('Celebrate your wins', 'Finish a weekly goal \u2014 or a full 100% week \u2014 and Tally cheers you on, with a reminder to reward yourself.')
    + '</div>'
    + '<button class="btn block" id="introGo">Get started</button>'
    + '</div>';
  i.hidden = false;
  $('#introGo').addEventListener('click', () => { S.onboarded = true; save(); i.hidden = true; });
}
function feat(b, s) {
  return '<div class="feat"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg><div><b>' + b + '</b><span>' + s + '</span></div></div>';
}

/* ---------------- Init ---------------- */
function init() {
  load();
  applyTheme();
  $$('.navbtn').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#fab').addEventListener('click', () => openEditor(null));
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
  $('#infoPop').addEventListener('click', (e) => { if (e.target.id === 'infoPop') closeInfo(); });
  $('#celebrate').addEventListener('click', (e) => { if (e.target.id === 'celebrate') closeCelebrate(); });
  renderHeader();
  setView('today');
  scheduleReminders();
  if (S.settings.gcalConnected) gcalInitSilent();
  if (S.settings.syncEnabled) fbInit();
  if (!S.onboarded) showIntro();
}

document.addEventListener('DOMContentLoaded', init);


/* ---------------- Google Calendar (read-only, optional) ---------------- */
const DEFAULT_GCAL_CLIENT_ID = '136485291900-vib1opnsm8fjlakuk87b4dn3asqsoj58.apps.googleusercontent.com';
let gcalToken = null, gcalTokenExp = 0, gcalTokenClient = null;
let gcalEventsByDay = {};
function calCacheSet(key, evs) { gcalEventsByDay[key] = evs; }
function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
}
function gcalClientId() { return (S.settings.gcalClientId || DEFAULT_GCAL_CLIENT_ID || '').trim(); }
async function gcalInitClient() {
  await loadGIS();
  if (!gcalTokenClient) {
    gcalTokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: gcalClientId(), scope: 'https://www.googleapis.com/auth/calendar.readonly', callback: () => {} });
  }
}
async function gcalConnect() {
  if (location.protocol === 'file:') { toast('Calendar needs Tally opened from its web address, not a local file.'); return; }
  try {
    await gcalInitClient();
    gcalTokenClient.callback = (resp) => {
      if (resp && resp.access_token) {
        gcalToken = resp.access_token; gcalTokenExp = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500000);
        S.settings.gcalConnected = true; save(); gcalEventsByDay = {};
        toast('Google Calendar connected.');
        if (currentView === 'settings') renderSettings();
        gcalFetchDay(activeDayKey());
      }
    };
    gcalTokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (e) { toast(e.message || 'Calendar connection failed.'); }
}
function gcalDisconnect() {
  gcalToken = null; gcalTokenExp = 0; gcalEventsByDay = {};
  S.settings.gcalConnected = false; save();
  if (currentView === 'settings') renderSettings(); else renderCurrent();
  toast('Calendar disconnected.');
}
async function gcalInitSilent() {
  // Only prepare the client. Never request a token on launch — that pops the Google chooser in an installed PWA.
  try { await gcalInitClient(); } catch (e) {}
}
function gcalEnsureToken() {
  return new Promise((resolve) => {
    if (gcalToken && Date.now() < gcalTokenExp) return resolve(gcalToken);
    if (!gcalTokenClient) return resolve(null);
    gcalTokenClient.callback = (resp) => { if (resp && resp.access_token) { gcalToken = resp.access_token; gcalTokenExp = Date.now() + 3500000; resolve(gcalToken); } else resolve(null); };
    try { gcalTokenClient.requestAccessToken({ prompt: '' }); } catch (e) { resolve(null); }
  });
}
async function gcalFetchDay(key) {
  if (!S.settings.gcalConnected) return;
  gcalEventsByDay[key] = gcalEventsByDay[key] || [];
  const tok = await gcalEnsureToken(); if (!tok) return;
  const start = new Date(key + 'T00:00:00'); const end = new Date(key + 'T00:00:00'); end.setDate(end.getDate() + 1);
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=' + encodeURIComponent(start.toISOString()) + '&timeMax=' + encodeURIComponent(end.toISOString());
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) return;
    const data = await r.json();
    gcalEventsByDay[key] = (data.items || []).map(it => {
      const allDay = !!(it.start && it.start.date);
      const sd = it.start ? new Date(it.start.dateTime || (it.start.date + 'T00:00:00')) : null;
      return { title: it.summary || '(busy)', allDay, timeLabel: allDay ? 'All day' : fmtClock(sd) };
    });
    if (currentView === 'today') renderToday();
  } catch (e) {}
}
function fmtClock(d) { if (!d) return ''; let h = d.getHours(), m = d.getMinutes(); const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + (m ? ':' + pad(m) : '') + ap; }

function calTestConnect(on) { S.settings.gcalConnected = !!on; S.settings.gcalShow = true; }

/* ---------------- Celebrations + reward prompts ---------------- */
function runCelebrations(reachedWeeklyTask) {
  const r = weeklyRate();
  const wk = weekKey();
  if (r.pct >= 100 && r.expected > 0 && S.settings.celebratedWeek !== wk) {
    S.settings.celebratedWeek = wk; save();
    openCelebrate(weekCelebration());
    return;
  }
  if (reachedWeeklyTask) openCelebrate(goalCelebration(reachedWeeklyTask));
}
function goalCelebration(t) {
  return {
    emoji: '\ud83c\udf89',
    title: t.title + ' \u2014 done for the week!',
    body: 'You hit your goal of ' + t.target + '\u00d7 this week. Pause and take that in \u2014 you showed up, again and again.',
    reward: 'Now reward yourself. Anything counts: a favourite snack, ten minutes of something you love, or simply a moment of pride.',
    why: 'Pairing effort with a small reward is how habits lock in \u2014 your brain ties the action to a good feeling and wants to repeat it. Celebrating isn\u2019t indulgent; it\u2019s the part most people skip, and it\u2019s what makes consistency last.',
    btn: 'I will \ud83c\udf81'
  };
}
function weekCelebration() {
  return {
    emoji: '\ud83c\udf1f',
    title: 'A perfect week \u2014 100%!',
    body: 'You completed everything you planned this week. That\u2019s genuinely rare \u2014 be proud of every single check.',
    reward: 'Give yourself a real reward this time. Plan something you\u2019ll look forward to \u2014 you\u2019ve earned it.',
    why: 'Honouring a full week of follow-through reinforces your identity as someone who shows up. That self-belief, more than willpower, is what carries habits through the weeks ahead.',
    btn: 'Celebrate \ud83c\udf81'
  };
}
function openCelebrate(c) {
  const o = $('#celebrate');
  o.innerHTML = '<div class="celebrate-card" role="dialog" aria-modal="true">'
    + '<div class="celebrate-emoji">' + c.emoji + '</div>'
    + '<h2 class="celebrate-title">' + escapeHtml(c.title) + '</h2>'
    + '<p class="celebrate-body">' + c.body + '</p>'
    + '<div class="reward-callout"><span class="reward-ico">\ud83c\udf81</span><span>' + c.reward + '</span></div>'
    + '<p class="celebrate-why">' + c.why + '</p>'
    + '<button class="btn block" id="celebrateClose">' + c.btn + '</button>'
    + '</div>';
  o.hidden = false;
  if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) {} }
  $('#celebrateClose').addEventListener('click', closeCelebrate);
}
function closeCelebrate() { const o = $('#celebrate'); if (o) o.hidden = true; }

/* ---------------- Cross-device sync (Firebase, optional) ---------------- */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCeqo307v6YKZjSYrnUGyNta95BXspisMM',
  authDomain: 'compact-cell-500621-i6.firebaseapp.com',
  projectId: 'compact-cell-500621-i6',
  storageBucket: 'compact-cell-500621-i6.firebasestorage.app',
  messagingSenderId: '136485291900',
  appId: '1:136485291900:web:3c48db3c0ab0b02614c6f9'
};
let fbAuth = null, fbDb = null, fbUser = null, fbUnsub = null, fbReady = false, adoptingRemote = false, fbPushTimer = null;

function loadFirebase() {
  return new Promise((resolve, reject) => {
    if (window.firebase && window.firebase.firestore) return resolve();
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
    let i = 0;
    const next = () => {
      if (i >= files.length) return resolve();
      const s = document.createElement('script');
      s.src = base + files[i++]; s.onload = next;
      s.onerror = () => reject(new Error('Could not load sync (check your connection).'));
      document.head.appendChild(s);
    };
    next();
  });
}
async function fbInit() {
  if (fbReady) return;
  await loadFirebase();
  if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = window.firebase.auth(); fbDb = window.firebase.firestore();
  fbReady = true;
  fbAuth.onAuthStateChanged((u) => {
    fbUser = u;
    S.settings.syncEnabled = !!u; try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
    if (u) fbStartSync(); else fbStopSync();
    if (currentView === 'settings') renderSettings();
  });
}
async function fbSignIn() {
  try {
    await fbInit();
    if (location.protocol === 'file:') { toast('Sync needs Tally opened from its web address, not a local file.'); return; }
    await fbAuth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request')) {
      try { await fbAuth.signInWithRedirect(new window.firebase.auth.GoogleAuthProvider()); } catch (_) {}
    } else if (e && e.code !== 'auth/popup-closed-by-user') {
      toast('Sign-in failed: ' + (e.message || e));
    }
  }
}
async function fbSignOut() { try { await fbAuth.signOut(); } catch (e) {} }
function fbDocRef() { return fbDb.collection('users').doc(fbUser.uid).collection('apps').doc('tally'); }
async function fbStartSync() {
  if (!fbUser) return;
  try {
    const snap = await fbDocRef().get();
    if (snap.exists) {
      const d = snap.data();
      if (d && d.updatedAt && (!S.updatedAt || d.updatedAt > S.updatedAt)) adoptRemote(d);
      else fbPushNow();
    } else { fbPushNow(); }
    if (fbUnsub) fbUnsub();
    fbUnsub = fbDocRef().onSnapshot((s) => {
      if (!s.exists) return;
      const d = s.data();
      if (d && d.updatedAt && d.updatedAt > (S.updatedAt || 0)) adoptRemote(d);
    });
    toast('Synced. Your tasks now travel with you.');
  } catch (e) {}
}
function fbStopSync() { if (fbUnsub) { fbUnsub(); fbUnsub = null; } }
function adoptRemote(d) {
  try {
    const remote = JSON.parse(d.data);
    adoptingRemote = true;
    S = Object.assign(defaultState(), remote);
    S.updatedAt = d.updatedAt;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
    adoptingRemote = false;
    applyTheme(); renderHeader(); renderCurrent();
  } catch (e) { adoptingRemote = false; }
}
function fbPushNow() {
  if (!fbUser || !fbReady) return;
  try { fbDocRef().set({ data: JSON.stringify(S), updatedAt: S.updatedAt || Date.now() }); } catch (e) {}
}
function fbSchedulePush() {
  if (!fbUser || adoptingRemote) return;
  clearTimeout(fbPushTimer); fbPushTimer = setTimeout(fbPushNow, 800);
}

/* ---------------- Smart suggestions (AI, opt-in) ---------------- */
let AI_WORKER_URL = 'https://tally-ai.gerasimosdap.workers.dev';  // deployed Cloudflare Worker
function aiSetWorker(u) { AI_WORKER_URL = u; }
function aiPayload() {
  const r = weeklyRate();
  const tasks = S.tasks.filter(t => !t.archived).map(t => {
    let progress;
    if (t.type === 'weekly') progress = compsThisWeek(t) + '/' + t.target + ' this week';
    else if (t.type === 'finite') progress = totalComps(t) + '/' + t.target + ' total';
    else progress = daysDoneThisWeek(t) + ' days this week';
    return { title: t.title, type: t.type, progress: progress };
  });
  return { weekPct: r.pct, streak: currentStreak(), tasks: tasks };
}
function openAIConsent() {
  const o = $('#celebrate');
  o.innerHTML = '<div class="celebrate-card" role="dialog" aria-modal="true">'
    + '<div class="celebrate-emoji">✨</div>'
    + '<h2 class="celebrate-title">Smart suggestions</h2>'
    + '<p class="celebrate-body">Get one gentle, specific tip drawn from your week. Tap “Get a suggestion” on Stats whenever you like.</p>'
    + '<div class="reward-callout"><span class="reward-ico">🔒</span><span>When on, Tally shares only this week’s task names and progress — never your notes or history.</span></div>'
    + '<div class="sheet-actions"><button class="btn ghost" id="aiNo">Not now</button><button class="btn" id="aiYes">Turn on</button></div>'
    + '</div>';
  o.hidden = false;
  $('#aiYes').addEventListener('click', () => { S.settings.aiEnabled = true; save(); closeCelebrate(); renderSettings(); });
  $('#aiNo').addEventListener('click', () => { closeCelebrate(); renderSettings(); });
}
async function aiSuggest() {
  const out = $('#aiOut'); if (!out) return;
  if (!AI_WORKER_URL) { out.innerHTML = '<div class="about" style="padding:0">Smart suggestions aren’t set up yet.</div>'; return; }
  out.innerHTML = '<div class="ai-loading">Thinking…</div>';
  try {
    const res = await fetch(AI_WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aiPayload()) });
    if (!res.ok) throw new Error('http');
    const data = await res.json();
    const text = (data && data.suggestion) ? String(data.suggestion) : '';
    if (!text) throw new Error('empty');
    out.innerHTML = '<div class="ai-card"><div class="ai-text"></div><div class="ai-badge">✨ AI-generated — a suggestion, not gospel</div></div>';
    out.querySelector('.ai-text').textContent = text;
  } catch (e) {
    out.innerHTML = '<div class="about" style="padding:0">Couldn’t get a suggestion right now — try again in a moment.</div>';
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
