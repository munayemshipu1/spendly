import { ICONS } from './icons.js';
import * as S from './store.js';
import {
  todayKey, addDays, monthName, monthShort, monthLabel, shortDay, dayLabel, dayMonth,
  PERIODS, periodOf, periodRange, periodStep, weekLabel, rangeLabel, customKey, daysBetween,
  esc, uid, sanitizeAmount, parseAmount, pad, monthOf, addMonths,
} from './util.js';

/* ═════════════ State ═════════════ */
let state = S.load();
const ui = { date: todayKey(), homeType: 'expense', period: 'month', custom: null, stack: [{ name: 'home' }] };

const $ = (s, r = document) => r.querySelector(s);
const viewEl = $('#view');
const dockEl = $('#dock');
const ovRoot = $('#overlays');

const CAT_ICONS = [
  'restaurant', 'fastfood', 'local_cafe', 'lunch_dining', 'shopping_cart', 'kitchen',
  'shopping_bag', 'checkroom', 'directions_bus', 'directions_car', 'local_taxi', 'two_wheeler',
  'train', 'flight', 'local_gas_station', 'home', 'bolt', 'water_drop',
  'local_fire_department', 'wifi', 'smartphone', 'tv', 'receipt_long', 'credit_card',
  'medical_services', 'local_hospital', 'medication', 'fitness_center', 'spa', 'content_cut',
  'school', 'menu_book', 'family_restroom', 'child_care', 'pets', 'movie',
  'sports_esports', 'music_note', 'celebration', 'card_giftcard', 'volunteer_activism', 'local_bar',
  'bakery_dining', 'icecream', 'hotel', 'beach_access', 'sports_soccer', 'subscriptions',
  'build', 'local_laundry_service', 'savings', 'account_balance', 'payments', 'attach_money',
  'work', 'laptop', 'trending_up', 'storefront', 'sell', 'redeem', 'more_horiz', 'category',
];
const EMOJIS = ('☕ 🍔 🍕 🍜 🍣 🥗 🍎 🛒 🧋 🍰 🍺 🍷 🚗 🚕 🚌 🚆 ✈️ ⛽ 🏍️ 🅿️ 🏠 💡 💧 🔥 📱 💻 📺 🎮 🎬 🎵 📚 🎓 ' +
  '💊 🏥 🏋️ 💇 👕 👟 👜 💄 🎁 🎉 🐶 🐱 👶 🧸 💍 🧾 💳 🏦 💰 💵 📈 🛠️ 🧹 🧺 🌿 ⚽ 🏖️ 🏨 🕌 🙏 ❤️ ⭐').split(' ');
const UNCAT = { id: null, type: null, name: 'Uncategorised', icon: 'category', emoji: null, color: '#6B6459' };

/* ═════════════ Helpers ═════════════ */
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const round2 = (n) => Math.round(n * 100) / 100;
const top = () => ui.stack[ui.stack.length - 1];
const isInk = (c) => String(c).toUpperCase() === '#141414';
const colorVar = (c) => (isInk(c) ? 'var(--ink)' : c);

const nfCache = {};
const nf = (decimals) => (nfCache[state.numberFormat + decimals] ||= new Intl.NumberFormat(state.numberFormat,
  { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
function money(n, { sign = false } = {}) {
  const c = state.currency;
  const abs = Math.round(Math.abs(n) * 100) / 100;
  // Whole amounts stay clean (£950); anything with pence shows both digits (£1,291.50).
  const s = c + (/[A-Za-z.]$/.test(c) ? ' ' : '') + nf(Number.isInteger(abs) ? 0 : 2).format(abs);
  if (sign) return (n < 0 ? '−' : '+') + s;
  return n < 0 ? '−' + s : s;
}

const catById = (id) => state.categories.find((c) => c.id === id);
const catOf = (id) => catById(id) || UNCAT;
const cats = (type) => state.categories.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
const inPeriod = (period, key) => {
  const [a, b] = periodRange(period, key);
  return state.tx.filter((t) => t.date >= a && t.date <= b);
};
const isCurrent = (period, key) => period !== 'custom' && periodOf(period, todayKey()) === key;
/** True when the period reaches today or later (so "next" makes no sense). */
const reachesNow = (period, key) => periodRange(period, key)[1] >= todayKey();
const customLabel = (key) => rangeLabel(...key.split('_'));
const thisYear = () => String(new Date().getFullYear());

/** Heading form: "This week", "2–8 Nov", "November", "March 2025", "2026", "All-time" */
function periodTitle(period, key) {
  if (period === 'week') return isCurrent(period, key) ? 'This week' : weekLabel(key);
  if (period === 'month') return key.slice(0, 4) === thisYear() ? monthName(key) : monthLabel(key);
  if (period === 'year') return key;
  if (period === 'custom') return customLabel(key);
  return 'All-time';
}
/** Phrase after "Spent": "this week", "2–8 Nov", "in November", "in 2026", "overall" */
function periodPhrase(period, key) {
  if (period === 'week') return isCurrent(period, key) ? 'this week' : weekLabel(key);
  if (period === 'all') return 'overall';
  if (period === 'custom') return customLabel(key);
  return 'in ' + periodTitle(period, key);
}
/** Label for the ‹ › switcher and period lists */
function periodName(period, key) {
  if (period === 'week') return (isCurrent(period, key) ? 'This week · ' : '') + weekLabel(key);
  if (period === 'month') return monthLabel(key);
  if (period === 'custom') return customLabel(key);
  return key;
}
const sortTx = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);

function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
}

function breakdown(list, type) {
  const m = new Map();
  for (const t of list) {
    if (t.type !== type) continue;
    const key = catById(t.catId) ? t.catId : null;
    const e = m.get(key) || { cat: catOf(key), value: 0, count: 0 };
    e.value += t.amount;
    e.count++;
    m.set(key, e);
  }
  return [...m.values()].map((e) => ({ ...e, value: round2(e.value) })).sort((a, b) => b.value - a.value);
}

const pct = (v, t) => {
  if (!t) return 0;
  const p = (v / t) * 100;
  return p > 0 && p < 1 ? '<1' : Math.round(p);
};

function persist() {
  if (!S.save(state)) toast('Could not save — device storage is full');
}

/* ═════════════ Recurring (monthly) entries ═════════════ */
/** The entry's date in month mk, clamped to short months (31st → 28/29/30th). */
function dueDate(r, mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${mk}-${pad(Math.min(r.day, new Date(y, m, 0).getDate()))}`;
}
/** Next date this will be added, or null when paused. */
function nextDue(r) {
  if (r.paused) return null;
  let mk = r.lastPosted ? addMonths(r.lastPosted, 1) : monthOf(r.start);
  let d = dueDate(r, mk);
  if (d < r.start) { mk = addMonths(mk, 1); d = dueDate(r, mk); }
  return d;
}
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const recName = (r) => r.note || catOf(r.catId).name;
const recDayText = (r) => `the ${ordinal(r.day)}${r.day > 28 ? ' (or last day)' : ''}`;

/** Add every due-but-missing recurring entry up to today. Safe to call any time. */
function postRecurring() {
  const today = todayKey();
  const added = [];
  for (const r of state.recurring) {
    if (r.paused) continue;
    let mk = r.lastPosted ? addMonths(r.lastPosted, 1) : monthOf(r.start);
    for (let guard = 0; guard < 600; guard++) {
      const date = dueDate(r, mk);
      if (date > today) break;
      const exists = state.tx.some((t) => t.recurringId === r.id && t.date.startsWith(mk));
      if (date >= r.start && !exists) {
        const t = { id: uid(), type: r.type, amount: r.amount, catId: r.catId, date, note: r.note || '', recurringId: r.id, createdAt: Date.now() };
        state.tx.push(t);
        added.push(t);
      }
      r.lastPosted = mk;
      mk = addMonths(mk, 1);
    }
  }
  if (added.length) persist();
  return added;
}

function announceAdded(added) {
  if (!added.length) return;
  const names = [...new Set(added.map((t) => t.note || catOf(t.catId).name))];
  toast(`Added ${added.length} recurring ${added.length === 1 ? 'entry' : 'entries'}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`);
}

/* ═════════════ UI building blocks ═════════════ */
function chip(cat, cls = '') {
  const style = `style="--c:${colorVar(cat.color)}"`;
  if (cat.emoji) return `<span class="chip emoji ${cls}" ${style}>${esc(cat.emoji)}</span>`;
  return `<span class="chip ${isInk(cat.color) ? 'ink' : ''} ${cls}" ${style}>${ic(cat.icon)}</span>`;
}

function donut(items, total, label, value, extra = '') {
  const R = 82, C = 2 * Math.PI * R, SW = 30;
  let segs = '';
  if (total > 0) {
    const gap = items.length > 1 ? 2.4 : 0;
    let off = 0;
    for (const it of items) {
      const len = (it.value / total) * C;
      const dash = Math.max(len - gap, 0.01);
      segs += `<circle cx="100" cy="100" r="${R}" fill="none" stroke-width="${SW}" style="stroke:${colorVar(it.cat.color)}" stroke-dasharray="${dash.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
      off += len;
    }
  } else {
    segs = `<circle cx="100" cy="100" r="${R}" fill="none" stroke-width="${SW}" style="stroke:var(--surface-2)"/>`;
  }
  return `<div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(label)} ${esc(value)}"><g transform="rotate(-90 100 100)">${segs}</g></svg>
    <div class="donut-center"><small>${esc(label)}</small><strong class="num">${value}</strong>${extra}</div></div>`;
}

