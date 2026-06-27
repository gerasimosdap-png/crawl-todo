/* ============================================================
   CRAWL — The System.  A dungeon-crawler to-do app.
   Vanilla JS, no dependencies. State persists in localStorage.
   ============================================================ */
'use strict';

const STORE_KEY = 'crawl.v1';
const DEFAULT_FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbyNRnD_ojNSpmDRcrg0pcCRCjQlzVdX1-9ltUape18a301prkAYNKGXM6hPgKbL4rk1/exec';
const DEFAULT_GCAL_CLIENT_ID = '136485291900-vib1opnsm8fjlakuk87b4dn3asqsoj58.apps.googleusercontent.com';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- State ---------------- */
const defaultState = () => ({
  name: 'Crawler',
  xp: 0,
  gold: 0,
  level: 1,
  streak: 0,
  lastClearDay: null,
  totalCleared: 0,
  bestStreak: 0,
  bossesFelled: 0,
  freezesUsed: 0,
  askedNotify: false,
  onboarded: false,
  unlocked: [],
  settings: { theme: 'dark', sound: true, haptics: true, notify: false, quietStart: 22, quietEnd: 7, gcalClientId: '', gcalConnected: false, gcalSync: false, gcalShow: true, feedbackUrl: '', syncEnabled: false, focusMode: false },
  tasks: []
});

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let S = load();
let currentView = 'today';
let searchQuery = '';
let efSubs = [];

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { return defaultState(); }
}
function save() {
  if (typeof adoptingRemote === 'undefined' || !adoptingRemote) S.updatedAt = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  if (typeof fbSchedulePush === 'function') fbSchedulePush();
}

/* ---------------- XP / Levels ---------------- */
// XP needed to advance FROM level L to L+1
function xpToNext(L) { return 50 + (L - 1) * 30; }
// total cumulative xp required to reach the START of level L
function xpFloor(L) { let t = 0; for (let i = 1; i < L; i++) t += xpToNext(i); return t; }
function levelFromXp(xp) { let L = 1; while (xp >= xpFloor(L + 1)) L++; return L; }
function rankTitle(L) {
  const ranks = [
    [1, 'Fresh Meat'], [3, 'Crawler'], [5, 'Survivor'], [8, 'Delver'],
    [12, 'Veteran'], [16, 'Dungeon-Wise'], [22, 'Floor Boss'], [30, 'Apex Crawler'], [40, 'System Anomaly']
  ];
  let t = ranks[0][1];
  for (const [lv, nm] of ranks) if (L >= lv) t = nm;
  return t;
}

