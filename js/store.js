// Persistence. Everything lives in localStorage on this device only.
import { uid, todayKey, addDays, toKey } from './util.js';

const KEY = 'spendly.v1';
const OLD_KEY = 'coinpie.v1'; // the app's earlier name — read once, then saved under KEY

export const PALETTE = [
  '#FF5A1F', '#FF8A4C', '#C2410C', '#141414', '#4A4743', '#6B6459', '#E5484D', '#F2B705',
  '#1FA67A', '#10A5C0', '#2F7FE8', '#7C5CFF', '#D946A8', '#9A4A26',
];

const DEFAULT_CATEGORIES = [
  // expense
  ['food', 'expense', 'Food', 'restaurant', '#FF5A1F'],
  ['transport', 'expense', 'Transport', 'directions_bus', '#2F7FE8'],
  ['rent', 'expense', 'Rent', 'home', '#141414'],
  ['bills', 'expense', 'Bills', 'receipt_long', '#F2B705'],
  ['shopping', 'expense', 'Shopping', 'shopping_bag', '#E5484D'],
  ['health', 'expense', 'Health', 'medical_services', '#1FA67A'],
  ['mobile', 'expense', 'Mobile & Net', 'wifi', '#10A5C0'],
  ['family', 'expense', 'Family', 'family_restroom', '#9A4A26'],
  ['fun', 'expense', 'Fun', 'movie', '#FF8A4C'],
  ['education', 'expense', 'Education', 'school', '#6B6459'],
  ['coffee', 'expense', 'Coffee', null, '#FF8A4C', '☕'],
  // income
  ['salary', 'income', 'Salary', 'payments', '#1FA67A'],
  ['freelance', 'income', 'Freelance', 'laptop', '#2F7FE8'],
  ['business', 'income', 'Business', 'storefront', '#7C5CFF'],
  ['gifts', 'income', 'Gifts', 'card_giftcard', '#D946A8'],
  ['invest', 'income', 'Investments', 'trending_up', '#F2B705'],
  ['other_in', 'income', 'Other', 'more_horiz', '#6B6459'],
];

function defaults() {
  return {
    version: 1,
    currency: '£',
    numberFormat: 'en-US',
    theme: 'system',
    categories: DEFAULT_CATEGORIES.map(([id, type, name, icon, color, emoji], i) => ({
      id: 'c_' + id, type, name, icon: icon || 'category', emoji: emoji || null, color, order: i,
    })),
    tx: [],
    // Monthly repeating entries: { id, type, amount, catId, note, start: 'YYYY-MM-DD',
    //   day: 1-31, lastPosted: 'YYYY-MM' | null, paused: bool, createdAt }
    recurring: [],
    // Money lent / borrowed: { id, dir: 'lent'|'borrowed', person, amount, date: 'YYYY-MM-DD',
    //   due: 'YYYY-MM-DD'|null, note, repaid: [{ id, amount, date }], settled: 'YYYY-MM-DD'|null, createdAt }
    loans: [],
  };
}

function normalize(s) {
  const d = defaults();
  const out = { ...d, ...s };
  if (!Array.isArray(out.categories) || !out.categories.length) out.categories = d.categories;
  if (!Array.isArray(out.tx)) out.tx = [];
  if (!Array.isArray(out.recurring)) out.recurring = [];
  out.recurring = out.recurring.filter((r) => r && Number(r.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.start))
    .map((r) => ({ ...r, amount: Number(r.amount), day: Number(r.day) || Number(r.start.slice(8)) }));
  if (!Array.isArray(out.loans)) out.loans = [];
  out.loans = out.loans.filter((l) => l && Number(l.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(l.date))
    .map((l) => ({
      ...l,
      dir: l.dir === 'borrowed' ? 'borrowed' : 'lent',
      person: String(l.person || 'Someone'),
      amount: Number(l.amount),
      due: l.due || null,
      settled: l.settled || null,
      repaid: (Array.isArray(l.repaid) ? l.repaid : []).filter((r) => Number(r.amount) > 0).map((r) => ({ ...r, amount: Number(r.amount) })),
    }));
  out.tx = out.tx.filter((t) => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number(t.amount) > 0)
    .map((t) => ({ ...t, amount: Number(t.amount), type: t.type === 'income' ? 'income' : 'expense' }));
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Could not read saved data', e); }
  return defaults();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function fresh() { return defaults(); }

/** Validate an imported backup. Throws with a readable message. */
export function parseBackup(text) {
  let s;
  try { s = JSON.parse(text); } catch { throw new Error('That file is not a valid backup.'); }
  if (!s || !Array.isArray(s.tx) || !Array.isArray(s.categories)) throw new Error('That file is not a Spendly backup.');
  return normalize(s);
}

/** Three months of believable demo data so the charts have something to show. */
export function sampleTransactions() {
  const tx = [];
  const today = todayKey();
  const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 2) / 2; // to the nearest 50p
  const add = (date, type, catId, amount, note = '') => {
    if (date > today) return;
    tx.push({ id: uid(), type, catId: 'c_' + catId, amount, date, note, createdAt: Date.now() });
  };
  const start = new Date();
  start.setMonth(start.getMonth() - 2, 1);
  for (let k = toKey(start); k <= today; k = addDays(k, 1)) {
    const day = Number(k.slice(8));
    if (day === 1) {
      add(k, 'income', 'salary', 2800, 'Monthly salary');
      add(k, 'expense', 'rent', 950, 'Flat rent');
    }
    if (day === 5) add(k, 'expense', 'bills', rnd(110, 170), 'Energy bill');
    if (day === 7) add(k, 'expense', 'mobile', 35, 'Broadband');
    if (day === 12 || day === 24) add(k, 'income', 'freelance', rnd(200, 550), 'Client project');
    if (day === 15) add(k, 'expense', 'family', rnd(60, 150));
    if (day === 20) add(k, 'expense', 'education', 30, 'Online course');
    if (Math.random() < 0.8) add(k, 'expense', 'food', rnd(4, 18));
    if (Math.random() < 0.5) add(k, 'expense', 'transport', rnd(2.5, 12));
    if (Math.random() < 0.35) add(k, 'expense', 'coffee', rnd(2.5, 4.5));
    if (Math.random() < 0.12) add(k, 'expense', 'shopping', rnd(15, 90));
    if (Math.random() < 0.08) add(k, 'expense', 'fun', rnd(10, 45));
    if (Math.random() < 0.05) add(k, 'expense', 'health', rnd(5, 30), 'Pharmacy');
  }
  return tx;
}