function breakdownRows(items, total, period, key) {
  return items.map((it) => `
    <button class="row" data-action="open-cat" data-cat="${it.cat.id ?? ''}" data-period="${period}" data-key="${key}">
      ${chip(it.cat)}
      <span class="main"><span class="title" style="display:block">${esc(it.cat.name)}</span>
        <span class="sub" style="display:block">${pct(it.value, total)}% · ${it.count} ${it.count === 1 ? 'entry' : 'entries'}</span></span>
      <span class="amt num">${money(it.value)}</span>${ic('chevron_right', 'chev')}
    </button>`).join('');
}

function txRow(t, { showDate = false } = {}) {
  const c = catOf(t.catId);
  const sub = [showDate ? shortDay(t.date) : '', t.recurringId ? `${ic('autorenew', 'inline-ic')} Monthly` : '', t.note ? esc(t.note) : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-action="edit-tx" data-id="${t.id}">
    ${chip(c)}
    <span class="main"><span class="title" style="display:block">${esc(c.name)}</span>${sub ? `<span class="sub" style="display:block">${sub}</span>` : ''}</span>
    <span class="amt num ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
  </button>`;
}

function groupedTx(list) {
  const groups = new Map();
  for (const t of list) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  return [...groups].map(([d, ts]) => `
    <div class="day-head"><span>${dayLabel(d)}</span><span class="num">${money(totals(ts).net, { sign: true })}</span></div>
    <div class="card"><div class="rows">${ts.map((t) => txRow(t)).join('')}</div></div>`).join('');
}

const appbar = (title, extra = '') => `
  <header class="appbar">
    <button class="icon-btn ghost" data-action="back" aria-label="Back">${ic('arrow_back')}</button>
    <h1>${esc(title)}</h1>${extra}
  </header>`;

const tabs = (items, active, action) => {
  const i = Math.max(0, items.findIndex(([k]) => k === active));
  return `<div class="tabs" role="tablist" style="--n:${items.length};--i:${i}">${items.map(([k, l]) =>
    `<button role="tab" aria-selected="${k === active}" class="${k === active ? 'on' : ''}" data-action="${action}" data-v="${k}">${l}</button>`).join('')}<span class="ink"></span></div>`;
};

const seg = (items, active, action, cls = '') => `<div class="seg ${cls}">${items.map(([k, l, aria]) =>
  `<button class="${k === active ? 'on' : ''} ${l.startsWith('<svg') ? 'icon-seg' : ''}" data-action="${action}" data-v="${k}"${aria ? ` aria-label="${aria}" title="${aria}"` : ''}>${l}</button>`).join('')}</div>`;
const periodTabs = () => [...PERIODS, ['custom', ic('date_range'), 'Custom date range']];

/* ═════════════ Views ═════════════ */
const VIEWS = {
  home() {
    const period = ui.period;
    const key = period === 'custom' ? ui.custom : periodOf(period, ui.date);
    const list = inPeriod(period, key);
    const T = totals(list);
    const type = ui.homeType;
    const items = breakdown(list, type);
    const total = type === 'expense' ? T.expense : T.income;
    const phrase = periodPhrase(period, key);
    const day = state.tx.filter((t) => t.date === ui.date).sort(sortTx);
    const isToday = ui.date === todayKey();
    const collapse = items.length > 6 && !ui.allCats;

    const html = `
      <header class="topbar">
        <h1 class="brand">Spend<span>ly</span></h1>
        <button class="icon-btn raised" data-action="menu" aria-label="Menu">${ic('menu')}</button>
      </header>
      <div class="datenav">
        <button class="icon-btn raised" data-action="day" data-n="-1" aria-label="Previous day">${ic('chevron_left')}</button>
        <label class="datenav-label"><span>${dayLabel(ui.date)}</span>${ic('expand_more')}
          <input type="date" class="date-input" data-input="home-date" value="${ui.date}" aria-label="Pick a date"></label>
        <button class="icon-btn raised" data-action="day" data-n="1" aria-label="Next day">${ic('chevron_right')}</button>
      </div>

      <div class="period-bar">${seg(periodTabs(), period, 'home-period', 'full')}</div>

      <div class="section-row"><span class="section-label">${periodTitle(period, key)} overview</span>
        ${period === 'custom' ? '<button class="link" data-action="home-period" data-v="custom">Change dates</button>'
          : `<button class="link" data-action="stats" data-period="${period}" data-key="${key}">Statistics ›</button>`}</div>
      <button class="card overview" data-action="stats" data-period="${period}" data-key="${key}" aria-label="Open statistics">
        <span><span class="k"><i class="dot income"></i>Income</span><strong class="num">${money(T.income)}</strong></span>
        <span><span class="k"><i class="dot expense"></i>Expense</span><strong class="num">${money(T.expense)}</strong></span>
        <span><span class="k"><i class="dot balance"></i>Balance</span><strong class="num ${T.net < 0 ? 'neg' : ''}">${money(T.net)}</strong></span>
      </button>

      <section class="card" style="margin-top:12px">
        <div class="card-head"><h2>By category</h2>
          ${seg([['expense', 'Expenses'], ['income', 'Income']], type, 'home-type')}</div>
        ${donut(items, total, `${type === 'expense' ? 'Spent' : 'Earned'} ${phrase}`, money(total))}
        <div class="rows">${items.length ? breakdownRows(collapse ? items.slice(0, 5) : items, total, period, key)
          : `<div class="empty">No ${type === 'expense' ? 'expenses' : 'income'} ${phrase} yet.<br>Tap <b>${type === 'expense' ? '− Expenses' : '+ Income'}</b> below to add one.</div>`}
          ${items.length > 6 ? `<button class="more-btn" data-action="toggle-cats">${collapse ? `Show all ${items.length} categories` : 'Show fewer'}${ic(collapse ? 'expand_more' : 'expand_less')}</button>` : ''}</div>
      </section>

      <div class="section-row"><span class="section-label">${isToday ? 'Today' : shortDay(ui.date)}</span>
        ${day.length ? `<span class="section-label num">${money(totals(day).net, { sign: true })}</span>` : ''}</div>
      <div class="card"><div class="rows">${day.length ? day.map((t) => txRow(t)).join('')
        : `<div class="empty">Nothing logged on ${isToday ? 'today' : 'this day'} yet.</div>`}</div></div>`;

    return { html };
  },

  stats(p) {
    const { period, key, type } = p;
    // 'all' is broken down by year in the trend chart and list, custom ranges by month.
    const bp = period === 'all' ? 'year' : period === 'custom' ? 'month' : period;
    const fixed = period === 'all' || period === 'custom'; // no matching row/bar to highlight
    const per = new Map();
    for (const t of state.tx) {
      const k = periodOf(bp, t.date);
      const e = per.get(k) || { income: 0, expense: 0 };
      e[t.type] += t.amount;
      per.set(k, e);
    }
    const list = inPeriod(period, key);
    const T = totals(list);
    const items = breakdown(list, type);
    const total = type === 'expense' ? T.expense : T.income;

    let delta = '';
    if (period !== 'all') {
      const prevKey = periodStep(period, key, -1);
      const prevT = totals(inPeriod(period, prevKey));
      const prevTotal = type === 'expense' ? prevT.expense : prevT.income;
      if (prevTotal > 0 && total > 0) {
        const d = Math.round(((total - prevTotal) / prevTotal) * 100);
        const vs = period === 'week' ? 'previous week' : period === 'month' ? monthShort(prevKey)
          : period === 'custom' ? `previous ${daysBetween(...key.split('_')) + 1} days` : prevKey;
        delta = d === 0 ? `<div class="delta">Same as ${vs}</div>`
          : `<div class="delta ${type} ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs ${vs}</div>`;
      }
    }

    const nowKey = periodOf(bp, todayKey());
    const keys = [...new Set([...per.keys(), nowKey, fixed ? nowKey : key])].sort().reverse().slice(0, 60);
    const listTitle = { week: 'All weeks', month: 'All months', year: 'All years', all: 'By year', custom: 'All months' }[period];
    const trendTitle = { week: '6-week trend', month: '6-month trend', year: '6-year trend', all: '6-year trend', custom: '6-month trend' }[period];

    const html = `
      ${appbar('Statistics')}
      <div class="period-bar top">${seg(periodTabs(), period, 'stats-period', 'full')}</div>
      <section class="card">
        ${tabs([['expense', 'Expenses'], ['income', 'Income']], type, 'stats-type')}
        ${period === 'all' ? '' : `<div class="month-switch">
          <button class="icon-btn ghost" data-action="stats-step" data-n="-1" aria-label="Previous ${period}">${ic('chevron_left')}</button>
          ${period === 'custom' ? `<button class="range-btn" data-action="stats-period" data-v="custom">${periodName(period, key)}${ic('expand_more')}</button>` : `<strong>${periodName(period, key)}</strong>`}
          <button class="icon-btn ghost" data-action="stats-step" data-n="1" aria-label="Next ${period}" ${reachesNow(period, key) ? 'disabled' : ''}>${ic('chevron_right')}</button>
        </div>`}
        ${donut(items, total, `${type === 'expense' ? 'Spent' : 'Earned'} ${periodPhrase(period, key)}`, money(total), delta)}
        <div class="rows">${items.length ? breakdownRows(items, total, period, key)
          : `<div class="empty">No ${type === 'expense' ? 'expenses' : 'income'} recorded ${periodPhrase(period, key)}.</div>`}</div>
      </section>

      <section class="card trend">
        <div class="trend-head"><h2>${trendTitle}</h2>
          <div class="legend"><span><i class="dot income"></i>Income</span><span><i class="dot expense"></i>Expense</span></div></div>
        ${trendChart(bp, period === 'all' ? nowKey : period === 'custom' ? periodOf('month', key.slice(11)) : key, per, fixed ? null : key)}
      </section>

      <div class="section-row"><span class="section-label">${listTitle}</span></div>
      ${keys.map((k) => {
        const e = per.get(k) || { income: 0, expense: 0 };
        const net = round2(e.income - e.expense);
        return `<button class="month-card ${!fixed && k === key ? 'on' : ''}" data-action="stats-goto" data-key="${k}" data-scroll="1">
          <span class="l"><span class="name">${periodName(bp, k)}</span><span class="net num ${net < 0 ? 'neg' : ''}">${money(net, { sign: true })}</span></span>
          <span class="l"><span class="num">Income ${money(round2(e.income))}</span><span class="num">Expense ${money(round2(e.expense))}</span></span>
        </button>`;
      }).join('')}`;
    return { html };
  },

  cat(p) {
    const { period, key } = p;
    const cat = p.catId ? catOf(p.catId) : UNCAT;
    const all = inPeriod(period, key);
    const list = all.filter((t) => (p.catId ? t.catId === p.catId : !catById(t.catId))).sort(sortTx);
    const type = cat.type || list[0]?.type || 'expense';
    const sum = round2(list.reduce((a, t) => a + t.amount, 0));
    const T = totals(all);
    const typeTotal = type === 'income' ? T.income : T.expense;
    const phrase = periodPhrase(period, key);

    const html = `
      ${appbar(cat.name)}
      <div class="period-bar top">${seg(periodTabs(), period, 'cat-period', 'full')}</div>
      <section class="card">
        <div class="summary">${chip(cat, 'lg')}
          <div style="flex:1;min-width:0">
            <div class="muted" style="font-size:13px">${type === 'income' ? 'Earned' : 'Spent'} ${phrase}</div>
            <div class="big num">${money(sum)}</div>
            <div class="muted" style="font-size:13px">${list.length} ${list.length === 1 ? 'entry' : 'entries'} · ${pct(sum, typeTotal)}% of ${type === 'income' ? 'income' : 'spending'}</div>
          </div></div>
        ${period === 'all' ? '' : `<div class="month-switch" style="padding:0 8px 8px">
          <button class="icon-btn ghost" data-action="cat-step" data-n="-1" aria-label="Previous ${period}">${ic('chevron_left')}</button>
          ${period === 'custom' ? `<button class="range-btn" data-action="cat-period" data-v="custom">${periodName(period, key)}${ic('expand_more')}</button>` : `<strong>${periodName(period, key)}</strong>`}
          <button class="icon-btn ghost" data-action="cat-step" data-n="1" aria-label="Next ${period}" ${reachesNow(period, key) ? 'disabled' : ''}>${ic('chevron_right')}</button>
        </div>`}
      </section>
      ${list.length ? groupedTx(list) : `<div class="card" style="margin-top:12px"><div class="empty">Nothing ${phrase}.</div></div>`}`;

    return { html };
  },

  history(p) {
    const html = `
      ${appbar('All transactions')}
      <label class="search">${ic('search')}<input type="search" data-input="history-q" placeholder="Search notes, categories, amounts" value="${esc(p.q)}" autocomplete="off"></label>
      <div class="chips">${[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']].map(([k, l]) =>
        `<button class="${p.filter === k ? 'on' : ''}" data-action="hist-filter" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="hist-results">${historyResults(p)}</div>`;
    return { html };
  },

  categories(p) {
    const type = p.type;
    const counts = new Map();
    for (const t of state.tx) counts.set(t.catId, (counts.get(t.catId) || 0) + 1);
    const list = cats(type);
    const html = `
      ${appbar('Categories', `<button class="icon-btn ghost" data-action="new-cat" data-type="${type}" aria-label="Add category">${ic('add')}</button>`)}
      ${tabs([['expense', 'Expenses'], ['income', 'Income']], type, 'cats-type')}
      <p class="note" style="padding:12px 6px 4px">Drag ${ic('drag_indicator', 'inline-ic')} to reorder — the order is used in the add screen.</p>
      <div class="card"><div class="cat-list" data-type="${type}">
        ${list.map((c) => `<div class="cat-row" data-id="${c.id}">
          <span class="drag" data-drag aria-label="Drag to reorder">${ic('drag_indicator')}</span>
          ${chip(c)}
          <button class="main" data-action="edit-cat" data-id="${c.id}">
            <span class="title" style="display:block;font-weight:600">${esc(c.name)}</span>
            <span class="sub" style="display:block;font-size:13px;color:var(--text-2)">${counts.get(c.id) || 0} entries</span></button>
          <button class="icon-btn ghost" data-action="edit-cat" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">${ic('edit')}</button>
        </div>`).join('') || '<div class="empty">No categories yet.</div>'}
      </div>
      <button class="add-row" data-action="new-cat" data-type="${type}"><span class="chip outline">${ic('add')}</span>Add ${type === 'expense' ? 'an expense' : 'an income'} category</button>
      </div>`;
    return { html };
  },

  recurring() {
    const list = [...state.recurring].sort((a, b) => (a.paused - b.paused) || a.day - b.day);
    const active = list.filter((r) => !r.paused);
    const out = round2(active.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
    const inc = round2(active.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0));
    const row = (r) => {
      const next = nextDue(r);
      return `<button class="row ${r.paused ? 'paused' : ''}" data-action="edit-rec" data-id="${r.id}">
        ${chip(catOf(r.catId))}
        <span class="main"><span class="title" style="display:block">${esc(recName(r))}</span>
          <span class="sub" style="display:block">${r.paused ? 'Paused' : `Every ${ordinal(r.day)} · next ${next ? dayMonth(next) : '—'}`}</span></span>
        <span class="amt num ${r.type}">${r.type === 'income' ? '+' : '−'}${money(r.amount)}</span>
      </button>`;
    };
    const section = (type, title) => {
      const items = list.filter((r) => r.type === type);
      return items.length ? `<div class="section-row"><span class="section-label">${title}</span></div>
        <div class="card"><div class="rows">${items.map(row).join('')}</div></div>` : '';
    };
    const html = `
      ${appbar('Recurring', `<button class="icon-btn ghost" data-action="new-rec" aria-label="Add recurring payment">${ic('add')}</button>`)}
      <p class="note" style="padding:0 6px 10px">Bills and income that repeat every month. Each one is added to your entries automatically on its day — no need to log it yourself.</p>
      ${list.length ? `
        <div class="card overview">
          <span><span class="k"><i class="dot expense"></i>Monthly out</span><strong class="num">${money(out)}</strong></span>
          <span><span class="k"><i class="dot income"></i>Monthly in</span><strong class="num">${money(inc)}</strong></span>
          ${inc > 0
            ? `<span><span class="k"><i class="dot balance"></i>Left over</span><strong class="num ${inc - out < 0 ? 'neg' : ''}">${money(round2(inc - out))}</strong></span>`
            : `<span><span class="k"><i class="dot balance"></i>Per year</span><strong class="num">${money(round2(out * 12))}</strong></span>`}
        </div>
        ${section('expense', 'Bills & expenses')}${section('income', 'Income')}`
      : `<div class="card"><div class="empty">${ic('autorenew')}No recurring payments yet.<br>Add things like rent, insurance, bills, subscriptions or your salary.</div></div>`}
      <button class="btn soft block" style="margin-top:14px" data-action="new-rec">${ic('add')}Add recurring payment</button>`;
    return { html };
  },

  settings() {
    const CURS = ['£', '$', '€', '৳', '₹', '¥', '₦', 'Tk'];
    const custom = CURS.includes(state.currency) ? '' : state.currency;
    const html = `
      ${appbar('Settings')}
      <div class="section-row"><span class="section-label">Currency symbol</span></div>
      <div class="card"><div class="cur-grid" style="padding-top:14px">
        ${CURS.map((c) => `<button class="${state.currency === c ? 'on' : ''}" data-action="set-cur" data-v="${c}">${c}</button>`).join('')}
        <input data-input="cur-custom" placeholder="Other" maxlength="4" value="${esc(custom)}" aria-label="Custom currency symbol">
      </div>
      <div class="section-label" style="padding:0 12px 8px">Number grouping</div>
      <div class="set-seg">${seg([['en-US', '1,234,567'], ['en-IN', '12,34,567']], state.numberFormat, 'set-fmt')}</div></div>

      <div class="section-row"><span class="section-label">Appearance</span></div>
      <div class="card"><div class="set-seg" style="padding-top:14px">${seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], state.theme, 'set-theme')}</div></div>

      <div class="section-row"><span class="section-label">Your data</span></div>
      <div class="card"><div class="set-group">
        <button class="set-row" data-action="export-json">${ic('file_download')}<span class="main"><span class="title" style="display:block">Back up data</span><span class="sub" style="display:block">Save a .json file you can restore later</span></span></button>
        <button class="set-row" data-action="import">${ic('file_upload')}<span class="main"><span class="title" style="display:block">Restore from backup</span><span class="sub" style="display:block">Replaces what's on this device</span></span></button>
        <button class="set-row" data-action="export-csv">${ic('table_view')}<span class="main"><span class="title" style="display:block">Export spreadsheet</span><span class="sub" style="display:block">CSV for Excel, Numbers or Sheets</span></span></button>
        ${state.tx.length ? '' : `<button class="set-row" data-action="sample">${ic('auto_awesome')}<span class="main"><span class="title" style="display:block">Load sample data</span><span class="sub" style="display:block">Try the app with 3 months of example entries</span></span></button>`}
        <button class="set-row danger" data-action="erase">${ic('delete_forever')}<span class="main"><span class="title" style="display:block">Erase all data</span><span class="sub" style="display:block;color:var(--text-2)">Entries, recurring payments and custom categories</span></span></button>
      </div></div>
      <p class="note">${ic('lock', 'inline-ic')} ${state.tx.length} entries stored privately on this device — nothing is uploaded anywhere.
        Back up now and then, especially before clearing Safari data or switching phones.<br><br>
        <b>Install on iPhone:</b> open this page in Safari, tap ${ic('ios_share', 'inline-ic')} Share, then <b>Add to Home Screen</b>.</p>`;
    return { html };
  },
};

function historyResults(p) {
  const q = (p.q || '').trim().toLowerCase();
  let list = [...state.tx].sort(sortTx);
  if (p.filter !== 'all') list = list.filter((t) => t.type === p.filter);
  if (q) {
    list = list.filter((t) => catOf(t.catId).name.toLowerCase().includes(q)
      || (t.note || '').toLowerCase().includes(q) || String(t.amount).includes(q));
  }
  if (!list.length) {
    return `<div class="card" style="margin-top:12px"><div class="empty">${ic('search')}${q ? 'No matches.' : 'No entries yet.'}</div></div>`;
  }
  const T = totals(list);
  const shown = list.slice(0, p.limit);
  return `<div class="day-head" style="margin-top:12px"><span>${list.length} ${list.length === 1 ? 'entry' : 'entries'}</span>
      <span class="num">In ${money(T.income)} · Out ${money(T.expense)}</span></div>
    ${groupedTx(shown)}
    ${list.length > shown.length ? `<button class="btn soft block" style="margin-top:14px" data-action="hist-more">Show more</button>` : ''}`;
}

function trendChart(period, endKey, per, selKey) {
  const ms = Array.from({ length: 6 }, (_, i) => periodStep(period, endKey, i - 5));
  const vals = ms.map((m) => per.get(m) || { income: 0, expense: 0 });
  const label = (k) => (period === 'week' ? dayMonth(k) : period === 'month' ? monthShort(k) : k);
  const max = Math.max(1, ...vals.flatMap((v) => [v.income, v.expense]));
  const W = 320, H = 150, T = 6, B = 22, ch = H - T - B, cw = W / 6, bw = 13;
  let s = `<line class="grid" x1="0" x2="${W}" y1="${T + ch + 0.5}" y2="${T + ch + 0.5}"/>`;
  ms.forEach((m, i) => {
    const cx = i * cw + cw / 2;
    const hi = (vals[i].income / max) * ch, he = (vals[i].expense / max) * ch;
    const bar = (x, h, col) => (h > 0
      ? `<rect x="${x.toFixed(1)}" y="${(T + ch - Math.max(h, 2)).toFixed(1)}" width="${bw}" height="${Math.max(h, 2).toFixed(1)}" rx="3.5" style="fill:${col}"/>` : '');
    s += `<g class="col" data-action="stats-goto" data-key="${m}">
      <rect x="${i * cw}" y="0" width="${cw}" height="${H}" fill="transparent"/>
      ${bar(cx - bw - 1.5, hi, 'var(--income)')}${bar(cx + 1.5, he, 'var(--expense)')}
      <text x="${cx}" y="${H - 5}" text-anchor="middle" class="${m === selKey ? 'on' : ''}">${label(m)}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses over the last six ${period === 'all' ? 'year' : period}s">${s}</svg>`;
}