/* ---------------- System quips (original, snarky) ---------------- */
const QUIPS = {
  add: [
    'Quest logged. The System is mildly interested.',
    'New objective accepted. Try not to die of procrastination.',
    'Noted. The dungeon does not care, but I do. A little.',
    'Added to the crawl. Tick-tock, meatbag.',
    'Objective registered. Viewers are placing bets against you.'
  ],
  clear: [
    'Quest cleared. The crowd goes mildly wild.',
    'One down. The dungeon shifts beneath your feet.',
    'Objective neutralized. Loot dispensed. Don’t spend it all.',
    'Cleared. The System grudgingly updates your file.',
    'Done. Somewhere, a producer nods.',
    'Eliminated. Efficiency noted for the highlight reel.'
  ],
  boss: [
    'BOSS FELLED. The floor trembles. Sponsors incoming.',
    'Major threat eliminated. The System is, briefly, impressed.',
    'Boss down. That one was watching you back.',
    'Colossal objective cleared. The leaderboard takes notice.'
  ],
  overdue: [
    'Late, but cleared. The System docks no XP. This time.',
    'Better late than dead. Quest closed.',
    'Overdue objective resolved. We’ll pretend that was the plan.'
  ],
  emptyToday: [
    'No quests for today. Suspicious. The System is watching.',
    'Today’s slate is clear. Rest, or descend deeper.',
    'Nothing due. Either you’re ahead, or hiding.'
  ],
  emptyAll: [
    'The dungeon is silent. Add a quest to begin the crawl.',
    'No objectives. The System awaits your first move.',
  ],
  streak: [
    'Streak extended. Consistency: the deadliest weapon.',
    'Another day survived. The chain grows.',
  ]
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const LOOT = [
  { ico: '✨', name: 'Glint of XP' },
  { ico: '💎', name: 'a cracked gem' },
  { ico: '🧪', name: 'a dubious potion' },
  { ico: '🗝️', name: 'a rusty key' },
  { ico: '🦋', name: 'a System moth (cosmetic)' },
  { ico: '🍖', name: 'questionable jerky' },
  { ico: '🪙', name: 'a handful of gold' },
  { ico: '🔮', name: 'a flickering orb' }
];

/* ---------------- Achievements ---------------- */
const ACHIEVEMENTS = [
  { id: 'first',   ico: '🗡️', name: 'First Blood',      desc: 'Clear your first quest.' },
  { id: 'ten',     ico: '⚔️',       name: 'Getting the Hang', desc: 'Clear 10 quests.' },
  { id: 'fifty',   ico: '🏅',       name: 'Seasoned Crawler', desc: 'Clear 50 quests.' },
  { id: 'boss',    ico: '🐉',       name: 'Boss Slayer',      desc: 'Fell your first boss (a !!! quest).' },
  { id: 'streak3', ico: '🔥',       name: 'On a Roll',        desc: 'Hit a 3-day streak.' },
  { id: 'streak7', ico: '⚡',             name: 'Unstoppable',      desc: 'Hit a 7-day streak.' },
  { id: 'five',    ico: '🌪️', name: 'Clear the Floor',  desc: 'Clear 5 quests in one day.' },
  { id: 'lvl5',    ico: '⭐',             name: 'Survivor',         desc: 'Reach level 5.' },
  { id: 'overdue', ico: '⏰',             name: 'Better Late',      desc: 'Clear an overdue quest.' },
  { id: 'night',   ico: '🌙',       name: 'Night Owl',        desc: 'Clear a quest after midnight.' }
];

/* ---------------- Natural-language parsing ---------------- */
const WD = { sun:0, sunday:0, mon:1, monday:1, tue:2, tues:2, tuesday:2, wed:3, weds:3, wednesday:3,
  thu:4, thur:4, thurs:4, thursday:4, fri:5, friday:5, sat:6, saturday:6 };
const MO = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,
  aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
const todayKey = () => startOfDay(new Date()).getTime();

function parseQuest(input) {
  let text = ' ' + input.trim() + ' ';
  const res = { title: '', due: null, hasTime: false, repeat: null, priority: 0, project: null, boss: false, habit: null };

  // Priority via trailing/!! bangs.  !!! = boss + top priority
  const bang = input.match(/!{1,3}/g);
  if (/!!!/.test(input)) { res.boss = true; res.priority = 1; }
  else if (/!!/.test(input)) res.priority = 1;
  else if (/(^|\s)!(\s|$)/.test(input)) res.priority = 2;
  text = text.replace(/!{1,3}/g, ' ');

  // explicit priority pN
  const pm = text.match(/\bp([1-3])\b/i);
  if (pm) { res.priority = +pm[1]; text = text.replace(pm[0], ' '); }

  // boss keyword
  if (/(^|\s)(boss|raid)(\s|$)/i.test(text)) { res.boss = true; if (!res.priority) res.priority = 1; text = text.replace(/(^|\s)(boss|raid)(\s|$)/i, ' '); }

  // project  #tag or @tag
  const proj = text.match(/[#@]([\w-]+)/);
  if (proj) { res.project = proj[1]; text = text.replace(proj[0], ' '); }

  const now = new Date();
  let date = null;

  // ---- recurring (rich natural language) ----
  const seedWdSet = (set) => { for (let i = 0; i < 14; i++) { const d = addDays(startOfDay(now), i); if (set.includes(d.getDay())) return d; } return startOfDay(now); };
  const COUNTSET = { 1:[3], 2:[1,4], 3:[1,3,5], 4:[1,2,4,5], 5:[1,2,3,4,5], 6:[1,2,3,4,5,6], 7:[0,1,2,3,4,5,6] };
  const NUMWORD = { once:1, one:1, twice:2, two:2, thrice:3, three:3, four:4, five:5, six:6, seven:7 };
  let rm;
  const ORD = { first:1, '1st':1, second:2, '2nd':2, third:3, '3rd':3, fourth:4, '4th':4, fifth:5, '5th':5, last:-1 };
  let mm2;
  if (mm2 = text.match(/\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|nesday|rsday|urday)?\s+of\s+(?:the\s+|each\s+|every\s+)?month\b/i)) {
    const ord = ORD[mm2[1].toLowerCase()]; const wd = WD[mm2[2].toLowerCase()];
    res.repeat = 'mwd:' + ord + ':' + wd; date = nextNthWeekday(now, ord, wd); text = text.replace(mm2[0], ' ');
  } else if (rm = text.match(/\b(once|twice|thrice|one|two|three|four|five|six|seven|\d+)\s*(?:x|times)?\s*(?:a|per|each|\/)\s*(day|week)\b/i)) {
    let n = NUMWORD[rm[1].toLowerCase()] || parseInt(rm[1], 10) || 2; n = Math.max(1, Math.min(21, n));
    res.habit = { target: n, period: rm[2].toLowerCase() }; text = text.replace(rm[0], ' ');
  } else if (/\b(weekends|every\s*weekend)\b/i.test(text)) { res.repeat = 'wd:0,6'; date = seedWdSet([0,6]); text = text.replace(/\b(weekends|every\s*weekend)\b/i, ' '); }
  else if (/\b(weekdays|every\s*weekday|every\s*work\s*day)\b/i.test(text)) { res.repeat = 'weekdays'; date = seedWdSet([1,2,3,4,5]); text = text.replace(/\b(weekdays|every\s*weekday|every\s*work\s*day)\b/i, ' '); }
  else if (rm = text.match(/\bevery\s+other\s+(day|week|month)\b/i)) { const u = rm[1].toLowerCase(); res.repeat = u === 'day' ? 'day2' : u === 'week' ? 'week2' : 'month2'; date = startOfDay(now); text = text.replace(rm[0], ' '); }
  else if (rm = text.match(/\b(?:every|each)\s+(\d+)\s+(days?|weeks?|months?)\b/i)) { const n = Math.max(1, parseInt(rm[1], 10)); const u = rm[2].toLowerCase(); const b = u.indexOf('day') === 0 ? 'day' : u.indexOf('week') === 0 ? 'week' : 'month'; res.repeat = b + (n > 1 ? n : ''); date = startOfDay(now); text = text.replace(rm[0], ' '); }
  else if (/\b(fortnightly|biweekly)\b/i.test(text)) { res.repeat = 'week2'; date = startOfDay(now); text = text.replace(/\b(fortnightly|biweekly)\b/i, ' '); }
  else if (/\b(every\s*day|daily|each\s*day)\b/i.test(text)) { res.repeat = 'day'; date = startOfDay(now); text = text.replace(/\b(every\s*day|daily|each\s*day)\b/i, ' '); }
  else if (/\b(every\s*week|weekly|each\s*week)\b/i.test(text)) { res.repeat = 'week'; date = startOfDay(now); text = text.replace(/\b(every\s*week|weekly|each\s*week)\b/i, ' '); }
  else if (/\b(every\s*month|monthly|each\s*month)\b/i.test(text)) { res.repeat = 'month'; date = startOfDay(now); text = text.replace(/\b(every\s*month|monthly|each\s*month)\b/i, ' '); }
  else if (/\b(annually|yearly|every\s*year)\b/i.test(text)) { res.repeat = 'year'; date = startOfDay(now); text = text.replace(/\b(annually|yearly|every\s*year)\b/i, ' '); }
  else if (/\b(every|each)\s+(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)/i.test(text)) {
    const re = /\b(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|nesday|rsday|urday)?\b/gi; const days = []; let mw;
    while (mw = re.exec(text)) { const dd = WD[mw[1].toLowerCase()]; if (dd !== undefined && !days.includes(dd)) days.push(dd); }
    if (days.length) { days.sort(); res.repeat = 'wd:' + days.join(','); date = seedWdSet(days); text = text.replace(/\b(every|each)\b/ig, ' ').replace(re, ' ').replace(/\band\b/ig, ' '); }
  }

  // absolute keywords
  if (!date) {
    if (/\btoday\b/i.test(text)) { date = startOfDay(now); text = text.replace(/\btoday\b/i,' '); }
    else if (/\btonight\b/i.test(text)) { date = startOfDay(now); res.hasTime = true; date.setHours(20,0,0,0); text = text.replace(/\btonight\b/i,' '); }
    else if (/\b(day after tomorrow|overmorrow)\b/i.test(text)) { date = startOfDay(addDays(now,2)); text = text.replace(/\b(day after tomorrow|overmorrow)\b/i,' '); }
    else if (/\b(tomorrow|tmr|tmrw|tmo)\b/i.test(text)) { date = startOfDay(addDays(now,1)); text = text.replace(/\b(tomorrow|tmr|tmrw|tmo)\b/i,' '); }
    else if (/\b(this\s+weekend|weekend)\b/i.test(text)) { date = nextWeekday(now, 6, false); text = text.replace(/\b(this\s+weekend|weekend)\b/i,' '); }
  }
  // in N days/weeks
  const inN = text.match(/\bin\s+(\d+)\s*(day|days|week|weeks|d|w)\b/i);
  if (!date && inN) { const n = +inN[1]; const mult = /w/i.test(inN[2]) ? 7 : 1; date = startOfDay(addDays(now, n*mult)); text = text.replace(inN[0],' '); }
  const inT = text.match(/\bin\s+(an?|half\s+an?|\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
  if (!date && inT) { const w = inT[1].toLowerCase(); let qty = /^an?$/.test(w) ? 1 : /half/.test(w) ? 0.5 : parseFloat(w) || 1; const isHour = /^h/i.test(inT[2]); date = new Date(now.getTime() + qty * (isHour ? 3600000 : 60000)); res.hasTime = true; text = text.replace(inT[0],' '); }
  // next <weekday> / <weekday>
  if (!date) {
    const nextWd = text.match(/\bnext\s+(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|nesday|rsday|urday)?\b/i);
    const onWd = text.match(/\b(?:on\s+)?(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|nesday|rsday|urday)?\b/i);
    if (nextWd) { date = nextWeekday(now, WD[nextWd[1].toLowerCase()], true); text = text.replace(nextWd[0],' '); }
    else if (onWd && WD[onWd[1].toLowerCase()] !== undefined) { date = nextWeekday(now, WD[onWd[1].toLowerCase()], false); text = text.replace(onWd[0],' '); }
  }
  if (!date && /\bnext\s+week\b/i.test(text)) { date = startOfDay(addDays(now,7)); text = text.replace(/\bnext\s+week\b/i,' '); }
  if (!date && /\bnext\s+month\b/i.test(text)) { const d = new Date(now); d.setMonth(d.getMonth()+1); date = startOfDay(d); text = text.replace(/\bnext\s+month\b/i,' '); }
  if (!date && /\bnext\s+year\b/i.test(text)) { const d = new Date(now); d.setFullYear(d.getFullYear()+1); date = startOfDay(d); text = text.replace(/\bnext\s+year\b/i,' '); }
  // month + day  (jul 4 / 4 jul / july 4th)
  if (!date) {
    let m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (!m) { const m2 = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i);
      if (m2) m = [m2[0], m2[2], m2[1]]; }
    if (m) { const mo = MO[m[1].toLowerCase()]; let day = +m[2]; let y = now.getFullYear();
      let dd = new Date(y, mo, day); if (startOfDay(dd) < startOfDay(now)) dd = new Date(y+1, mo, day);
      date = startOfDay(dd); text = text.replace(m[0],' '); }
  }
  // numeric date m/d
  if (!date) {
    const nm = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (nm) { let mo=+nm[1]-1, day=+nm[2], y = nm[3] ? (nm[3].length===2?2000+ +nm[3]:+nm[3]) : now.getFullYear();
      let dd = new Date(y,mo,day); if (!nm[3] && startOfDay(dd) < startOfDay(now)) dd = new Date(y+1,mo,day);
      if (!isNaN(dd)) { date = startOfDay(dd); text = text.replace(nm[0],' '); } }
  }

  // TIME  3pm / 3:30pm / 11.30 / 15:00 / at 11 / noon / midnight
  let hour = null, min = 0;
  let tm = text.match(/\b(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i);   // 11:30, 11.30, 3:00pm, at 9.15
  if (tm) { hour = +tm[1]; min = +tm[2]; if (tm[3]) { hour = hour % 12; if (/pm/i.test(tm[3])) hour += 12; } text = text.replace(tm[0],' '); }
  else if (tm = text.match(/\b(\d{1,2})\s*(am|pm)\b/i)) { hour = +tm[1] % 12; if (/pm/i.test(tm[2])) hour += 12; text = text.replace(tm[0],' '); }
  else if (tm = text.match(/\bat\s+(\d{1,2})(?!\d)\b/i)) { hour = +tm[1]; text = text.replace(tm[0],' '); }
  else if (/\bthis\s+morning\b/i.test(text) || (date && /\bmorning\b/i.test(text))) { hour = 9; text = text.replace(/\b(this\s+)?morning\b/i,' '); }
  else if (/\bthis\s+afternoon\b/i.test(text) || (date && /\bafternoon\b/i.test(text))) { hour = 14; text = text.replace(/\b(this\s+)?afternoon\b/i,' '); }
  else if (/\bthis\s+evening\b/i.test(text) || (date && /\bevening\b/i.test(text))) { hour = 19; text = text.replace(/\b(this\s+)?evening\b/i,' '); }
  else if (/\b(?:at\s+)?noon\b/i.test(text)) { hour = 12; text = text.replace(/\b(?:at\s+)?noon\b/i,' '); }
  else if (/\b(?:at\s+)?midnight\b/i.test(text)) { hour = 0; text = text.replace(/\b(?:at\s+)?midnight\b/i,' '); }
  if (hour !== null) {
    const dayWasImplicit = !date;            // no day keyword/date matched — day came only from the time
    if (!date) date = startOfDay(now);
    date.setHours(hour, min, 0, 0);
    res.hasTime = true;
    // only roll to tomorrow when the day was implied by a bare time that already passed
    if (dayWasImplicit && date < now && !/today|tonight|this/i.test(input)) date = addDays(date, 1);
  }

  res.due = date ? date.getTime() : null;
  res.title = text.replace(/\s+/g, ' ').trim();
  return res;
}

function nextWeekday(from, target, forceNext) {
  const d = startOfDay(from);
  let delta = (target - d.getDay() + 7) % 7;   // days until the coming <weekday>
  if (delta === 0) delta = forceNext ? 7 : 0;  // same weekday: "next X" => +7, "on X" => today
  return addDays(d, delta);
}
function nthWeekdayOfMonth(year, month, ord, wd) {
  if (ord > 0) {
    const first = new Date(year, month, 1);
    const day = 1 + ((wd - first.getDay() + 7) % 7) + (ord - 1) * 7;
    const d = new Date(year, month, day);
    return d.getMonth() === month ? d : null;
  }
  const last = new Date(year, month + 1, 0);
  const day = last.getDate() - ((last.getDay() - wd + 7) % 7);
  return new Date(year, month, day);
}
function nextNthWeekday(from, ord, wd) {
  const base = startOfDay(from);
  let y = base.getFullYear(), m = base.getMonth(), d = nthWeekdayOfMonth(y, m, ord, wd), guard = 0;
  while ((!d || startOfDay(d) < base) && guard++ < 14) { m++; if (m > 11) { m = 0; y++; } d = nthWeekdayOfMonth(y, m, ord, wd); }
  return d ? startOfDay(d) : base;
}

/* ---------------- Date formatting ---------------- */
function fmtDue(ts, hasTime) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const time = hasTime ? ' ' + fmtTime(d) : '';
  if (days < 0) { const a = Math.abs(days); return `Overdue ${a}d`; }
  if (days === 0) return 'Today' + time;
  if (days === 1) return 'Tomorrow' + time;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' }) + time;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + time;
}
function fmtTime(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2,'0')}${ap}` : `${h}${ap}`;
}
function dueClass(ts) {
  if (!ts) return '';
  const now = Date.now();
  const days = Math.round((startOfDay(new Date(ts)) - startOfDay(new Date())) / 86400000);
  if (days < 0) return 'overdue';
  if (ts < now) return 'overdue';   // timed task whose moment passed today
  if (days <= 1) return 'soon';
  return '';
}

/* ---------------- Mutations ---------------- */
function addTask(input) {
  const p = parseQuest(input);
  if (!p.title) return null;
  const xp = (p.boss ? 40 : 0) + [10, 25, 18, 12][p.priority];
  const task = {
    id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    title: p.title, due: p.due, hasTime: p.hasTime, repeat: p.repeat,
    priority: p.priority, project: p.project, boss: p.boss,
    done: false, createdAt: Date.now(), completedAt: null, notified: false, xp,
    habit: p.habit || null, habitCount: 0, habitKey: p.habit ? habitPeriodKey(p.habit.period) : null
  };
  S.tasks.unshift(task);
  save();
  systemLog('<span class="sys-prefix">[SYSTEM]</span> ' + pick(QUIPS.add));
  // Permission priming at the moment of intent: only when they first set a timed quest
  if (task.hasTime && !S.settings.notify && !S.askedNotify && ('Notification' in window)) {
    S.askedNotify = true; save();
    setTimeout(() => systemLog('<span class="sys-prefix">[SYSTEM]</span> Want a nudge when timed quests are due? Turn on Reminders in the menu.'), 700);
  }
  if (S.settings.gcalSync && task.due && window.gcalPushTask) window.gcalPushTask(task);
  return task;
}

function clearTask(task) {
  if (task.done) { // un-clear
    task.done = false; task.completedAt = null; save(); render(); return;
  }
  task.done = true; task.completedAt = Date.now();
  const wasOverdue = task.due && task.due < startOfDay(new Date()).getTime();

  // rewards
  const gainXp = task.xp;
  const gainGold = (task.boss ? 25 : 5) + Math.floor(Math.random() * (task.boss ? 25 : 10));
  const prevLevel = S.level;
  S.xp += gainXp; S.gold += gainGold; S.totalCleared++;
  S.level = levelFromXp(S.xp);
  if (task.boss) S.bossesFelled++;

  // streak — forgiving: a single missed day is a "rest at the inn", not a reset
  const tk = todayKey();
  let usedFreeze = false;
  if (S.lastClearDay !== tk) {
    const gap = S.lastClearDay == null ? null : Math.round((tk - S.lastClearDay) / 86400000);
    if (gap === null) S.streak = 1;
    else if (gap === 1) S.streak++;                       // consecutive day
    else if (gap === 2) { S.streak++; S.freezesUsed++; usedFreeze = true; }  // missed one day → grace
    else S.streak = 1;                                     // missed 2+ days → fresh start
    S.lastClearDay = tk;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
  }

  // recurring -> spawn next
  if (task.repeat) spawnNext(task);

  save();

  // FX
  const quip = usedFreeze
    ? 'You missed a day, but the streak holds. Consider it a rest at the inn.'
    : (task.boss ? pick(QUIPS.boss) : wasOverdue ? pick(QUIPS.overdue) : pick(QUIPS.clear));
  systemLog('<span class="sys-prefix">[SYSTEM]</span> ' + quip);
  lootToast(gainXp, gainGold, task.boss);
  pulse('#xpFill'); pulse('#goldStat'); pulse('#streakStat');
  sfx(task.boss ? 'boss' : 'clear');
  if (S.settings.haptics && navigator.vibrate) navigator.vibrate(task.boss ? [25, 40, 25] : 18);

  checkAchievements({ wasOverdue, task });

  if (S.level > prevLevel) setTimeout(() => levelUp(S.level), 650);
  updateHUD();
}

function spawnNext(task) {
  let base = task.due ? new Date(task.due) : new Date();
  let next = new Date(base);
  const r = task.repeat; let mm;
  if (r === 'day') next = addDays(base, 1);
  else if (mm = /^day(\d+)$/.exec(r)) next = addDays(base, +mm[1]);
  else if (r === 'week') next = addDays(base, 7);
  else if (mm = /^week(\d+)$/.exec(r)) next = addDays(base, 7 * +mm[1]);
  else if (r === 'month') { next = new Date(base); next.setMonth(next.getMonth() + 1); }
  else if (mm = /^month(\d+)$/.exec(r)) { next = new Date(base); next.setMonth(next.getMonth() + +mm[1]); }
  else if (r === 'year') { next = new Date(base); next.setFullYear(next.getFullYear() + 1); }
  else if (r === 'weekdays') { do { next = addDays(next, 1); } while (next.getDay() === 0 || next.getDay() === 6); }
  else if (mm = /^mwd:(-?\d+):(\d+)$/.exec(r)) { next = nextNthWeekday(addDays(base, 1), +mm[1], +mm[2]); }
  else if (r && r.startsWith('wd:')) { const set = r.slice(3).split(',').map(Number); do { next = addDays(next, 1); } while (!set.includes(next.getDay())); }
  else next = addDays(base, 7);
  S.tasks.unshift({
    ...task, id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    due: next.getTime(), done: false, completedAt: null, notified: false, createdAt: Date.now()
  });
}

function weekStartKey() { const d = startOfDay(new Date()); const dow = (d.getDay() + 6) % 7; return startOfDay(addDays(d, -dow)).getTime(); }
function habitPeriodKey(period) { return period === 'day' ? todayKey() : weekStartKey(); }
function ensureHabitPeriod(t) { if (!t.habit) return; const k = habitPeriodKey(t.habit.period); if (t.habitKey !== k) { t.habitKey = k; t.habitCount = 0; } }
function habitTick(t) {
  ensureHabitPeriod(t);
  t.habitCount = (t.habitCount || 0) + 1;
  const gainXp = t.xp || 12, gainGold = 5 + Math.floor(Math.random() * 10), prevLevel = S.level;
  S.xp += gainXp; S.gold += gainGold; S.totalCleared++; S.level = levelFromXp(S.xp);
  const tk = todayKey();
  if (S.lastClearDay !== tk) {
    const gap = S.lastClearDay == null ? null : Math.round((tk - S.lastClearDay) / 86400000);
    if (gap === null) S.streak = 1; else if (gap === 1) S.streak++; else if (gap === 2) { S.streak++; S.freezesUsed++; } else S.streak = 1;
    S.lastClearDay = tk; S.bestStreak = Math.max(S.bestStreak, S.streak);
  }
  save();
  const met = t.habitCount >= t.habit.target;
  systemLog('<span class="sys-prefix">[SYSTEM]</span> ' + (met ? ('Done ' + t.habit.target + 'x this ' + t.habit.period + '. The System nods.') : (t.habitCount + ' of ' + t.habit.target + ' this ' + t.habit.period + '. Keep the chain alive.')));
  lootToast(gainXp, gainGold, false);
  pulse('#xpFill'); pulse('#goldStat'); pulse('#streakStat');
  sfx('clear'); if (S.settings.haptics && navigator.vibrate) navigator.vibrate(18);
  checkAchievements({ wasOverdue: false, task: t });
  if (S.level > prevLevel) setTimeout(() => levelUp(S.level), 650);
  updateHUD(); render();
}
function deleteTask(id) { S.tasks = S.tasks.filter(t => t.id !== id); save(); render(); }
function efRenderSubs() {
  const c = $('#ef-subs'); if (!c) return;
  c.innerHTML = efSubs.map((st, i) => `<div class="ef-subrow"><button type="button" class="ef-subcheck ${st.done?'on':''}" data-i="${i}" aria-label="Toggle"></button><input class="ef-subinput" data-i="${i}" value="${(st.title||'').replace(/"/g,'&quot;')}" placeholder="Sub-task" /><button type="button" class="ef-subdel" data-i="${i}" aria-label="Remove">\u2715</button></div>`).join('');
  $$('#ef-subs .ef-subcheck').forEach(b => b.onclick = () => { efSubs[+b.dataset.i].done = !efSubs[+b.dataset.i].done; efRenderSubs(); });
  $$('#ef-subs .ef-subinput').forEach(inp => inp.oninput = () => { efSubs[+inp.dataset.i].title = inp.value; });
  $$('#ef-subs .ef-subdel').forEach(b => b.onclick = () => { efSubs.splice(+b.dataset.i, 1); efRenderSubs(); });
}
function openEditor(task) {
  const m = $('#editModal');
  const d = task.due ? new Date(task.due) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const dateVal = d ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` : '';
  const timeVal = (d && task.hasTime) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  const curPrio = task.boss ? 'boss' : (task.priority === 1 ? '1' : task.priority === 2 ? '2' : '0');
  let wdSet = (task.repeat && task.repeat.startsWith('wd:')) ? task.repeat.slice(3).split(',').map(Number) : [];
  if (task.repeat === 'weekdays') wdSet = [1,2,3,4,5];
  let intervalSel = ['day','week','week2','month','year'].includes(task.repeat) ? task.repeat : 'none';
  const dayNames = ['S','M','T','W','T','F','S'];
  const dayChips = dayNames.map((n,i)=>`<button type="button" class="ef-chip day ${wdSet.includes(i)?'sel':''}" data-day="${i}">${n}</button>`).join('');
  m.innerHTML = `
    <div class="edit-card">
      <h2>Edit quest</h2>
      <div class="ef-label">Quest</div>
      <input class="ef-input" id="ef-title" value="${(task.title||'').replace(/"/g,'&quot;')}" />
      <div class="ef-label">When</div>
      <div class="ef-row">
        <input class="ef-input" type="date" id="ef-date" value="${dateVal}" />
        <input class="ef-input" type="time" id="ef-time" value="${timeVal}" />
      </div>
      <div class="ef-label">Priority</div>
      <div class="ef-chiprow" id="ef-prio">
        <button type="button" class="ef-chip ${curPrio==='0'?'sel':''}" data-prio="0">None</button>
        <button type="button" class="ef-chip ${curPrio==='2'?'sel':''}" data-prio="2">! Low</button>
        <button type="button" class="ef-chip p1 ${curPrio==='1'?'sel':''}" data-prio="1">&#8252; High</button>
        <button type="button" class="ef-chip boss ${curPrio==='boss'?'sel':''}" data-prio="boss">&#9760; Boss</button>
      </div>
      <div class="ef-label">Repeats — tap days, or pick an interval</div>
      <div class="ef-chiprow" id="ef-days">${dayChips}</div>
      <select class="ef-input" id="ef-interval" style="margin-top:8px">
        <option value="none">No interval repeat</option>
        <option value="day">Every day</option>
        <option value="week">Every week</option>
        <option value="week2">Every 2 weeks</option>
        <option value="month">Every month</option>
        <option value="year">Every year</option>
      </select>
      <div class="ef-label">Project</div>
      <input class="ef-input" id="ef-project" placeholder="e.g. home, work" value="${(task.project||'')}" />
      <div class="ef-label">Habit target (optional) &mdash; do it X times per period</div>
      <div class="ef-row">
        <input class="ef-input" type="number" id="ef-htarget" min="0" max="21" placeholder="e.g. 3" value="${task.habit ? task.habit.target : ''}" />
        <select class="ef-input" id="ef-hperiod"><option value="week">per week</option><option value="day">per day</option></select>
      </div>
      <div class="ef-label">Sub-tasks</div>
      <div id="ef-subs"></div>
      <button type="button" class="mini-btn" id="ef-addsub" style="margin-top:8px">+ Add sub-task</button>
      <div class="ef-label">Notes</div>
      <textarea class="ef-input" id="ef-notes" placeholder="Anything else to remember..." style="min-height:72px;resize:vertical"></textarea>
      <div class="ef-actions">
        <button type="button" class="ef-del" id="ef-delete">Delete</button>
        <button type="button" class="ef-save" id="ef-save">Save</button>
      </div>
    </div>`;
  m.hidden = false;
  $('#ef-interval').value = intervalSel;
  if ($('#ef-hperiod')) $('#ef-hperiod').value = (task.habit && task.habit.period) || 'week';
  efSubs = (task.subtasks || []).map(s => ({ ...s }));
  efRenderSubs();
  $('#ef-notes').value = task.notes || '';
  $('#ef-addsub').onclick = () => { efSubs.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,5), title: '', done: false }); efRenderSubs(); setTimeout(() => { const ins = $$('#ef-subs .ef-subinput'); if (ins.length) ins[ins.length-1].focus(); }, 10); };
  $$('#ef-prio .ef-chip').forEach(b => b.onclick = () => { $$('#ef-prio .ef-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); });
  $$('#ef-days .ef-chip').forEach(b => b.onclick = () => { b.classList.toggle('sel'); if (document.querySelectorAll('#ef-days .sel').length) $('#ef-interval').value = 'none'; });
  $('#ef-interval').onchange = () => { if ($('#ef-interval').value !== 'none') $$('#ef-days .ef-chip').forEach(x => x.classList.remove('sel')); };
  m.onclick = (e) => { if (e.target.id === 'editModal') closeEditor(); };
  $('#ef-delete').onclick = () => { deleteTask(task.id); closeEditor(); };
  $('#ef-save').onclick = () => saveEditor(task);
  setTimeout(() => { const t = $('#ef-title'); if (t) t.focus(); }, 50);
}
function closeEditor() { const m = $('#editModal'); m.hidden = true; m.innerHTML = ''; }
function saveEditor(task) {
  const title = $('#ef-title').value.trim();
  if (!title) { closeEditor(); return; }
  const dateV = $('#ef-date').value, timeV = $('#ef-time').value;
  let due = null, hasTime = false;
  if (dateV) {
    const [y,mo,da] = dateV.split('-').map(Number); const dt = new Date(y, mo-1, da);
    if (timeV) { const [h,mi] = timeV.split(':').map(Number); dt.setHours(h, mi, 0, 0); hasTime = true; } else dt.setHours(0,0,0,0);
    due = dt.getTime();
  } else if (timeV) {
    const dt = startOfDay(new Date()); const [h,mi] = timeV.split(':').map(Number); dt.setHours(h, mi, 0, 0); due = dt.getTime(); hasTime = true;
  }
  const sel = $('#ef-prio .sel'); const prio = sel ? sel.dataset.prio : '0';
  let boss = false, priority = 0;
  if (prio === 'boss') { boss = true; priority = 1; } else priority = +prio;
  const days = [...document.querySelectorAll('#ef-days .sel')].map(b => +b.dataset.day).sort((a,b)=>a-b);
  let repeat = null;
  if (days.length) repeat = (days.length === 5 && days.join(',') === '1,2,3,4,5') ? 'weekdays' : 'wd:' + days.join(',');
  else { const iv = $('#ef-interval').value; repeat = iv === 'none' ? null : iv; }
  const project = ($('#ef-project').value.trim().replace(/^#/, '')) || null;
  const ht = $('#ef-htarget') ? parseInt($('#ef-htarget').value, 10) : 0;
  const habit = (ht && ht > 0) ? { target: Math.min(21, ht), period: ($('#ef-hperiod') ? $('#ef-hperiod').value : 'week') } : null;
  const subtasks = efSubs.filter(s => (s.title || '').trim()).map(s => ({ id: s.id, title: s.title.trim(), done: !!s.done }));
  const notes = $('#ef-notes') ? $('#ef-notes').value.trim() : (task.notes || '');
  Object.assign(task, { title, due, hasTime, priority, boss, repeat, project, notes, subtasks, habit, notified: false, xp: (boss ? 40 : 0) + [10,25,18,12][priority] });
  if (habit && !task.habitKey) { task.habitCount = task.habitCount || 0; task.habitKey = habitPeriodKey(habit.period); }
  if (!habit) { task.habitCount = 0; task.habitKey = null; }
  if (S.settings && S.settings.gcalSync && task.due && window.gcalPushTask) window.gcalPushTask(task);
  save(); closeEditor(); render();
}
function openIntro(firstRun) {
  const el = $('#intro');
  el.innerHTML = `
    <div class="intro-card">
      <div class="intro-badge">THE SYSTEM</div>
      <h1>Welcome, Crawler</h1>
      <p class="tag">A to-do app that thinks it's a dungeon. Clear quests, earn XP &amp; loot, level up. Miss a day and you simply rest at the inn — no guilt, no punishment.</p>
      <div class="intro-step"><div class="ico">&#9000;</div><div class="txt">Type a quest in plain English — try <code>gym tomorrow 7am</code> or <code>floss twice a week</code>. It reads dates, repeats &amp; priority for you.</div></div>
      <div class="intro-step"><div class="ico">&#8252;</div><div class="txt">Add <code>!</code> low, <code>!!</code> high, or <code>!!!</code> for a <b>BOSS</b> fight worth big XP.</div></div>
      <div class="intro-step"><div class="ico">&#10003;</div><div class="txt">Tap the circle to clear a quest, or swipe it right. Tap the quest text to edit everything in a form.</div></div>
      <div class="intro-step"><div class="ico">&#9776;</div><div class="txt">The menu (top-right) holds stats, achievements, themes, reminders, Google Calendar &amp; backup.</div></div>
      <button class="intro-btn" id="introGo">${firstRun ? 'ENTER THE DUNGEON' : 'GOT IT'}</button>
      ${firstRun ? '<button class="intro-skip" id="introSeed">Start me with a few example quests</button>' : ''}
    </div>`;
  el.hidden = false;
  $('#introGo').onclick = () => { S.onboarded = true; save(); el.hidden = true; const c = $('#captureInput'); if (c) c.focus(); };
  const seed = $('#introSeed');
  if (seed) seed.onclick = () => {
    S.onboarded = true; save(); el.hidden = true;
    ['Welcome to CRAWL — tap me to edit me', 'Slay the laundry tomorrow 6pm !!', 'Defeat the inbox !!!', 'Floss twice a week', 'Water plants every 3 days'].forEach(addTask);
    render();
  };
}


/* ---------------- Achievements ---------------- */
function unlock(id) {
  if (S.unlocked.includes(id)) return;
  S.unlocked.push(id); save();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  toast(a.ico, `<b>Achievement</b><span class="t-sub">${a.name} — ${a.desc}</span>`);
  sfx('ach');
}
function checkAchievements({ wasOverdue, task }) {
  if (S.totalCleared >= 1) unlock('first');
  if (S.totalCleared >= 10) unlock('ten');
  if (S.totalCleared >= 50) unlock('fifty');
  if (task && task.boss) unlock('boss');
  if (S.streak >= 3) unlock('streak3');
  if (S.streak >= 7) unlock('streak7');
  if (S.level >= 5) unlock('lvl5');
  if (wasOverdue) unlock('overdue');
  const h = new Date().getHours(); if (h >= 0 && h < 5) unlock('night');
  const clearedToday = S.tasks.filter(t => t.done && t.completedAt && sameDay(t.completedAt, new Date())).length;
  if (clearedToday >= 5) unlock('five');
}

/* ---------------- Rendering ---------------- */
function render() {
  updateHUD();
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === currentView));
  const list = $('#list'); const empty = $('#emptyState');
  list.innerHTML = '';

  const active = S.tasks.filter(t => !t.done);
  const now = Date.now(), sod = todayKey();

  // counts
  $('#count-today').textContent = (active.filter(t => t.due != null && t.due < sod + 86400000).length + active.filter(t => t.habit).length) || '';
  $('#count-upcoming').textContent = active.filter(t => t.due != null && t.due >= sod + 86400000).length || '';
  $('#count-backlog').textContent = active.filter(t => t.due == null).length || '';
  $('#count-done').textContent = '';

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const m = t => (t.title||'').toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q) || (t.project||'').toLowerCase().includes(q) || (t.subtasks||[]).some(s => (s.title||'').toLowerCase().includes(q));
    const res = S.tasks.filter(m).sort((a,b) => (a.done - b.done) || ((a.due||9e15) - (b.due||9e15)));
    if (!res.length) { const e = $('#emptyState'); e.innerHTML = '<div class="glyph">\u{1F50D}</div><div class="line">No quests match \u201c' + searchQuery.replace(/</g,'&lt;') + '\u201d.</div>'; e.hidden = false; return; }
    empty.hidden = true;
    const head = document.createElement('div'); head.className = 'group-head'; head.textContent = 'Results (' + res.length + ')';
    list.appendChild(head);
    res.forEach(t => list.appendChild(questEl(t)));
    return;
  }

  let groups = [];
  if (currentView === 'today') {
    const habits = active.filter(t => t.habit);
    const overdue = active.filter(t => !t.habit && t.due != null && t.due < sod).sort(byDue);
    const today = active.filter(t => !t.habit && t.due != null && t.due >= sod && t.due < sod + 86400000).sort(byDue);
    const noDate = active.filter(t => !t.habit && t.due == null).sort(byPrio);
    if (habits.length) groups.push(['Habits', habits]);
    if (overdue.length) groups.push(['Overdue', overdue, 'overdue']);
    if (today.length) groups.push(['Today', today]);
    if (noDate.length) groups.push(['No deadline', noDate]);
  } else if (currentView === 'upcoming') {
    const up = active.filter(t => t.due != null && t.due >= sod + 86400000).sort(byDue);
    const byDay = {};
    up.forEach(t => { const k = startOfDay(new Date(t.due)).getTime(); (byDay[k] ||= []).push(t); });
    Object.keys(byDay).sort((a,b)=>a-b).forEach(k => {
      const d = new Date(+k);
      const label = d.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });
      groups.push([label, byDay[k]]);
    });
  } else if (currentView === 'backlog') {
    const byProj = {};
    active.slice().sort(byPrio).forEach(t => { const k = t.project || '—'; (byProj[k] ||= []).push(t); });
    Object.keys(byProj).sort().forEach(k => groups.push([k === '—' ? 'Unsorted' : '#' + k, byProj[k]]));
  } else if (currentView === 'done') {
    const done = S.tasks.filter(t => t.done).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0)).slice(0, 100);
    if (done.length) groups.push(['Recently cleared', done]);
  }

  const calEls = (typeof renderCalendar === 'function') ? renderCalendar(currentView, sod) : [];
  if (!groups.length && !calEls.length) { renderEmpty(); empty.hidden = false; return; }
  empty.hidden = true;
  calEls.forEach(e => list.appendChild(e));

  for (const [label, items, cls] of groups) {
    const h = document.createElement('div');
    h.className = 'group-head' + (cls ? ' ' + cls : '');
    h.textContent = label;
    list.appendChild(h);
    items.forEach(t => list.appendChild(questEl(t)));
  }
}
const byDue = (a, b) => (a.due || 0) - (b.due || 0) || a.priority - b.priority;
const byPrio = (a, b) => (a.priority || 4) - (b.priority || 4) || (a.due || 9e15) - (b.due || 9e15);

function questEl(t) {
  const el = document.createElement('div');
  if (t.habit) ensureHabitPeriod(t);
  const habitMet = !!(t.habit && (t.habitCount || 0) >= t.habit.target);
  el.className = 'quest' + (t.priority ? ' p' + t.priority : '') + (t.boss ? ' boss' : '') + ((t.done || habitMet) ? ' done' : '');
  el.dataset.id = t.id;

  const meta = [];
  if (t.habit) meta.push(`<span class="q-tag habit">&#8635; ${t.habitCount || 0}/${t.habit.target} this ${t.habit.period}</span>`);
  if (t.boss) meta.push('<span class="q-tag boss">☠ BOSS</span>');
  else if (t.priority === 1) meta.push('<span class="q-tag prio p1">‼ High</span>');
  else if (t.priority === 2) meta.push('<span class="q-tag prio p3">! Low</span>');
  if (t.due) { const dc = dueClass(t.due); const dlabel = dc === 'overdue' ? '⚠ ' : '⏱ '; meta.push(`<span class="q-tag due ${dc}">${dlabel}${fmtDue(t.due, t.hasTime)}</span>`); }
  if (t.repeat) meta.push(`<span class="q-tag repeat">↻ ${repeatLabel(t.repeat)}</span>`);
  if (t.project) meta.push(`<span class="q-tag project">#${t.project}</span>`);
  const subs = t.subtasks || [];
  if (subs.length) { const d = subs.filter(s => s.done).length; meta.push(`<span class="q-tag subs">\u2611 ${d}/${subs.length}</span>`); }
  if (t.notes) meta.push('<span class="q-tag note" title="Has notes">\u{1F4DD}</span>');

  el.innerHTML = `
    <button class="check" aria-label="Clear quest">
      <svg viewBox="0 0 24 24"><polyline points="4,12 10,18 20,6"/></svg>
    </button>
    <div class="q-body">
      <div class="q-title"></div>
      <div class="q-meta">${meta.join('')}</div>
      ${subs.length ? `<div class="q-subs">${subs.map(s => `<button type="button" class="q-sub ${s.done?'done':''}" data-st="${s.id}"><span class="q-sub-box"></span><span class="q-sub-t"></span></button>`).join('')}</div>` : ''}
    </div>
    <div class="q-actions">
      <button class="edit" aria-label="Edit">✎</button>
      <button class="del" aria-label="Delete">✕</button>
    </div>`;
  el.querySelector('.q-title').textContent = t.title;
  if (subs.length) el.querySelectorAll('.q-sub').forEach(btn => {
    const st = subs.find(s => s.id === btn.dataset.st);
    if (st) btn.querySelector('.q-sub-t').textContent = st.title;
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (st) { st.done = !st.done; save(); render(); } });
  });

  el.querySelector('.check').addEventListener('click', (e) => {
    e.stopPropagation();
    if (t.habit) { habitTick(t); return; }
    if (!t.done) { el.classList.add('clearing'); confettiBurst(el); setTimeout(() => clearTask(t), 0); setTimeout(render, 480); }
    else clearTask(t);
  });
  el.querySelector('.q-body').addEventListener('click', () => openEditor(t));
  el.querySelector('.edit').addEventListener('click', (e) => { e.stopPropagation(); openEditor(t); });
  el.querySelector('.del').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Abandon this quest?')) deleteTask(t.id); });

  // swipe to clear (mobile)
  addSwipe(el, t);
  return el;
}
function repeatLabel(r) {
  if (!r) return '';
  let m;
  if (r === 'day') return 'daily';
  if (m = /^day(\d+)$/.exec(r)) return 'every ' + m[1] + ' days';
  if (r === 'week') return 'weekly';
  if (m = /^week(\d+)$/.exec(r)) return m[1] === '2' ? 'fortnightly' : 'every ' + m[1] + ' weeks';
  if (r === 'month') return 'monthly';
  if (m = /^month(\d+)$/.exec(r)) return 'every ' + m[1] + ' months';
  if (r === 'year') return 'yearly';
  if (r === 'weekdays') return 'weekdays';
  if (m = /^mwd:(-?\d+):(\d+)$/.exec(r)) { const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const ords = {'1':'1st','2':'2nd','3':'3rd','4':'4th','5':'5th','-1':'last'}; return (ords[m[1]] || m[1]) + ' ' + names[+m[2]] + ' of month'; }
  if (r.startsWith('wd:')) {
    if (r === 'wd:0,6') return 'weekends';
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const days = r.slice(3).split(',').map(n => names[+n]);
    return days.length === 1 ? 'every ' + days[0] : days.join('/');
  }
  return 'repeats';
}

