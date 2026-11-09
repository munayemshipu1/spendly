// Small date / string helpers. Dates are stored as local "YYYY-MM-DD" keys
// and months as "YYYY-MM" so nothing ever shifts across time zones.

export const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
};

export const todayKey = () => toKey(new Date());

export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

export const monthOf = (k) => k.slice(0, 7);

export const addMonths = (mk, n) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthName = (mk) => MONTHS[Number(mk.slice(5, 7)) - 1];
export const monthShort = (mk) => MONTHS_SHORT[Number(mk.slice(5, 7)) - 1];
export const monthLabel = (mk) => `${monthName(mk)} ${mk.slice(0, 4)}`;

/** "Sat, 31 Oct" (adds the year when it is not the current year) */
export const shortDay = (k) => {
  const d = fromKey(k);
  const base = `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};

/** "Today · Sat, 31 Oct", "Yesterday · Fri, 30 Oct", or just "Thu, 29 Oct" */
export const dayLabel = (k) => {
  const t = todayKey();
  if (k === t) return `Today · ${shortDay(k)}`;
  if (k === addDays(t, -1)) return `Yesterday · ${shortDay(k)}`;
  if (k === addDays(t, 1)) return `Tomorrow · ${shortDay(k)}`;
  return shortDay(k);
};

/** "Mon" */
export const weekdayShort = (k) => DOW[fromKey(k).getDay()];

export const daysInMonth = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** "9 Nov" */
export const dayMonth = (k) => {
  const d = fromKey(k);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);

/* ── Periods: 'week' | 'month' | 'year' | 'all' | 'custom' ──
   Each period instance has a key: week → its Monday "YYYY-MM-DD", month → "YYYY-MM",
   year → "YYYY", all → "all", custom → "YYYY-MM-DD_YYYY-MM-DD".
   Keys of one period sort chronologically as strings. */
export const customKey = (a, b) => (a <= b ? `${a}_${b}` : `${b}_${a}`);
export const PERIODS = [['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['all', 'All time']];

export const weekStart = (k) => {
  const d = fromKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // weeks start on Monday
  return toKey(d);
};

export const periodOf = (period, k) => {
  if (period === 'week') return weekStart(k);
  if (period === 'month') return k.slice(0, 7);
  if (period === 'year') return k.slice(0, 4);
  return 'all';
};

/** Inclusive [from, to] day keys */
export const periodRange = (period, key) => {
  if (period === 'week') return [key, addDays(key, 6)];
  if (period === 'month') return [`${key}-01`, `${key}-31`];
  if (period === 'year') return [`${key}-01-01`, `${key}-12-31`];
  if (period === 'custom') return key.split('_');
  return ['0000-01-01', '9999-12-31'];
};

export const periodStep = (period, key, n) => {
  if (period === 'week') return addDays(key, 7 * n);
  if (period === 'month') return addMonths(key, n);
  if (period === 'year') return String(Number(key) + n);
  if (period === 'custom') { // shift by the range's own length
    const [a, b] = key.split('_');
    const len = daysBetween(a, b) + 1;
    return `${addDays(a, len * n)}_${addDays(b, len * n)}`;
  }
  return key;
};

/** "3–9 Nov", "28 Oct – 3 Nov", "9 Nov", years added when not the current year */
export const rangeLabel = (a, b) => {
  const A = fromKey(a), B = fromKey(b);
  const cy = new Date().getFullYear();
  const sameYear = A.getFullYear() === B.getFullYear();
  const yr = sameYear && B.getFullYear() === cy ? '' : ` ${B.getFullYear()}`;
  if (a === b) return dayMonth(a) + yr;
  if (sameYear && A.getMonth() === B.getMonth()) return `${A.getDate()}–${B.getDate()} ${MONTHS_SHORT[B.getMonth()]}${yr}`;
  if (sameYear) return `${dayMonth(a)} – ${dayMonth(b)}${yr}`;
  return `${dayMonth(a)} ${A.getFullYear()} – ${dayMonth(b)} ${B.getFullYear()}`;
};

export const weekLabel = (key) => rangeLabel(key, addDays(key, 6));

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Keep only digits and a single decimal point, max 2 decimals. Accepts "," as decimal. */
export const sanitizeAmount = (s) => {
  let v = String(s).replace(/,/g, '.').replace(/[^\d.]/g, '');
  const i = v.indexOf('.');
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, 2);
  if (/^0\d/.test(v)) v = v.replace(/^0+(?=\d)/, '');
  return v.slice(0, 12);
};

export const parseAmount = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