/* ═════════════ Rendering & navigation ═════════════ */
function render(dir) {
  const p = top();
  const { html } = VIEWS[p.name](p);
  viewEl.innerHTML = html;
  dockEl.innerHTML = mainDock(p);
  viewEl.classList.remove('anim-push', 'anim-pop');
  if (dir) {
    void viewEl.offsetWidth;
    viewEl.classList.add('anim-' + dir);
  }
  if (dir === 'push') window.scrollTo(0, 0);
  else if (dir === 'pop') window.scrollTo(0, p.scroll || 0);
}

/** Bottom bar shown on every screen: Income · Today/Home · Expenses */
function mainDock(p) {
  const onHome = p.name === 'home';
  const isToday = ui.date === todayKey();
  // On a category page, the matching button pre-selects that category.
  const catType = p.name === 'cat' && p.catId ? catOf(p.catId).type : null;
  const catAttr = (t) => (catType === t ? ` data-cat="${p.catId}"` : '');
  const mid = onHome
    ? `<button class="today-btn ${isToday ? '' : 'away'}" data-action="today" aria-label="${isToday ? 'Today' : 'Back to today'}">${ic('today')}<span>Today</span></button>`
    : `<button class="today-btn" data-action="home" aria-label="Go to home">${ic('home')}<span>Home</span></button>`;
  return `<div class="dock-inner">
    <button class="btn ink flex" data-action="add" data-type="income"${catAttr('income')}>${ic('add')}Income</button>
    ${mid}
    <button class="btn accent flex" data-action="add" data-type="expense"${catAttr('expense')}>${ic('remove')}Expenses</button></div>`;
}