function renderEmpty() {
  const e = $('#emptyState');
  const map = {
    today: ['⚔️', pick(QUIPS.emptyToday)],
    upcoming: ['🗺️', 'No quests on the horizon. The deeper floors are quiet… for now.'],
    backlog: ['🏰', pick(QUIPS.emptyAll)],
    done: ['💀', 'No cleared quests yet. The dungeon awaits its first casualty.']
  };
  const [g, line] = map[currentView] || ['🏰', 'Nothing here.'];
  e.innerHTML = `<div class="glyph">${g}</div><div class="line">${line}</div>`;
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  S.level = levelFromXp(S.xp);
  const floorXp = xpFloor(S.level), need = xpToNext(S.level);
  const into = S.xp - floorXp;
  $('#xpFill').style.width = Math.min(100, (into / need) * 100) + '%';
  $('#xpText').textContent = `${into} / ${need} XP`;
  $('#avatarLevel').textContent = S.level;
  $('#goldVal').textContent = S.gold;
  $('#streakVal').textContent = S.streak;
  $('#crawlerName').textContent = S.name;
  $('#crawlerTitle').textContent = `Floor ${S.level} · ${rankTitle(S.level)}`;
}

/* ---------------- FX ---------------- */
let logTimer;
function systemLog(html) {
  const el = $('#systemLog'); el.innerHTML = html; el.classList.add('show');
  clearTimeout(logTimer); logTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function toast(ico, html) {
  const stack = $('#toastStack');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="t-ico">${ico}</div><div class="t-text">${html}</div>`;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}
function lootToast(xp, gold, boss) {
  if (S.settings.focusMode) return;
  const drop = Math.random() < (boss ? 0.9 : 0.35) ? pick(LOOT) : null;
  let sub = `+${xp} XP &nbsp;·&nbsp; +${gold} ◈ gold`;
  if (drop) sub += `<br>Loot: ${drop.ico} ${drop.name}`;
  toast(boss ? '🐉' : '✨', `<b>${boss ? 'BOSS LOOT' : 'Loot acquired'}</b><span class="t-sub">${sub}</span>`);
}
function pulse(sel) { const e = $(sel); if (!e) return; const tgt = e.closest('.stat') || e; tgt.classList.add('pulse'); setTimeout(() => tgt.classList.remove('pulse'), 420); }
function confettiBurst(anchor) {
  if (reduceMotion() || S.settings.focusMode) return;
  const r = anchor.getBoundingClientRect();
  const cols = ['#5fd896','#f3c969','#ffb454','#5fb0ff','#ff6b6b','#b07dff'];
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('div'); c.className = 'confetti';
    c.style.background = cols[i % cols.length];
    c.style.left = (r.left + 20) + 'px'; c.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(c);
    const ang = Math.random() * Math.PI - Math.PI / 2, dist = 50 + Math.random() * 80;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 30;
    c.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx}px,${dy + 120}px) rotate(${Math.random()*540}deg)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => c.remove();
  }
}
function levelUp(n) {
  $('#luNum').textContent = n;
  const lines = ['The System acknowledges your effort. Barely.', 'Power flows in. Try not to let it go to your head.',
    'You grow stronger. The dungeon grows hungrier.', 'Level up. The sponsors are thrilled.',
    'New rank unlocked: ' + rankTitle(n) + '.'];
  $('#luSub').textContent = pick(lines);
  $('#levelup').hidden = false; sfx('level');
  if (S.settings.haptics && navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 60]);
  if (!reduceMotion()) for (let i = 0; i < 30; i++) setTimeout(() => confettiBurst($('#luNum')), i * 25);
}

/* ---------------- Sound (WebAudio, optional) ---------------- */
let actx;
function sfx(type) {
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seqs = {
      clear: [[660, 0], [880, .08]], boss: [[330, 0], [440, .08], [660, .16]],
      level: [[523, 0], [659, .1], [784, .2], [1046, .3]], ach: [[784, 0], [1046, .1]]
    };
    (seqs[type] || seqs.clear).forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      o.connect(g); g.connect(actx.destination);
      const s = actx.currentTime + t;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.12, s + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + .18);
      o.start(s); o.stop(s + .2);
    });
  } catch (e) {}
}

/* ---------------- Swipe ---------------- */
function addSwipe(el, t) {
  let x0 = null, y0 = null, dragging = false;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dragging = false; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (x0 == null) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (Math.abs(dx) > Math.abs(dy) && dx > 12) { dragging = true; el.style.transform = `translateX(${Math.min(dx, 90)}px)`; el.style.opacity = 1 - Math.min(dx, 120) / 240; }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const dx = (e.changedTouches[0].clientX - (x0 || 0));
    el.style.transform = ''; el.style.opacity = '';
    if (dragging && dx > 70 && !t.done) { el.classList.add('clearing'); confettiBurst(el); clearTask(t); setTimeout(render, 480); }
    x0 = null;
  });
}

/* ---------------- Notifications ---------------- */
async function enableNotifications() {
  if (!('Notification' in window)) { systemLog('[SYSTEM] This device blocks notifications.'); return false; }
  const perm = await Notification.requestPermission();
  S.settings.notify = perm === 'granted'; save();
  if (S.settings.notify) {
    notify('The System', { body: 'Notifications armed. I will remind you. Relentlessly.' });
  }
  return S.settings.notify;
}
async function notify(title, opts) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) reg.showNotification(title, { icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', ...opts });
    else new Notification(title, opts);
  } catch (e) {}
}
function inQuietHours(d) {
  const h = d.getHours(), s = S.settings.quietStart, e = S.settings.quietEnd;
  if (s === e) return false;
  return s < e ? (h >= s && h < e) : (h >= s || h < e);
}
function checkReminders() {
  if (!S.settings.notify || Notification.permission !== 'granted') return;
  if (inQuietHours(new Date())) return;
  const now = Date.now();
  let dirty = false;
  S.tasks.forEach(t => {
    if (!t.done && t.due && t.hasTime && !t.notified && t.due <= now) {
      notify('⚠ Quest due', { body: t.title + (t.boss ? '  — BOSS' : ''), tag: t.id });
      t.notified = true; dirty = true;
    }
  });
  if (dirty) save();
}

/* ---------------- Sheet (stats / achievements / settings) ---------------- */
function openSheet() {
  const cleared = S.totalCleared, active = S.tasks.filter(t => !t.done).length;
  const ach = ACHIEVEMENTS.map(a => {
    const got = S.unlocked.includes(a.id);
    return `<div class="ach ${got ? 'unlocked' : 'locked'}">
      <div class="a-ico">${got ? a.ico : '🔒'}</div>
      <div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div></div></div>`;
  }).join('');
  const themes = [['dark','#5fd896'],['ember','#ff8c42'],['arcane','#b07dff'],['blood','#ff5d6c'],['light','#e6eaf0']];
  const dots = themes.map(([t,c]) => `<button class="theme-dot ${S.settings.theme===t?'sel':''}" data-theme-set="${t}" style="background:${c}"></button>`).join('');

  $('#sheetBody').innerHTML = `
    <h2>${S.name}</h2>
    <div class="sub">FLOOR ${S.level} · ${rankTitle(S.level).toUpperCase()}</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="v sys">${S.xp}</div><div class="l">Total XP</div></div>
      <div class="stat-card"><div class="v gold">${S.gold}</div><div class="l">Gold</div></div>
      <div class="stat-card"><div class="v">${cleared}</div><div class="l">Quests cleared</div></div>
      <div class="stat-card"><div class="v amber">${S.bestStreak}</div><div class="l">Best streak</div></div>
      <div class="stat-card"><div class="v">${active}</div><div class="l">Active quests</div></div>
      <div class="stat-card"><div class="v">${S.bossesFelled}</div><div class="l">Bosses felled</div></div>
    </div>

    <h2 style="font-size:15px">Achievements <span style="color:var(--text-faint);font-family:var(--mono);font-size:12px">${S.unlocked.length}/${ACHIEVEMENTS.length}</span></h2>
    <div class="ach-list" style="margin:10px 0 22px">${ach}</div>

    <h2 style="font-size:15px">Settings</h2>
    <div class="opt-row"><div class="lbl">Reminders <small>Ping me when timed quests come due</small></div>
      <button class="switch ${S.settings.notify?'on':''}" id="notifSwitch"></button></div>
    <div class="opt-row"><div class="lbl">Sound FX <small>System chimes on clear / level up</small></div>
      <button class="switch ${S.settings.sound?'on':''}" id="soundSwitch"></button></div>
    <div class="opt-row"><div class="lbl">Focus mode <small>Hide XP, gold &amp; level &mdash; just your tasks</small></div>
      <button class="switch ${S.settings.focusMode?'on':''}" id="focusSwitch"></button></div>
    <div class="opt-row"><div class="lbl">Haptics <small>Vibrate on clear &amp; level up (Android)</small></div>
      <button class="switch ${S.settings.haptics?'on':''}" id="hapticSwitch"></button></div>
    <div class="opt-row" style="display:block">
      <div class="lbl" style="margin-bottom:6px">Cross-device sync <small>Back up &amp; sync your quests with your Google account</small></div>
      ${syncSettingsHtml()}
    </div>
    <div class="opt-row" style="display:block">
      <div class="lbl" style="margin-bottom:6px">Google Calendar <small>Show your events here &amp; push timed quests to your calendar</small></div>
      ${gcalSettingsHtml()}
    </div>
    <div class="opt-row" style="display:block">
      <div class="lbl" style="margin-bottom:8px">Quiet hours <small>No reminders between these times</small></div>
      <div class="ef-row"><input class="ef-input" type="time" id="qStart" value="${String(S.settings.quietStart).padStart(2,'0')}:00"><input class="ef-input" type="time" id="qEnd" value="${String(S.settings.quietEnd).padStart(2,'0')}:00"></div>
    </div>
    <div class="opt-row" style="display:block">
      <div class="lbl" style="margin-bottom:8px">Your name</div>
      <input id="nameInput" value="${S.name.replace(/"/g,'&quot;')}" style="width:100%;padding:11px;border-radius:10px;border:1px solid var(--stroke);background:var(--panel);color:var(--text);font-size:15px" />
    </div>
    <div class="opt-row" style="display:block;border:none">
      <div class="lbl" style="margin-bottom:8px">Your save file</div>
      <div class="btn-line">
        <button class="mini-btn" id="exportBtn">⬇ Export backup</button>
        <button class="mini-btn" id="importBtn">⬆ Import</button>
        <button class="mini-btn danger" id="resetBtn">Reset everything</button>
      </div>
    </div>
    <div class="opt-row" style="display:block;border:none">
      <div class="lbl" style="margin-bottom:6px">Feedback <small>Paste a Google Form / link to collect tester feedback (optional)</small></div>
      <input class="ef-input" id="feedbackUrlInput" placeholder="https://forms.gle/..." value="${(S.settings.feedbackUrl||'').replace(/"/g,'&quot;')}" style="margin-bottom:8px" />
      <div class="btn-line">
        <button class="mini-btn" id="feedbackBtn">&#9993; Send feedback</button>
        <button class="mini-btn" id="aboutBtn">About CRAWL</button>
        <button class="mini-btn" id="howtoBtn">How to use</button>
      </div>
    </div>
    <div class="field-help">
      <b>Quick syntax</b> while adding a quest:<br>
      <b>tomorrow 6pm</b>, <b>next fri</b>, <b>jul 4</b>, <b>in 3 days</b> — set a deadline<br>
      <b>every day · weekly · twice a week · weekends · every 3 days</b> — recurring<br>
      <b>!</b> low · <b>!!</b> high · <b>!!!</b> = BOSS fight (big XP)<br>
      <b>#project</b> — tag &amp; group it
    </div>`;

  $('#sheet').hidden = false;

  $('#notifSwitch').onclick = async (e) => { if (!S.settings.notify) { const ok = await enableNotifications(); e.target.classList.toggle('on', ok); } else { S.settings.notify = false; save(); e.target.classList.remove('on'); } };
  $('#soundSwitch').onclick = (e) => { S.settings.sound = !S.settings.sound; save(); e.target.classList.toggle('on', S.settings.sound); if (S.settings.sound) sfx('clear'); };
  $('#focusSwitch').onclick = (e) => { S.settings.focusMode = !S.settings.focusMode; save(); e.target.classList.toggle('on', S.settings.focusMode); applyTheme(); };
  $('#nameInput').onchange = (e) => { S.name = e.target.value.trim() || 'Crawler'; save(); updateHUD(); };
    if ($('#hapticSwitch')) $('#hapticSwitch').onclick = (e) => { S.settings.haptics = !S.settings.haptics; save(); e.target.classList.toggle('on', S.settings.haptics); if (S.settings.haptics && navigator.vibrate) navigator.vibrate(20); };
    if ($('#qStart')) $('#qStart').onchange = (e) => { S.settings.quietStart = parseInt(e.target.value.split(':')[0], 10) || 0; save(); };
    if ($('#qEnd')) $('#qEnd').onchange = (e) => { S.settings.quietEnd = parseInt(e.target.value.split(':')[0], 10) || 0; save(); };
    if ($('#gcalConnect')) $('#gcalConnect').onclick = () => { S.settings.gcalClientId = ($('#gcalCid').value || '').trim(); save(); gcalConnect(); };
    if ($('#gcalHow')) $('#gcalHow').onclick = () => openGcalHelp();
    if ($('#gcalSyncBtn')) $('#gcalSyncBtn').onclick = () => { gcalSyncNow(); systemLog('<span class="sys-prefix">[SYSTEM]</span> Syncing your calendar...'); };
    if ($('#gcalDisc')) $('#gcalDisc').onclick = () => gcalDisconnect();
    if ($('#gcalSyncSwitch')) $('#gcalSyncSwitch').onclick = (e) => { S.settings.gcalSync = !S.settings.gcalSync; save(); e.target.classList.toggle('on', S.settings.gcalSync); };
    if ($('#gcalShowSwitch')) $('#gcalShowSwitch').onclick = (e) => { S.settings.gcalShow = !S.settings.gcalShow; save(); e.target.classList.toggle('on', S.settings.gcalShow); render(); };
    if ($('#feedbackUrlInput')) $('#feedbackUrlInput').onchange = (e) => { S.settings.feedbackUrl = (e.target.value || '').trim(); save(); };
    if ($('#feedbackBtn')) $('#feedbackBtn').onclick = () => { const u = (S.settings.feedbackUrl || DEFAULT_FEEDBACK_URL || '').trim(); if (u) window.open(u, '_blank'); else window.location.href = 'mailto:?subject=' + encodeURIComponent('CRAWL feedback') + '&body=' + encodeURIComponent('What I love / what to improve:\n\n'); };
    if ($('#aboutBtn')) $('#aboutBtn').onclick = () => toast('&#128481;', '<b>CRAWL - The System</b><span class="t-sub">v1.0 &middot; no ads, no tracking &middot; your data stays on your device</span>');
    if ($('#syncSignIn')) $('#syncSignIn').onclick = () => fbSignIn();
    if ($('#syncSignOut')) $('#syncSignOut').onclick = () => fbSignOut();
    if ($('#howtoBtn')) $('#howtoBtn').onclick = () => { $('#sheet').hidden = true; openIntro(false); };
  $('#exportBtn').onclick = exportSave;
  $('#importBtn').onclick = importSave;
  $('#resetBtn').onclick = () => { if (confirm('Wipe ALL progress and quests? The System will not mourn you.')) { localStorage.removeItem(STORE_KEY); S = defaultState(); applyTheme(); $('#sheet').hidden = true; render(); } };
}

function setTheme(t) { S.settings.theme = t; save(); applyTheme(); }
function applyTheme() { document.documentElement.setAttribute('data-theme', S.settings.theme); if (document.body) document.body.classList.toggle('focus', !!S.settings.focusMode); }

function exportSave() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `crawl-save-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importSave() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const data = JSON.parse(r.result); S = Object.assign(defaultState(), data); save(); applyTheme(); $('#sheet').hidden = true; render(); systemLog('[SYSTEM] Save file restored.'); } catch (e) { alert('That file is corrupted or not a Crawl save.'); } };
    r.readAsText(f);
  };
  inp.click();
}

