// Tally QA harness — renders the real app in jsdom and drives flows.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const results = [];
const ok = (n) => results.push(['PASS', n]);
const bad = (n, d) => results.push(['FAIL', n, d]);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8').replace(/if \('serviceWorker' in navigator\) \{[\s\S]*?\}\n?$/, '');

(async () => {
  const consoleErrors = [];
  const dom = new JSDOM(`<!DOCTYPE html>${html.replace(/<link[^>]*>/g, '')}`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://tally.app/',
  });
  const { window } = dom; const document = window.document;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.navigator.vibrate = () => {};
  window.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {} });
  window.confirm = () => true; window.alert = () => {};
  window.console.error = (...a) => consoleErrors.push(a.join(' '));

  try { window.eval(js); ok('app.js evaluates'); } catch (e) { return done(bad('app.js evaluates', e.message)); }
  try { document.dispatchEvent(new window.Event('DOMContentLoaded')); ok('init() runs'); } catch (e) { bad('init() runs', e.message); }

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // onboarding
  !$('#intro').hasAttribute('hidden') ? ok('onboarding shows on first run') : bad('onboarding', 'hidden');
  if ($('#introGo')) $('#introGo').click();
  $('#intro').hasAttribute('hidden') ? ok('onboarding dismisses') : bad('onboarding dismiss', 'still visible');

  // editor / sheet hidden initially
  $('#sheet').hasAttribute('hidden') ? ok('editor sheet hidden on load') : bad('sheet hidden', 'visible');

  // parseQuick
  const P = window.parseQuick;
  const pc = [
    ['stretch 3 times a week', p => p.type === 'weekly' && p.target === 3 && /stretch/i.test(p.title)],
    ['gym 4x a week', p => p.type === 'weekly' && p.target === 4],
    ['read every day', p => p.type === 'daily' && /read/i.test(p.title)],
    ['standup weekdays', p => p.type === 'weekdays' && p.days.join() === '0,1,2,3,4'],
    ['brunch weekends', p => p.type === 'weekdays' && p.days.join() === '5,6'],
    ['call mum mon and thu', p => p.type === 'weekdays' && p.days.join() === '0,3'],
    ['drink water 30 times total', p => p.type === 'finite' && p.target === 30],
  ];
  pc.forEach(([txt, fn]) => { const p = P(txt); fn(p) ? ok(`parse: "${txt}" -> ${p.type}/${p.target||p.days}`) : bad(`parse: "${txt}"`, JSON.stringify(p)); });

  // helper to add a task directly via the engine
  const add = window.addTask;
  add({ title: 'Read', type: 'daily' });
  add({ title: 'Stretch', type: 'weekly', target: 3 });
  add({ title: 'Drink water', type: 'finite', target: 2 });
  const todayDow = ((new Date().getDay()+6)%7);
  add({ title: 'Standup', type: 'weekdays', days: [todayDow] });
  window.renderHeader(); window.setView('today');

  $$('#view-today .card').length >= 3 ? ok('today renders scheduled tasks') : bad('today render', $$('#view-today .card').length);

  // complete a daily task (toggle)
  const readCard = $$('#view-today .card').find(c => /Read/.test(c.textContent));
  readCard.querySelector('.check').click();
  await wait(20);
  const S1 = JSON.parse(window.localStorage.getItem('tally.v1'));
  const readT = S1.tasks.find(t => t.title === 'Read');
  readT.completions.length === 1 ? ok('daily task logs a completion') : bad('daily log', readT.completions.length);

  // toggle it off
  let again = $$('#view-today .card').find(c => /Read/.test(c.textContent));
  again.querySelector('.check').click(); await wait(20);
  const readT2 = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Read');
  readT2.completions.length === 0 ? ok('daily task toggles off (undo)') : bad('daily toggle off', readT2.completions.length);

  // weekly increment
  const stretchCard = $$('#view-today .card').find(c => /Stretch/.test(c.textContent));
  stretchCard.querySelector('.check').click(); await wait(20);
  const strT = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Stretch');
  strT.completions.length === 1 ? ok('weekly goal increments') : bad('weekly inc', strT.completions.length);
  (/1\/3 this week/.test($$('#view-today .card').find(c => /Stretch/.test(c.textContent)).textContent)) ? ok('weekly shows 1/3 this week') : bad('weekly label', 'missing');

  // finite archives after target
  let waterCard = $$('#view-today .card').find(c => /Drink water/.test(c.textContent));
  waterCard.querySelector('.check').click(); await wait(20);
  waterCard = $$('#view-today .card').find(c => /Drink water/.test(c.textContent));
  waterCard.querySelector('.check').click(); await wait(20);
  const waterT = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Drink water');
  (waterT.archived && waterT.completions.length === 2) ? ok('finite goal archives at target') : bad('finite archive', JSON.stringify({a:waterT.archived,c:waterT.completions.length}));
  !$$('#view-today .card').some(c => /Drink water/.test(c.textContent)) ? ok('archived task leaves Today') : bad('archived leaves today', 'still present');

  // editor: open via FAB and add
  $('#fab').click(); await wait(40);
  !$('#sheet').hasAttribute('hidden') && $('#ef-title') ? ok('FAB opens editor with fields') : bad('editor open', 'no fields');
  $('#ef-title').value = 'Meditate';
  $$('.type-opt').find(o => /Weekly goal/.test(o.textContent)).click(); await wait(10);
  // bump target to 5
  const plus = $$('#ef-params .stepper button').find(b => b.textContent === '+');
  plus.click(); plus.click(); await wait(10);
  $('#ef-save').click(); await wait(20);
  const med = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Meditate');
  (med && med.type === 'weekly' && med.target === 5) ? ok('editor creates weekly task target 5') : bad('editor create', JSON.stringify(med && {t:med.type,g:med.target}));
  $('#sheet').hasAttribute('hidden') ? ok('editor closes on save') : bad('editor close', 'open');

  // edit existing + delete
  window.setView('tasks');
  const row = $$('#view-tasks .card').find(c => /Meditate/.test(c.textContent));
  row.querySelector('.card-body').click(); await wait(30);
  $('#ef-title').value = 'Meditate daily';
  $$('.type-opt').find(o => o.querySelector('.t').textContent === 'Every day').click(); await wait(10);
  $('#ef-save').click(); await wait(20);
  const med2 = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => /Meditate daily/.test(t.title));
  (med2 && med2.type === 'daily') ? ok('editor updates existing task') : bad('editor update', JSON.stringify(med2 && {t:med2.type}));

  // stats view
  window.setView('stats'); await wait(20);
  $('#view-stats svg') ? ok('stats donut renders (svg)') : bad('stats donut', 'no svg');
  $$('#view-stats .bar').length === 7 ? ok('stats shows 7 day bars') : bad('day bars', $$('#view-stats .bar').length);
  /\d+%/.test($('#view-stats .ring-read').textContent) ? ok('weekly completion % shows') : bad('completion %', 'missing');

  // settings + theme switch
  window.setView('settings'); await wait(20);
  $$('.swatch').length === 7 ? ok('settings shows 7 themes') : bad('themes', $$('.swatch').length);
  $$('.swatch').find(s => /Blush/.test(s.textContent)).click(); await wait(20);
  document.documentElement.getAttribute('data-theme') === 'blush' ? ok('theme switches to blush') : bad('theme switch', document.documentElement.getAttribute('data-theme'));
  $('#notifyToggle') && $('#reminderTime') ? ok('reminder controls present') : bad('reminder controls', 'missing');
  $('#nameInput').value = 'Gerry'; $('#nameInput').dispatchEvent(new window.Event('input')); await wait(10);
  /Gerry/.test($('#greet').textContent) ? ok('name appears in greeting') : bad('name greeting', $('#greet').textContent);

  // week dots
  window.renderHeader();
  $$('#weekDots .wd-dot').length === 7 ? ok('header shows 7 week dots (Mon-Sun)') : bad('week dots', $$('#weekDots .wd-dot').length);

  // persistence reload
  const snapshot = window.localStorage.getItem('tally.v1');
  JSON.parse(snapshot).tasks.length >= 4 ? ok('state persists to localStorage') : bad('persist', 'too few tasks');

  // ---- Auto icons + tips ----
  const MI = window.matchIcon;
  [['Drink water', '💧'], ['Water plants', '🪴'], ['Morning run', '🏃'], ['Read a chapter', '📖'], ['Call mum', '📞'], ['buy clothes', '🛍️'], ['groceries', '🛒'], ['Pack for holiday', '✈️'], ['Haircut', '💇'], ['Pilates', '🤸'], ['Callisthenics', '🤸'], ['Hobby time', '🎨'], ['Play chess', '🧩'], ['Listen to a podcast', '🎧'], ['Go fishing', '🎣'], ['Dance class', '💃']].forEach(([t, e]) => { const m = MI(t); (m && m.emoji === e) ? ok(`icon: "${t}" -> ${e}`) : bad(`icon: "${t}"`, m && m.emoji); });
  (MI('zzz qqq') === null) ? ok('icon: no match returns null') : bad('icon null', 'matched');
  (window.getTip('Drink water').lead.length > 0) ? ok('tip text for matched task') : bad('tip', 'none');
  (window.getTip('zzz').points.length > 0) ? ok('generic tip for unmatched task') : bad('generic tip', 'none');

  // ---- Discreet info button + popover ----
  window.setView('today');
  const anyCard = $$('#view-today .card')[0];
  anyCard && anyCard.querySelector('.info-btn') ? ok('cards show a discreet info button') : bad('info button', 'missing');
  anyCard.querySelector('.info-btn').click(); await wait(20);
  (!$('#infoPop').hasAttribute('hidden') && /info-points/.test($('#infoPop').innerHTML)) ? ok('info button opens suggestion popover') : bad('info popover', 'not shown');
  $('#infoClose').click(); await wait(10);
  $('#infoPop').hasAttribute('hidden') ? ok('info popover closes') : bad('info close', 'open');

  // ---- Selectable days ----
  window.addTask({ title: 'Floss', type: 'daily' });
  window.renderHeader(); window.setView('today');
  $$('#weekDots .wd').length === 7 ? ok('header day-dots are 7 buttons') : bad('day buttons', $$('#weekDots .wd').length);
  const todayIdx = ((new Date().getDay() + 6) % 7);
  if (todayIdx < 6) {
    $$('#weekDots .wd')[todayIdx + 1].click(); await wait(20);
    $('.day-banner') ? ok('selecting another day shows a banner') : bad('day banner', 'missing');
    const fcard = $$('#view-today .card')[0];
    (fcard && fcard.classList.contains('future')) ? ok('future-day cards are read-only') : bad('future card', 'no class');
    const bF = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Floss').completions.length;
    fcard.querySelector('.check').click(); await wait(20);
    const aF = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Floss').completions.length;
    aF === bF ? ok('cannot complete a future day') : bad('future completion blocked', aF);
    window.selectDay(null); await wait(10);
  } else { ok('future-day tests skipped (Sunday)'); ok('future card (n/a)'); ok('future block (n/a)'); ok('day banner (n/a)'); }
  if (todayIdx > 0) {
    $$('#weekDots .wd')[todayIdx - 1].click(); await wait(20);
    const pcard = $$('#view-today .card').find(c => /Floss/.test(c.textContent));
    pcard.querySelector('.check').click(); await wait(20);
    const fl = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => t.title === 'Floss');
    fl.completions.length >= 1 ? ok('can log a missed past day') : bad('past logging', fl.completions.length);
    window.selectDay(null); await wait(10);
  } else { ok('past-day test skipped (Monday)'); }

  // ---- Weekly goals appear every day until completed ----
  window.selectDay(null);
  window.addTask({ title: 'Hydrate weekly', type: 'weekly', target: 3 });
  const otherIdx = todayIdx === 0 ? 1 : 0;
  window.setView('today');
  $$('#weekDots .wd')[otherIdx].click(); await wait(20);
  $$('#view-today .card').some(c => /Hydrate weekly/.test(c.textContent)) ? ok('weekly goal shows on a non-today day') : bad('weekly on other day', 'missing');
  // complete it to target, then confirm it leaves every day
  window.selectDay(null); window.setView('today');
  for (let i = 0; i < 3; i++) { const hc = $$('#view-today .card').find(c => /Hydrate weekly/.test(c.textContent)); if (hc) hc.querySelector('.check').click(); await wait(15); }
  $$('#weekDots .wd')[otherIdx].click(); await wait(20);
  !$$('#view-today .card').some(c => /Hydrate weekly/.test(c.textContent)) ? ok('completed weekly goal disappears from all days') : bad('weekly disappears', 'still shown');
  window.selectDay(null); await wait(10);

  // ---- Count-down (finite) goals appear every day until done ----
  window.selectDay(null); window.setView('today');
  window.addTask({ title: 'Read 20 books', type: 'finite', target: 20 });
  const otherIdx2 = todayIdx === 0 ? 1 : 0;
  window.setView('today'); $$('#weekDots .wd')[otherIdx2].click(); await wait(20);
  $$('#view-today .card').some(c => /Read 20 books/.test(c.textContent)) ? ok('count-down goal shows on every day until done') : bad('finite on other day', 'missing');
  window.selectDay(null); await wait(10);

  // ---- Celebrations + reward prompt ----
  window.selectDay(null); window.setView('today');
  window.addTask({ title: 'Floss once weekly', type: 'weekly', target: 1 });
  window.setView('today');
  const flc = $$('#view-today .card').find(c => /Floss once weekly/.test(c.textContent));
  flc.querySelector('.check').click(); await wait(20);
  (!$('#celebrate').hasAttribute('hidden')) ? ok('weekly goal completion opens a celebration') : bad('celebrate open', 'hidden');
  /reward yourself/i.test($('#celebrate').textContent) ? ok('celebration prompts you to reward yourself') : bad('reward prompt', 'missing');
  /habit|brain|consistency/i.test($('#celebrate').textContent) ? ok('celebration explains why rewarding helps') : bad('why text', 'missing');
  $('#celebrateClose').click(); await wait(10);
  $('#celebrate').hasAttribute('hidden') ? ok('celebration dismisses') : bad('celebrate close', 'open');
  (/reward/i.test(window.weekCelebration().reward) && /100%/.test(window.weekCelebration().title)) ? ok('100% week celebration content present') : bad('week celebration', 'missing');

  // ---- Date-scheduled tasks ----
  window.selectDay(null); window.setView('today');
  const tkk = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  window.addTask({ title: 'Buy gifts', type: 'finite', target: 3, startDate: tkk(tomorrow) });
  window.setView('today');
  !$$('#view-today .card').some(c => /Buy gifts/.test(c.textContent)) ? ok('future-dated task hidden from Today') : bad('future-dated hidden', 'shown');
  window.setView('tasks');
  const gr = $$('#view-tasks .card').find(c => /Buy gifts/.test(c.textContent));
  (gr && /From /.test(gr.textContent)) ? ok('future-dated task shows in Tasks with a From tag') : bad('From tag', 'missing');
  window.addTask({ title: 'Start now task', type: 'daily', startDate: window.todayKey() });
  window.setView('today');
  $$('#view-today .card').some(c => /Start now task/.test(c.textContent)) ? ok('start-today task visible in Today') : bad('start-today', 'hidden');
  window.addTask({ title: 'Pay fine', type: 'finite', target: 1, dueDate: tkk(yesterday) });
  window.setView('today');
  const pf = $$('#view-today .card').find(c => /Pay fine/.test(c.textContent));
  (pf && /Overdue/.test(pf.textContent)) ? ok('overdue due-date shows an Overdue tag') : bad('overdue tag', 'missing');
  $('#fab').click(); await wait(30);
  $('#ef-title').value = 'Dated via editor';
  $('#ef-start').value = tkk(tomorrow);
  $('#ef-save').click(); await wait(20);
  const dv = JSON.parse(window.localStorage.getItem('tally.v1')).tasks.find(t => /Dated via editor/.test(t.title));
  (dv && dv.startDate === tkk(tomorrow)) ? ok('editor saves a start date') : bad('editor date', dv && dv.startDate);

  // ---- Smart suggestions (AI) ----
  const SS2 = JSON.parse(window.localStorage.getItem('tally.v1'));
  ('aiEnabled' in SS2.settings) ? ok('AI setting present in state') : bad('ai setting', 'missing');
  window.setView('settings'); await wait(10);
  $('#aiToggle') ? ok('Smart suggestions toggle in settings') : bad('ai toggle', 'missing');
  $('#aiToggle').checked = true; $('#aiToggle').dispatchEvent(new window.Event('change')); await wait(10);
  (!$('#celebrate').hasAttribute('hidden') && $('#aiYes')) ? ok('enabling AI shows a consent sheet') : bad('ai consent', 'missing');
  /task names and progress|never your notes/i.test($('#celebrate').textContent) ? ok('consent explains what is shared') : bad('consent text', 'missing');
  $('#aiYes').click(); await wait(10);
  JSON.parse(window.localStorage.getItem('tally.v1')).settings.aiEnabled === true ? ok('consent Turn on enables AI') : bad('ai enable', 'false');
  window.setView('stats'); await wait(10);
  window.aiSetWorker('https://example.workers.dev');
  $('#aiBtn') ? ok('Coach-me button on Stats') : bad('coach button', 'missing');
  $$('#view-stats .insight').length >= 1 ? ok('local multi-week insights show on Stats') : bad('insights', $$('#view-stats .insight').length);
  window.fetch = async () => ({ ok: true, json: async () => ({ coach: 'Nice win on Read. You lean into mornings. Try one stretch after coffee.' }) });
  $('#aiBtn').click(); await wait(40);
  ($('#aiOut .ai-card') && /Nice win on Read/.test($('#aiOut').textContent)) ? ok('coach renders a note in a card') : bad('coach render', $('#aiOut') && $('#aiOut').textContent);
  /AI-generated/.test($('#aiOut').textContent) ? ok('coach shows the AI disclosure') : bad('ai disclosure', 'missing');
  window.fetch = async () => ({ ok: true, json: async () => ({ answer: 'You miss Fridays most — try a 2-minute version that day.' }) });
  $('#aiAsk') ? ok('ask-anything box on Stats') : bad('ask box', 'missing');
  $('#aiAsk').value = 'why do I miss Fridays?';
  $('#aiAskBtn').click(); await wait(40);
  ($('#aiOut .ai-card') && /miss Fridays/.test($('#aiOut').textContent)) ? ok('ask box answers from your data') : bad('ask render', $('#aiOut') && $('#aiOut').textContent);
  window.fetch = async () => ({ ok: true, json: async () => ({ clarified: '10-min walk after lunch, Mon/Wed/Fri' }) });
  $('#fab').click(); await wait(30);
  $('#ef-title').value = 'exercise';
  $('#ef-clarify') ? ok('Sharpen-with-AI button shows in editor when AI on') : bad('clarify button', 'missing');
  if ($('#ef-clarify')) { $('#ef-clarify').click(); await wait(40); }
  (/walk after lunch/.test($('#ef-title').value)) ? ok('clarifier rewrites the task title') : bad('clarify result', $('#ef-title').value);
  if (window.closeSheet) window.closeSheet();

  // assist: Get-an-idea returns real content
  window.fetch = async () => ({ ok: true, json: async () => ({ assist: 'Try grilled chicken, quinoa and roasted veg.' }) });
  $('#fab').click(); await wait(30);
  $('#ef-title').value = 'plan a healthy meal';
  $('#ef-assist') ? ok('Get-an-idea button in editor when AI on') : bad('assist button', 'missing');
  if ($('#ef-assist')) { $('#ef-assist').click(); await wait(40); }
  ($('#ef-aiout .ai-card') && /grilled chicken/.test($('#ef-aiout').textContent)) ? ok('assist returns real content (a meal idea)') : bad('assist render', $('#ef-aiout') && $('#ef-aiout').textContent);
  if (window.closeSheet) window.closeSheet();

  // markdown cleanup helper still used by coach/editor cards
  (window.aiClean && window.aiClean('**Hi** there') === 'Hi there') ? ok('aiClean strips markdown') : bad('aiClean', window.aiClean && window.aiClean('**Hi** there'));
  // automatic AI nudges were removed — confirm Today never shows them
  window.setView('today'); await wait(10);
  (!$('#view-today .proactive')) ? ok('no automatic AI cards on Today') : bad('proactive removed', 'still present');

  // feedback button
  window.setView('settings'); await wait(10);
  $('#feedbackBtn') ? ok('feedback button present in settings') : bad('feedback btn', 'missing');

  // long-term trends (fresh stats render)
  window.setView('stats'); await wait(10);

  // long-term trends
  $$('#view-stats .stat-card').some(c => /Over time/.test(c.textContent)) ? ok('long-term trends card shows') : bad('trends card', 'missing');
  /all-time/.test($('#view-stats').textContent) ? ok('all-time total + longest streak shown') : bad('trends nums', 'missing');

  // habit-stacking (Cue)
  window.fetch = async () => ({ ok: true, json: async () => ({ stack: 'After your morning coffee, read one page.' }) });
  $('#fab').click(); await wait(30);
  $('#ef-title').value = 'Read a chapter';
  $('#ef-stack') ? ok('habit-stacking Cue button in editor') : bad('stack button', 'missing');
  if ($('#ef-stack')) { $('#ef-stack').click(); await wait(40); }
  ($('#ef-aiout .ai-card') && /morning coffee/.test($('#ef-aiout').textContent)) ? ok('habit-stacking suggests a cue') : bad('stack render', $('#ef-aiout') && $('#ef-aiout').textContent);
  if (window.closeSheet) window.closeSheet();

  // ---- Google Calendar (read-only) ----
  const SS = JSON.parse(window.localStorage.getItem('tally.v1'));
  ('gcalConnected' in SS.settings) ? ok('calendar setting present in state') : bad('gcal setting', 'missing');
  window.setView('settings'); await wait(10);
  $('#gcalBtn') ? ok('Google Calendar control in settings') : bad('gcal control', 'missing');
  $('#syncSignIn') ? ok('device sync sign-in control present') : bad('sync control', 'missing');
  // simulate connected + seeded events; verify the day view renders them read-only
  window.calTestConnect(true);
  window.calCacheSet(window.todayKey(), [{ title: 'Dentist 10am', allDay: false, timeLabel: '10am' }]);
  window.setView('today'); await wait(10);
  ($$('#view-today .cal-event').length >= 1 && /Dentist/.test($('#view-today').textContent)) ? ok('calendar events render read-only in day view') : bad('cal render', $$('#view-today .cal-event').length);
  // events persist across launches — no 'Load calendar events' tap needed
  window.calCacheSet(window.todayKey(), [{ title: 'Persisted ev', allDay: true, timeLabel: 'All day' }]);
  window.gcalCacheSave();
  const craw = window.localStorage.getItem('tally.gcal.v1');
  (craw && /Persisted ev/.test(craw)) ? ok('calendar events persist to storage') : bad('cal cache save', craw);
  window.gcalCacheLoad();
  window.setView('today'); await wait(10);
  (/Persisted ev/.test($('#view-today').textContent)) ? ok('cached calendar events show on launch (no button)') : bad('cal cache render', 'missing');
  !$$('#view-today button').some(b => /Load calendar events/.test(b.textContent)) ? ok('no Load-calendar button when events cached') : bad('cal button hidden', 'still shown');
  window.calTestConnect(false); window.setView('today'); await wait(10);
  !$$('#view-today .cal-event').length ? ok('calendar section hides when disconnected') : bad('cal hide', 'still shown');

  // CSS sanity
  /\[hidden\] \{ display: none !important; \}/.test(css) ? ok('[hidden] override in CSS') : bad('[hidden] override', 'missing');
  /prefers-reduced-motion/.test(css) ? ok('reduced-motion handled') : bad('reduced motion', 'missing');
  /data-theme="charcoal"/.test(css) ? ok('dark (charcoal) theme present') : bad('charcoal theme', 'missing');
  /\.info-pop/.test(css) ? ok('info popover styled') : bad('info-pop css', 'missing');
  /\.ttl-ico/.test(css) ? ok('inline task-icon styled') : bad('ttl-ico css', 'missing');
  /\.cal-event/.test(css) ? ok('calendar event styled') : bad('cal-event css', 'missing');

  consoleErrors.length === 0 ? ok('no console.error during run') : bad('console errors', consoleErrors.slice(0, 3).join(' | '));

  done();
  function done(x) {
    const pass = results.filter(r => r[0] === 'PASS').length;
    const fail = results.filter(r => r[0] === 'FAIL');
    console.log('\n=============== TALLY QA REPORT ===============');
    results.forEach(r => console.log(`${r[0] === 'PASS' ? '  OK ' : '  XX '} ${r[1]}${r[2] ? '  -> ' + r[2] : ''}`));
    console.log('----------------------------------------------');
    console.log(`  ${pass} passed, ${fail.length} failed, of ${results.length} checks`);
    if (consoleErrors.length) console.log('  errors:\n   ' + consoleErrors.slice(0, 5).join('\n   '));
    console.log('==============================================');
    process.exit(fail.length ? 1 : 0);
  }
})();