function go(name, params = {}) {
  top().scroll = window.scrollY;
  ui.stack.push({ name, ...params });
  history.pushState({ depth: ui.stack.length }, '');
  render('push');
}

window.addEventListener('popstate', () => {
  while (overlays.length) overlays[overlays.length - 1].close();
  const depth = Math.max(1, history.state?.depth || 1);
  if (ui.stack.length > depth) {
    ui.stack.length = depth;
    render('pop');
  }
});

/* ═════════════ Actions (delegated) ═════════════ */
const actions = {
  menu: openMenu,
  back: () => history.back(),
  day: (el) => { ui.date = addDays(ui.date, Number(el.dataset.n)); render(); },
  home: () => {
    ui.date = todayKey();
    if (ui.stack.length > 1) history.go(-(ui.stack.length - 1));
  },
  today: () => { ui.date = todayKey(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'home-type': (el) => { ui.homeType = el.dataset.v; render(); },
  'toggle-cats': () => { ui.allCats = !ui.allCats; render(); },
  'home-period': (el) => {
    if (el.dataset.v === 'custom') {
      openRangeDialog(ui.custom, (k) => { ui.period = 'custom'; ui.custom = k; render(); });
      return;
    }
    ui.period = el.dataset.v;
    render();
  },
  stats: (el) => go('stats', { period: el.dataset.period, key: el.dataset.key, type: ui.homeType }),
  add: (el) => openTxSheet({ type: el.dataset.type, catId: el.dataset.cat }),
  'edit-tx': (el) => {
    const t = state.tx.find((x) => x.id === el.dataset.id);
    if (t) openTxSheet({ tx: t });
  },
  'open-cat': (el) => go('cat', { catId: el.dataset.cat || null, period: el.dataset.period, key: el.dataset.key }),
  'stats-type': (el) => { top().type = el.dataset.v; render(); },
  'stats-period': (el) => {
    const p = top();
    if (el.dataset.v === 'custom') {
      openRangeDialog(p.period === 'custom' ? p.key : ui.custom, (k) => {
        p.period = 'custom'; p.key = k; ui.period = 'custom'; ui.custom = k; render();
      });
      return;
    }
    switchPeriod(p, el.dataset.v);
    ui.period = el.dataset.v;
    render();
  },
  'stats-step': (el) => { const p = top(); p.key = periodStep(p.period, p.key, Number(el.dataset.n)); render(); },
  'stats-goto': (el) => {
    const p = top();
    // "By year" / custom-range rows and bars drill into that year or month
    if (p.period === 'all') p.period = 'year';
    else if (p.period === 'custom') p.period = 'month';
    p.key = el.dataset.key;
    render();
    if (el.dataset.scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'cat-period': (el) => {
    const p = top();
    if (el.dataset.v === 'custom') {
      openRangeDialog(p.period === 'custom' ? p.key : ui.custom, (k) => { p.period = 'custom'; p.key = k; render(); });
      return;
    }
    switchPeriod(p, el.dataset.v);
    render();
  },
  'cat-step': (el) => { const p = top(); p.key = periodStep(p.period, p.key, Number(el.dataset.n)); render(); },
  'hist-filter': (el) => { top().filter = el.dataset.v; top().limit = 300; render(); },
  'hist-more': () => { top().limit += 300; $('#hist-results').innerHTML = historyResults(top()); },
  'cats-type': (el) => { top().type = el.dataset.v; render(); },
  'edit-rec': (el) => { const r = state.recurring.find((x) => x.id === el.dataset.id); if (r) openTxSheet({ rec: r }); },
  'new-rec': () => openTxSheet({ rec: 'new', type: 'expense' }),
  'edit-cat': (el) => { const c = catById(el.dataset.id); if (c) openCatDialog({ cat: c }); },
  'new-cat': (el) => openCatDialog({ type: el.dataset.type }),
  'set-cur': (el) => { state.currency = el.dataset.v; persist(); render(); },
  'set-fmt': (el) => { state.numberFormat = el.dataset.v; persist(); render(); },
  'set-theme': (el) => { state.theme = el.dataset.v; persist(); applyTheme(); render(); },
  'export-json': exportJson,
  'export-csv': exportCsv,
  import: () => $('#import-file').click(),
  sample: () => {
    state.tx.push(...S.sampleTransactions());
    persist();
    render();
    toast('Sample data added');
  },
  erase: async () => {
    const ok = await confirmDialog({
      title: 'Erase all data?',
      message: `This permanently removes ${state.tx.length} entries and ${state.recurring.length} recurring payments, and resets your categories. Your currency and theme are kept. Consider backing up first.`,
      confirm: 'Erase', danger: true,
    });
    if (!ok) return;
    const { currency, numberFormat, theme } = state;
    state = { ...S.fresh(), currency, numberFormat, theme }; // keep preferences
    persist();
    render();
    toast('All data erased');
  },
};

/** Change a view's period, landing on the new period that contains today (if the
 *  current selection covers today) or else the start of the current selection. */
function switchPeriod(p, period) {
  const [a, b] = periodRange(p.period, p.key);
  const t = todayKey();
  const anchor = p.period === 'all' || (t >= a && t <= b) ? t : a;
  p.period = period;
  p.key = periodOf(period, anchor);
}

function onAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el, e);
}
viewEl.addEventListener('click', onAction);
dockEl.addEventListener('click', onAction);

viewEl.addEventListener('click', (e) => {
  if (e.target.classList?.contains('date-input')) { try { e.target.showPicker(); } catch { /* not supported */ } }
});

viewEl.addEventListener('change', (e) => {
  const k = e.target.dataset.input;
  if (k === 'home-date' && e.target.value) { ui.date = e.target.value; render(); }
  if (k === 'cur-custom') {
    const v = e.target.value.trim();
    if (v) { state.currency = v; persist(); render(); }
  }
});

viewEl.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'history-q') {
    top().q = e.target.value;
    top().limit = 300;
    $('#hist-results').innerHTML = historyResults(top());
  }
});