/* ---------------- Live parse preview ---------------- */
function updatePreview() {
  const v = $('#captureInput').value.trim();
  const pv = $('#parsePreview');
  if (!v) { pv.hidden = true; return; }
  const p = parseQuest(v);
  const chips = [];
  if (p.due) chips.push(`<span class="chip">⏱ ${fmtDue(p.due, p.hasTime)}</span>`);
  if (p.repeat) chips.push(`<span class="chip">↻ ${repeatLabel(p.repeat)}</span>`);
  if (p.boss) chips.push(`<span class="chip warn">☠ BOSS</span>`);
  else if (p.priority === 1) chips.push(`<span class="chip warn">!! high</span>`);
  else if (p.priority === 2) chips.push(`<span class="chip">! low</span>`);
  if (p.project) chips.push(`<span class="chip">#${p.project}</span>`);
  if (!chips.length) { pv.hidden = true; return; }
  pv.innerHTML = chips.join(''); pv.hidden = false;
}

/* ---------------- Init / events ---------------- */
function init() {
  applyTheme();
  render();
  updateHUD();

  $('#capture').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#captureInput');
    if (addTask(inp.value)) { inp.value = ''; $('#parsePreview').hidden = true; render(); inp.focus(); }
  });
  $('#captureInput').addEventListener('input', updatePreview);

  $$('.tab').forEach(t => t.addEventListener('click', () => { currentView = t.dataset.view; render(); }));
  $('#menuBtn').addEventListener('click', openSheet);
  $('#avatar').addEventListener('click', openSheet);
  $('#sheetClose').addEventListener('click', () => $('#sheet').hidden = true);
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
  $('#luClose').addEventListener('click', () => $('#levelup').hidden = true);
  { const hb = $('#helpBtn'); if (hb) hb.addEventListener('click', () => openIntro(false)); }
  $('#searchBtn').addEventListener('click', () => {
    const w = $('#searchWrap'); w.hidden = !w.hidden;
    if (!w.hidden) { $('#searchInput').focus(); } else { searchQuery = ''; $('#searchInput').value = ''; render(); }
  });
  $('#searchInput').addEventListener('input', (e) => { searchQuery = e.target.value.trim(); render(); });
  if (S.settings.gcalConnected) gcalInitSilent();
  if (S.settings.syncEnabled) fbInit();

  // keyboard shortcuts (desktop)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === 'n' || e.key === '/') { e.preventDefault(); $('#captureInput').focus(); }
    else if (['1','2','3','4'].includes(e.key)) { currentView = ['today','upcoming','backlog','done'][+e.key-1]; render(); }
    else if (e.key === 's') openSheet();
    else if (e.key === 'Escape') { $('#sheet').hidden = true; $('#levelup').hidden = true; }
  });

  // reminders loop
  checkReminders();
  setInterval(checkReminders, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders(); } });

  // first-run onboarding
  if (!S.onboarded) openIntro(true);
  else if (!S.tasks.length && S.totalCleared === 0) {
    setTimeout(() => systemLog('<span class="sys-prefix">[SYSTEM]</span> Welcome back, Crawler. Add a quest.'), 600);
  }
}

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------------- Google Calendar (optional, client-side) ---------------- */
let gcalToken = null, gcalTokenExp = 0, gcalTokenClient = null;
window.gcalEvents = [];