viewEl.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('[data-drag]');
  if (h) startDrag(e, h);
});

/* Drag to reorder categories */
function startDrag(e, handle) {
  const row = handle.closest('.cat-row');
  const list = row.parentElement;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  row.classList.add('dragging');
  let lastY = e.clientY, offset = 0;
  const move = (ev) => {
    offset += ev.clientY - lastY;
    lastY = ev.clientY;
    row.style.transform = `translateY(${offset}px)`;
    const r = row.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const next = row.nextElementSibling, prev = row.previousElementSibling;
    if (next && mid > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      list.insertBefore(next, row);
      offset -= next.offsetHeight;
      row.style.transform = `translateY(${offset}px)`;
    } else if (prev && mid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      list.insertBefore(row, prev);
      offset += prev.offsetHeight;
      row.style.transform = `translateY(${offset}px)`;
    }
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    row.classList.remove('dragging');
    row.style.transform = '';
    [...list.querySelectorAll('.cat-row')].forEach((r, i) => { const c = catById(r.dataset.id); if (c) c.order = i; });
    persist();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* ═════════════ Overlays ═════════════ */
const overlays = [];

function openOverlay(kind, html, { onClose, isDirty } = {}) {
  const el = document.createElement('div');
  el.className = `ov ov-${kind}`;
  el.innerHTML = `<div class="ov-backdrop"></div><div class="ov-panel ${kind}" role="dialog" aria-modal="true">${html}</div>`;
  ovRoot.append(el);
  document.body.classList.add('locked');
  const panel = el.querySelector('.ov-panel');
  const o = {
    el, panel, closed: false,
    close() {
      if (o.closed) return;
      o.closed = true;
      overlays.splice(overlays.indexOf(o), 1);
      if (el.contains(document.activeElement)) document.activeElement.blur();
      el.classList.remove('open');
      const done = () => el.remove();
      panel.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400);
      if (!overlays.length) document.body.classList.remove('locked');
      onClose?.();
    },
    /** Close, but ask first if the user has typed something. */
    async requestClose() {
      if (o.closed) return;
      if (isDirty?.()) {
        const ok = await confirmDialog({ title: 'Discard changes?', message: "What you've entered won't be saved.", confirm: 'Discard', danger: true });
        if (!ok) return;
      }
      o.close();
    },
  };
  el.querySelector('.ov-backdrop').addEventListener('click', () => o.requestClose());
  overlays.push(o);
  el.getBoundingClientRect(); // flush styles so the open transition runs
  el.classList.add('open');
  return o;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlays.length) overlays[overlays.length - 1].requestClose();
});