function gcalSettingsHtml() {
  if (S.settings.gcalConnected) {
    return `<div class="btn-line"><span class="gcal-pill">&#9679; Connected</span><button class="mini-btn" id="gcalSyncBtn">Sync now</button><button class="mini-btn danger" id="gcalDisc">Disconnect</button></div>
      <div class="opt-row" style="padding:12px 0 6px"><div class="lbl">Auto-add timed quests to Calendar</div><button class="switch ${S.settings.gcalSync?'on':''}" id="gcalSyncSwitch"></button></div>
      <div class="opt-row" style="padding:0;border:none"><div class="lbl">Show Calendar events in lists</div><button class="switch ${S.settings.gcalShow?'on':''}" id="gcalShowSwitch"></button></div>`;
  }
  return `<input class="ef-input" id="gcalCid" placeholder="Google OAuth Client ID" value="${(S.settings.gcalClientId||'').replace(/"/g,'&quot;')}" style="margin-bottom:8px" />
    <div class="btn-line"><button class="mini-btn" id="gcalConnect">Connect</button><button class="mini-btn" id="gcalHow">How? &middot; 2-min setup</button></div>`;
}

function renderCalendar(view, sod) {
  const out = [];
  if (!S.settings.gcalShow || !window.gcalEvents || !window.gcalEvents.length) return out;
  if (view !== 'today' && view !== 'upcoming') return out;
  let evs = window.gcalEvents.slice();
  if (view === 'today') evs = evs.filter(e => e.start < sod + 86400000);
  else evs = evs.filter(e => e.start >= sod + 86400000);
  if (!evs.length) return out;
  const head = document.createElement('div'); head.className = 'group-head cal'; head.textContent = 'Calendar';
  out.push(head);
  evs.sort((a,b)=>a.start-b.start).slice(0, 30).forEach(e => {
    const el = document.createElement('div'); el.className = 'quest cal';
    el.innerHTML = `<div class="cal-dot" aria-hidden="true">&#128197;</div><div class="q-body"><div class="q-title"></div><div class="q-meta"><span class="q-tag due">&#9201; ${fmtDue(e.start, true)}</span><span class="q-tag">from Google Calendar</span></div></div>`;
    el.querySelector('.q-title').textContent = e.title;
    out.push(el);
  });
  return out;
}

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'));
    document.head.appendChild(s);
  });
}