function enableSheetDrag(o) {
  const zone = o.panel.querySelector('.grab-zone');
  let y0 = null, dy = 0;
  zone.addEventListener('pointerdown', (e) => {
    y0 = e.clientY; dy = 0;
    zone.setPointerCapture(e.pointerId);
    o.panel.style.transition = 'none';
  });
  zone.addEventListener('pointermove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    o.panel.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    o.panel.style.transition = '';
    o.panel.style.transform = '';
    if (dy > 90) o.requestClose();
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

function openMenu() {
  const items = [
    ['stats', 'bar_chart', 'Statistics'],
    ['history', 'history', 'All transactions'],
    ['recurring', 'autorenew', 'Recurring payments'],
    ['categories', 'category', 'Categories'],
    ['settings', 'settings', 'Settings'],
  ];
  const o = openOverlay('menu', items.map(([k, i, l]) => `<button data-go="${k}">${ic(i)}${l}</button>`).join(''));
  o.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    o.close();
    const k = b.dataset.go;
    if (k === 'stats') go('stats', { period: ui.period, key: ui.period === 'custom' ? ui.custom : periodOf(ui.period, ui.date), type: ui.homeType });
    else if (k === 'history') go('history', { q: '', filter: 'all', limit: 300 });
    else if (k === 'categories') go('categories', { type: 'expense' });
    else if (k === 'recurring') go('recurring');
    else go('settings');
  });
}

function confirmDialog({ title, message = '', confirm = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const o = openOverlay('dialog', `
      <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">${esc(title)}</h2>
      ${message ? `<p>${esc(message)}</p>` : ''}
      <div class="dlg-actions"><button class="text-btn" data-r="0">Cancel</button>
        <button class="text-btn ${danger ? 'danger' : 'accent'}" data-r="1">${esc(confirm)}</button></div>`,
    { onClose: () => resolve(result) });
    o.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      result = b.dataset.r === '1';
      o.close();
    });
  });
}

/* ─────────── Custom date range dialog ─────────── */
function openRangeDialog(current, onApply) {
  const t = todayKey();
  const y = Number(t.slice(0, 4));
  const [from0, to0] = current ? current.split('_') : [addDays(t, -29), t];
  const presets = [
    ['Last 7 days', addDays(t, -6), t],
    ['Last 30 days', addDays(t, -29), t],
    ['Last 90 days', addDays(t, -89), t],
    ['Year to date', `${y}-01-01`, t],
    [`${y - 1}`, `${y - 1}-01-01`, `${y - 1}-12-31`],
  ];
  const o = openOverlay('dialog', `
    <div class="dlg-head"><span class="chip lg" style="--c:var(--accent)">${ic('date_range')}</span>
      <div><h2>Custom range</h2><div class="sub">Pick any start and end date</div></div></div>
    <div class="presets">${presets.map(([l, a, b], i) => `<button data-preset="${i}">${l}</button>`).join('')}</div>
    <div class="range-fields">
      <label class="date-field"><span>From</span><input type="date" class="from" value="${from0}"></label>
      <label class="date-field"><span>To</span><input type="date" class="to" value="${to0}"></label>
    </div>
    <div class="range-summary muted"></div>
    <div class="dlg-actions"><button class="text-btn" data-act="cancel">Cancel</button>
      <button class="text-btn accent" data-act="apply">Apply</button></div>`);
  const p = o.panel;
  const fromIn = $('.from', p), toIn = $('.to', p), summary = $('.range-summary', p);
  const update = () => {
    const ok = fromIn.value && toIn.value;
    $('[data-act=apply]', p).disabled = !ok;
    if (!ok) { summary.textContent = 'Choose both dates'; return; }
    const [a, b] = customKey(fromIn.value, toIn.value).split('_');
    const n = daysBetween(a, b) + 1;
    summary.textContent = `${rangeLabel(a, b)} · ${n} ${n === 1 ? 'day' : 'days'}${fromIn.value > toIn.value ? ' (dates swapped)' : ''}`;
  };
  const apply = (a, b) => { o.close(); onApply(customKey(a, b)); };
  [fromIn, toIn].forEach((el) => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
    el.addEventListener('click', () => { try { el.showPicker(); } catch { /* ignore */ } });
  });
  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.preset) { const [, a, z] = presets[Number(b.dataset.preset)]; apply(a, z); }
    if (b.dataset.act === 'cancel') o.close();
    if (b.dataset.act === 'apply' && fromIn.value && toIn.value) apply(fromIn.value, toIn.value);
  });
  update();
}

let toastTimer;
function toast(msg, { action, onAction: cb } = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); cb(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2400);
}

/* ─────────── Add / edit sheet (entries and recurring payments) ───────────
   openTxSheet({ type })            → add an entry
   openTxSheet({ tx })              → edit an entry
   openTxSheet({ rec: 'new' })      → add a recurring payment
   openTxSheet({ rec: item })       → edit a recurring payment */
function openTxSheet({ type = 'expense', tx = null, catId = null, rec = null } = {}) {
  const isRec = !!rec;
  const recItem = rec && rec !== 'new' ? rec : null;
  const src = tx || recItem;
  const editing = !!src;
  const fmtAmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const d = {
    type: src?.type || type,
    amount: src ? fmtAmt(src.amount) : '',
    catId: src?.catId || catId || null,
    date: tx?.date || recItem?.start || (isRec ? todayKey() : ui.date),
    note: src?.note || '',
    repeat: false,
  };
  const start = JSON.stringify(d);
  const linkedRec = tx?.recurringId ? state.recurring.find((r) => r.id === tx.recurringId) : null;

  const o = openOverlay('sheet', `
    <div class="sheet-top">
      <div class="grab-zone"><div class="grabber"></div></div>
      <div class="sheet-head">
        <h2 class="sheet-title"></h2>
        <button class="icon-btn ghost sheet-close" data-act="close" aria-label="Close">${ic('close')}</button>
      </div>
    </div>
    <div class="sheet-sub">
      <label class="date-chip">${ic(isRec ? 'autorenew' : 'calendar_today')}<span class="dl"></span>${ic('expand_more')}
        <input type="date" class="date-input" value="${d.date}" aria-label="${isRec ? 'First payment date' : 'Change date'}"></label>
      <div class="seg type-seg" role="radiogroup" aria-label="Entry type">
        <button data-type="expense" role="radio">Expense</button><button data-type="income" role="radio">Income</button></div>
    </div>
    <div class="rec-hint"></div>
    <label class="amount-box"><span class="cur">${esc(state.currency)}</span>
      <input class="amt num" type="text" inputmode="decimal" placeholder="0.00" value="${esc(d.amount)}" autocomplete="off" enterkeyhint="done" aria-label="Amount"></label>
    <div class="field-label">Category</div>
    <div class="cat-grid"></div>
    <div class="note-box">${ic('notes')}<input class="note-in" placeholder="${isRec ? 'Name, e.g. Rent or Car insurance' : 'Add a note (optional)'}" maxlength="80" value="${esc(d.note)}" enterkeyhint="done" aria-label="${isRec ? 'Name' : 'Note'}"></div>
    ${!isRec && !editing ? `<label class="switch-row">${ic('autorenew')}<span class="main"><span class="title">Repeat every month</span><span class="sub">Add this automatically on the same day each month</span></span>
      <input type="checkbox" class="repeat" role="switch"><i class="switch" aria-hidden="true"></i></label>` : ''}
    ${linkedRec ? `<button class="rec-link" data-act="manage-rec">${ic('autorenew')}<span>Added automatically by <b>${esc(recName(linkedRec))}</b> · Manage</span>${ic('chevron_right')}</button>` : ''}
    <button class="btn block" data-act="save"></button>
    ${recItem ? `<div class="sheet-actions">
        <button class="text-btn" data-act="pause">${ic(recItem.paused ? 'play_circle' : 'pause_circle')}${recItem.paused ? 'Resume' : 'Pause'}</button>
        <button class="text-btn danger" data-act="delete">${ic('delete')}Delete</button></div>`
      : editing ? `<button class="text-btn danger sheet-delete" data-act="delete">${ic('delete')}Delete entry</button>` : ''}`,
  { isDirty: () => JSON.stringify(d) !== start });
  const p = o.panel;
  enableSheetDrag(o);

  const grid = $('.cat-grid', p);
  const saveBtn = $('[data-act=save]', p);
  const amt = $('.amt', p);
  const dateChip = $('.date-chip', p);
  const hint = $('.rec-hint', p);

  const catOk = () => catById(d.catId)?.type === d.type;
  const valid = () => parseAmount(d.amount) > 0 && catOk();
  const day = () => Number(d.date.slice(8));

  const renderGrid = () => {
    grid.innerHTML = cats(d.type).map((c) => `
      <button class="cat-cell ${c.id === d.catId ? 'on' : ''}" data-cat="${c.id}" aria-pressed="${c.id === d.catId}">${chip(c)}<span>${esc(c.name)}</span></button>`).join('')
      + `<button class="cat-cell" data-new><span class="chip outline">${ic('add')}</span><span>New</span></button>`;
  };
  const renderDate = () => {
    const t = todayKey();
    const short = d.date === t ? 'Today' : d.date === addDays(t, -1) ? 'Yesterday' : shortDay(d.date);
    $('.dl', p).textContent = isRec ? `Monthly from ${short}` : short;
    dateChip.setAttribute('aria-label', `${isRec ? 'First payment' : 'Date'}: ${dayLabel(d.date)}. Tap to change`);
    dateChip.classList.toggle('not-today', !isRec && d.date !== t);
    // Plain-language explanation of what will happen
    let h = '';
    const r = { day: day() };
    if (isRec && !editing) {
      // How many past payments will be filled in straight away
      const past = [];
      for (let mk = monthOf(d.date); past.length < 600; mk = addMonths(mk, 1)) {
        const due = dueDate(r, mk);
        if (due > t) break;
        if (due >= d.date) past.push(due);
      }
      const now = past.length === 0 ? ` First one on ${shortDay(d.date)}.`
        : past.length === 1 ? ` The ${shortDay(past[0])} payment is added now.`
          : ` ${past.length} past payments (${dayMonth(past[0])} – ${dayMonth(past[past.length - 1])}) are added now.`;
      h = `Added automatically on ${recDayText(r)} of every month.${now}`;
    } else if (isRec) {
      h = recItem.paused ? 'Paused — nothing is being added.' : `Added on ${recDayText(r)} of every month. Changes apply to future entries only.`;
    } else if (d.repeat) {
      h = `Also adds automatically on ${recDayText(r)} of every month.`;
    }
    hint.textContent = h;
    hint.hidden = !h;
  };
  const renderType = () => {
    const noun = d.type === 'expense' ? 'expense' : 'income';
    $('.sheet-title', p).textContent = isRec ? `${editing ? 'Edit' : 'New'} recurring ${noun}` : `${editing ? 'Edit' : 'Add'} ${noun}`;
    p.querySelectorAll('[data-type]').forEach((b) => {
      b.classList.toggle('on', b.dataset.type === d.type);
      b.setAttribute('aria-checked', String(b.dataset.type === d.type));
    });
    $('.amount-box', p).classList.toggle('income', d.type === 'income');
    saveBtn.classList.toggle('ink', d.type === 'income');
    saveBtn.classList.toggle('accent', d.type === 'expense');
    renderGrid();
  };
  const sync = () => {
    const hasAmt = parseAmount(d.amount) > 0;
    saveBtn.disabled = !valid();
    saveBtn.textContent = !hasAmt ? 'Enter an amount' : !catOk() ? 'Choose a category' : editing ? 'Save changes' : isRec ? 'Save recurring payment' : 'Save';
  };
  renderType();
  renderDate();
  sync();

  amt.addEventListener('input', () => {
    const clean = sanitizeAmount(amt.value);
    if (clean !== amt.value) amt.value = clean;
    d.amount = clean;
    sync();
  });
  amt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (valid()) save(); else amt.blur(); } });
  const noteIn = $('.note-in', p);
  noteIn.addEventListener('input', () => { d.note = noteIn.value; });
  noteIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (valid()) save(); else noteIn.blur(); } });
  $('.repeat', p)?.addEventListener('change', (e) => { d.repeat = e.target.checked; renderDate(); });

  const dateIn = $('.date-input', p);
  dateIn.addEventListener('click', () => { try { dateIn.showPicker(); } catch { /* ignore */ } });
  dateIn.addEventListener('change', () => {
    if (!dateIn.value) return;
    d.date = dateIn.value;
    renderDate();
  });

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-new')) {
      openCatDialog({ type: d.type, onSaved: (c) => { d.catId = c.id; renderGrid(); sync(); } });
      return;
    }
    d.catId = b.dataset.cat;
    grid.querySelectorAll('.cat-cell').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    // Close the keypad (the iPhone decimal pad has no Done key) so Save comes into view
    if (document.activeElement === amt) amt.blur();
    sync();
    if (valid()) saveBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  p.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.type && b.dataset.type !== d.type) {
      d.type = b.dataset.type;
      if (!catOk()) d.catId = null;
      renderType();
      sync();
    }
    const act = b.dataset.act;
    if (act === 'close') o.requestClose();
    if (act === 'manage-rec') { o.close(); openTxSheet({ rec: linkedRec }); }
    if (act === 'pause') togglePause();
    if (act === 'delete') isRec ? deleteRec() : deleteTx();
  });

  function save() {
    if (!valid()) return;
    const fields = { type: d.type, amount: parseAmount(d.amount), catId: d.catId, note: d.note.trim() };
    if (isRec) return saveRec(fields);
    if (editing) {
      const before = { ...tx };
      Object.assign(tx, fields, { date: d.date });
      persist();
      o.close();
      render();
      toast('Changes saved', { action: 'Undo', onAction: () => { Object.assign(tx, before); persist(); render(); } });
      return;
    }
    const entry = { id: uid(), ...fields, date: d.date, createdAt: Date.now() };
    state.tx.push(entry);
    let newRec = null;
    if (d.repeat) {
      newRec = { id: uid(), ...fields, start: d.date, day: day(), lastPosted: monthOf(d.date), paused: false, createdAt: Date.now() };
      entry.recurringId = newRec.id;
      state.recurring.push(newRec);
    }
    const added = postRecurring(); // catches up if the first one was in an earlier month
    persist();
    o.close();
    render();
    toast(`${money(fields.amount)} ${d.type} saved${newRec ? ' · repeats monthly' : d.date !== ui.date ? ' to ' + shortDay(d.date) : ''}${added.length ? ` · ${added.length} more added up to today` : ''}`, {
      action: 'Undo',
      onAction: () => {
        state.tx = state.tx.filter((t) => t !== entry && !(newRec && t.recurringId === newRec.id));
        if (newRec) state.recurring = state.recurring.filter((r) => r !== newRec);
        persist();
        render();
      },
    });
  }

  function saveRec(fields) {
    const r = recItem || { id: uid(), lastPosted: null, paused: false, createdAt: Date.now() };
    if (recItem && recItem.start !== d.date) r.lastPosted = null; // re-check from the new start (no duplicates)
    Object.assign(r, fields, { start: d.date, day: day() });
    if (!recItem) state.recurring.push(r);
    const added = postRecurring();
    persist();
    o.close();
    render();
    const next = nextDue(r);
    toast(added.length ? `Saved · added ${added.length} ${added.length === 1 ? 'entry' : 'entries'} so far`
      : `Saved · next one on ${next ? shortDay(next) : '—'}`);
  }

  function togglePause() {
    const r = recItem;
    r.paused = !r.paused;
    if (!r.paused && r.start <= todayKey()) {
      // Resume from the next due date — don't back-fill the months it was paused.
      const cm = monthOf(todayKey());
      r.lastPosted = dueDate(r, cm) <= todayKey() ? cm : addMonths(cm, -1);
    }
    postRecurring();
    persist();
    o.close();
    render();
    toast(r.paused ? `${recName(r)} paused` : `${recName(r)} resumed · next ${shortDay(nextDue(r))}`);
  }

  async function deleteRec() {
    const ok = await confirmDialog({
      title: `Delete “${recName(recItem)}”?`,
      message: "It won't be added again. Entries already added stay in your history.",
      confirm: 'Delete', danger: true,
    });
    if (!ok) return;
    state.recurring = state.recurring.filter((r) => r !== recItem);
    persist();
    o.close();
    render();
    toast('Recurring payment deleted', {
      action: 'Undo',
      onAction: () => { state.recurring.push(recItem); persist(); render(); },
    });
  }

  function deleteTx() {
    const i = state.tx.indexOf(tx);
    if (i === -1) return;
    state.tx.splice(i, 1);
    persist();
    o.close();
    render();
    toast('Entry deleted', { action: 'Undo', onAction: () => { state.tx.push(tx); persist(); render(); } });
  }
  saveBtn.addEventListener('click', save);

  if (!editing) amt.focus(); // synchronous, so iOS opens the keypad
}