async function gcalConnect() {
  const cid = (S.settings.gcalClientId || DEFAULT_GCAL_CLIENT_ID || '').trim();
  if (!cid) { alert('First add your Google OAuth Client ID, then tap Connect. Tap "How?" for the 2-minute setup.'); return; }
  if (location.protocol === 'file:') { alert('Google Calendar needs CRAWL opened from a web address (https://...), not a local file. Host it for free first — see the setup guide.'); return; }
  try {
    await loadGIS();
    gcalTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (resp) => {
        if (resp && resp.access_token) {
          gcalToken = resp.access_token;
          gcalTokenExp = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500000);
          S.settings.gcalConnected = true; save();
          toast('&#128197;', '<b>Google Calendar connected</b><span class="t-sub">Your events now appear in Today &amp; Upcoming.</span>');
          gcalSyncNow();
          if ($('#sheet') && !$('#sheet').hidden) openSheet();
        }
      },
    });
    gcalTokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (e) { alert(e.message || 'Google Calendar connection failed.'); }
}

function gcalDisconnect() {
  gcalToken = null; window.gcalEvents = [];
  S.settings.gcalConnected = false; S.settings.gcalSync = false; save();
  render();
  if ($('#sheet') && !$('#sheet').hidden) openSheet();
}

function gcalEnsureToken() {
  return new Promise((resolve) => {
    if (gcalToken && Date.now() < gcalTokenExp) return resolve(gcalToken);
    if (!gcalTokenClient) return resolve(null);
    gcalTokenClient.callback = (resp) => {
      if (resp && resp.access_token) { gcalToken = resp.access_token; gcalTokenExp = Date.now() + 3500000; resolve(gcalToken); }
      else resolve(null);
    };
    try { gcalTokenClient.requestAccessToken({ prompt: '' }); } catch (e) { resolve(null); }
  });
}

async function gcalSyncNow() {
  const tok = await gcalEnsureToken(); if (!tok) return;
  const timeMin = new Date(Date.now() - 12 * 3600000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();
  try {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      { headers: { Authorization: 'Bearer ' + tok } });
    const data = await r.json();
    window.gcalEvents = (data.items || [])
      .filter(e => e.start && (e.start.dateTime || e.start.date))
      .map(e => ({ title: e.summary || '(no title)', start: new Date(e.start.dateTime || e.start.date).getTime(), id: e.id }));
    render();
  } catch (e) { /* offline */ }
}

window.gcalPushTask = async function (task) {
  const tok = await gcalEnsureToken(); if (!tok || !task.due) return;
  const start = new Date(task.due);
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const body = task.hasTime
    ? { summary: task.title, start: { dateTime: start.toISOString() }, end: { dateTime: new Date(task.due + 3600000).toISOString() } }
    : { summary: task.title, start: { date: localDate(start) }, end: { date: localDate(new Date(task.due + 86400000)) } };
  try {
    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',
      { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    toast('&#128197;', '<b>Added to Google Calendar</b><span class="t-sub">' + task.title + '</span>');
  } catch (e) { /* offline */ }
};

async function gcalInitSilent() {
  const cid = (S.settings.gcalClientId || DEFAULT_GCAL_CLIENT_ID || '').trim();
  if (!cid || location.protocol === 'file:') return;
  try {
    await loadGIS();
    gcalTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: 'https://www.googleapis.com/auth/calendar.events', callback: () => {},
    });
    gcalSyncNow();
  } catch (e) { /* offline */ }
}