/* ─────────── New / edit category dialog ─────────── */
function openCatDialog({ cat = null, type = 'expense', onSaved } = {}) {
  const editing = !!cat;
  type = cat?.type || type;
  const used = new Set(cats(type).map((c) => c.color));
  const d = {
    name: cat?.name || '',
    icon: cat?.icon || 'shopping_cart',
    emoji: cat?.emoji || null,
    color: cat?.color || S.PALETTE.find((c) => !used.has(c)) || S.PALETTE[0],
    mode: cat?.emoji ? 'emoji' : 'icons',
  };
  const o = openOverlay('dialog', `
    <div class="dlg-head"><span class="pv"></span>
      <div><h2>${editing ? 'Edit category' : 'New category'}</h2><div class="sub">${type === 'expense' ? 'Expense' : 'Income'}</div></div></div>
    <label class="float-field"><input class="name" placeholder=" " maxlength="24" value="${esc(d.name)}" autocomplete="off" enterkeyhint="done"><span>Name</span></label>
    <div class="field-error"></div>
    <div class="tabs" style="--n:2;margin-top:8px"><button data-mode="icons">Icons</button><button data-mode="emoji">Emoji</button><span class="ink"></span></div>
    <div class="picker"></div>
    <div class="field-label" style="margin-top:10px">Colour</div>
    <div class="swatches">${S.PALETTE.map((c) => `<button class="swatch ${isInk(c) ? 'ink' : ''}" style="--c:${colorVar(c)}" data-color="${c}" aria-label="Colour ${c}">${ic('check')}</button>`).join('')}</div>
    <div class="dlg-actions">
      ${editing ? '<button class="text-btn danger" data-act="delete">Delete</button><span class="spacer"></span>' : ''}
      <button class="text-btn" data-act="cancel">Cancel</button>
      <button class="text-btn accent" data-act="save">Save</button></div>`,
  { isDirty: () => d.name.trim() !== (cat?.name || '') });
  const p = o.panel;
  const picker = $('.picker', p);
  const nameIn = $('.name', p);
  const err = $('.field-error', p);

  const effEmoji = () => (d.mode === 'emoji' && d.emoji ? d.emoji : null);
  const preview = () => { $('.pv', p).innerHTML = chip({ ...d, emoji: effEmoji() }, 'lg'); };
  const paintSel = () => {
    picker.style.setProperty('--sel', colorVar(d.color));
    picker.style.setProperty('--sel-fg', isInk(d.color) ? 'var(--on-ink)' : '#fff');
  };
  const renderPicker = () => {
    p.querySelectorAll('[data-mode]').forEach((b, i) => {
      b.classList.toggle('on', b.dataset.mode === d.mode);
      if (b.dataset.mode === d.mode) $('.tabs', p).style.setProperty('--i', i);
    });
    if (d.mode === 'icons') {
      picker.innerHTML = `<div class="icon-grid">${CAT_ICONS.map((n) =>
        `<button class="${n === d.icon ? 'on' : ''}" data-icon="${n}" aria-label="${n.replace(/_/g, ' ')}">${ic(n)}</button>`).join('')}</div>`;
    } else {
      picker.innerHTML = `<input class="emoji-input" placeholder="Or type / paste any emoji" aria-label="Custom emoji">
        <div class="icon-grid emoji">${EMOJIS.map((em) => `<button class="${em === d.emoji ? 'on' : ''}" data-emoji="${em}">${em}</button>`).join('')}</div>`;
      $('.emoji-input', picker).addEventListener('input', (e) => {
        const v = e.target.value.trim();
        if (!v) return;
        const first = typeof Intl.Segmenter === 'function'
          ? [...new Intl.Segmenter().segment(v)][0]?.segment : Array.from(v)[0];
        d.emoji = first;
        picker.querySelectorAll('[data-emoji]').forEach((b) => b.classList.remove('on'));
        preview();
      });
    }
    paintSel();
    preview();
  };
  const paintSwatches = () => p.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === d.color));

  renderPicker();
  paintSwatches();
  const selected = picker.querySelector('.on');
  if (selected) selected.scrollIntoView({ block: 'nearest' });

  p.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) { d.mode = b.dataset.mode; renderPicker(); return; }
    if (b.dataset.icon) {
      d.icon = b.dataset.icon;
      picker.querySelectorAll('[data-icon]').forEach((x) => x.classList.toggle('on', x === b));
      preview();
      return;
    }
    if (b.dataset.emoji) {
      d.emoji = b.dataset.emoji;
      picker.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b));
      preview();
      return;
    }
    if (b.dataset.color) { d.color = b.dataset.color; paintSwatches(); paintSel(); preview(); return; }
    const act = b.dataset.act;
    if (act === 'cancel') o.requestClose();
    if (act === 'save') save();
    if (act === 'delete') {
      const n = state.tx.filter((t) => t.catId === cat.id).length;
      const ok = await confirmDialog({
        title: `Delete “${cat.name}”?`,
        message: [
          n ? `${n} ${n === 1 ? 'entry uses' : 'entries use'} this category. They'll be kept and shown as “Uncategorised”.` : 'This category has no entries.',
          (() => {
            const rn = state.recurring.filter((r) => r.catId === cat.id).length;
            return rn ? `${rn} recurring ${rn === 1 ? 'payment uses' : 'payments use'} it and will keep running as “Uncategorised” — you can pick a new category for ${rn === 1 ? 'it' : 'them'} under Recurring payments.` : '';
          })(),
        ].filter(Boolean).join(' '),
        confirm: 'Delete', danger: true,
      });
      if (!ok) return;
      state.categories = state.categories.filter((c) => c !== cat);
      persist();
      o.close();
      render();
      toast('Category deleted');
    }
  });
  nameIn.addEventListener('input', () => { d.name = nameIn.value; err.textContent = ''; });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameIn.blur(); });

  function save() {
    const name = d.name.trim();
    if (!name) { err.textContent = 'Give it a name'; nameIn.focus(); return; }
    const dup = state.categories.some((c) => c !== cat && c.type === type && c.name.toLowerCase() === name.toLowerCase());
    if (dup) { err.textContent = 'You already have a category with that name'; nameIn.focus(); return; }
    const fields = { name, icon: d.icon, emoji: effEmoji(), color: d.color };
    let saved = cat;
    if (editing) Object.assign(cat, fields);
    else {
      const order = Math.max(-1, ...state.categories.map((c) => c.order)) + 1;
      saved = { id: uid(), type, order, ...fields };
      state.categories.push(saved);
    }
    persist();
    o.close();
    render();
    onSaved?.(saved);
  }

  if (!editing) nameIn.focus();
}

/* ═════════════ Import / export ═════════════ */
async function deliverFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportJson() {
  deliverFile(`spendly-backup-${todayKey()}.json`, JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1), 'application/json');
}

function exportCsv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Type', 'Category', 'Amount', 'Note']];
  for (const t of [...state.tx].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([t.date, t.type, catOf(t.catId).name, t.amount, t.note || '']);
  }
  deliverFile(`spendly-${todayKey()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv');
}

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const next = S.parseBackup(await file.text());
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: `It has ${next.tx.length} entries and ${next.categories.length} categories. Everything currently on this device will be replaced.`,
      confirm: 'Restore',
    });
    if (!ok) return;
    state = next;
    const added = postRecurring(); // fill in anything that came due since the backup was made
    persist();
    applyTheme();
    render();
    toast(`Backup restored${added.length ? ` · ${added.length} recurring ${added.length === 1 ? 'entry' : 'entries'} brought up to date` : ''}`);
  } catch (err) {
    toast(err.message || 'Could not read that file');
  }
});

/* ═════════════ Theme, keyboard, boot ═════════════ */
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.theme;
  const dark = state.theme === 'dark' || (state.theme === 'system' && darkMq.matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media');
    m.setAttribute('content', dark ? '#121110' : '#F5F1EA');
  });
}
darkMq.addEventListener?.('change', applyTheme);

// Keep sheets/dialogs above the on-screen keyboard (iOS doesn't resize the layout viewport).
if (window.visualViewport) {
  const vv = window.visualViewport;
  const update = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', (kb > 60 ? kb : 0) + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
}

// Installed iPhone apps have no browser back gesture, so swipe in from the left edge to go back.
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  let sx = null, sy = 0;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    sx = ui.stack.length > 1 && !overlays.length && t.clientX < 24 ? t.clientX : null;
    sy = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const t = e.changedTouches[0];
    if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60) history.back();
    sx = null;
  }, { passive: true });
}

// If the app stays open past midnight, roll "today" forward when it comes back.
// Also adds any recurring entries that have come due.
let lastToday = todayKey();
function refreshForNow() {
  const added = postRecurring();
  const t = todayKey();
  const newDay = t !== lastToday;
  if (newDay) {
    if (ui.date === lastToday) ui.date = t;
    lastToday = t;
  }
  if ((added.length || newDay) && !overlays.length) render();
  announceAdded(added);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshForNow(); });
// Covers the app being left open on screen past midnight.
setInterval(() => { if (document.visibilityState === 'visible' && todayKey() !== lastToday) refreshForNow(); }, 60_000);

history.replaceState({ depth: 1 }, '');
applyTheme();
const bootAdded = postRecurring();
render();
announceAdded(bootAdded);
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