function openGcalHelp() {
  const el = $('#intro');
  el.innerHTML = `
    <div class="intro-card">
      <div class="intro-badge">GOOGLE CALENDAR</div>
      <h1>Connect in ~2 minutes</h1>
      <p class="tag">CRAWL talks to your calendar straight from your browser — no server, your data stays yours. You just need a free Google "Client ID".</p>
      <div class="intro-step"><div class="ico">1</div><div class="txt">Open <code>console.cloud.google.com</code> and create a project.</div></div>
      <div class="intro-step"><div class="ico">2</div><div class="txt">APIs &amp; Services &rarr; <b>Enable</b> the <b>Google Calendar API</b>.</div></div>
      <div class="intro-step"><div class="ico">3</div><div class="txt">Credentials &rarr; Create <b>OAuth client ID</b> &rarr; <b>Web application</b>. Add the web address where CRAWL is hosted under "Authorized JavaScript origins".</div></div>
      <div class="intro-step"><div class="ico">4</div><div class="txt">Copy the <b>Client ID</b>, paste it into Settings &rarr; Google Calendar, then tap <b>Connect</b>.</div></div>
      <button class="intro-btn" id="ghDone">GOT IT</button>
    </div>`;
  el.hidden = false;
  $('#ghDone').onclick = () => { el.hidden = true; };
}

/* ---------------- Cross-device sync (Firebase, optional) ---------------- */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCeqo307v6YKZjSYrnUGyNta95BXspisMM',
  authDomain: 'compact-cell-500621-i6.firebaseapp.com',
  projectId: 'compact-cell-500621-i6',
  storageBucket: 'compact-cell-500621-i6.firebasestorage.app',
  messagingSenderId: '136485291900',
  appId: '1:136485291900:web:3c48db3c0ab0b02614c6f9'
};
let fbAuth = null, fbDb = null, fbUser = null, fbUnsub = null, fbReady = false, adoptingRemote = false, pushTimer = null;

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
    S.settings.syncEnabled = !!u; save();
    if (u) fbStartSync(); else fbStopSync();
    updateSyncUI();
  });
}

async function fbSignIn() {
  try {
    await fbInit();
    if (location.protocol === 'file:') { alert('Sync needs CRAWL opened from a web address (https://...), not a local file.'); return; }
    await fbAuth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request')) {
      try { await fbAuth.signInWithRedirect(new window.firebase.auth.GoogleAuthProvider()); } catch (_) {}
    } else if (e && e.code !== 'auth/popup-closed-by-user') {
      alert('Sign-in failed: ' + (e.message || e));
    }
  }
}
async function fbSignOut() { try { await fbAuth.signOut(); } catch (e) {} }

function fbDocRef() { return fbDb.collection('users').doc(fbUser.uid); }

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
    systemLog('<span class="sys-prefix">[SYSTEM]</span> Synced. Your quests now travel with you.');
  } catch (e) { /* offline — local stays primary */ }
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
    applyTheme(); updateHUD(); render();
  } catch (e) { adoptingRemote = false; }
}

function fbPushNow() {
  if (!fbUser || !fbReady) return;
  try { fbDocRef().set({ data: JSON.stringify(S), updatedAt: S.updatedAt || Date.now() }); } catch (e) {}
}
function fbSchedulePush() {
  if (!fbUser || adoptingRemote) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(fbPushNow, 800);
}

function syncSettingsHtml() {
  if (fbUser) {
    return `<div class="btn-line"><span class="gcal-pill">&#9679; Synced</span><button class="mini-btn danger" id="syncSignOut">Sign out</button></div>
      <div class="field-help" style="margin-top:6px">Signed in as <b>${(fbUser.email || 'your account').replace(/</g, '&lt;')}</b>. Your quests sync across every device you sign in on.</div>`;
  }
  return `<div class="btn-line"><button class="mini-btn" id="syncSignIn">&#128274; Sign in with Google to sync</button></div>
    <div class="field-help" style="margin-top:6px">Back up your quests and keep them in sync across phone &amp; laptop. Free.</div>`;
}
function updateSyncUI() { const sh = $('#sheet'); if (sh && !sh.hidden) openSheet(); }

document.addEventListener('DOMContentLoaded', init);
