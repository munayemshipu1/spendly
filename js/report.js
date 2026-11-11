// PDF report builder. Uses jsPDF (vendor/jspdf.umd.min.js, MIT licence), loaded only when a
// report is created so the app stays light. Everything happens on the device.

let loading = null;
/** Load jsPDF once and return its constructor. */
export function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/jspdf.umd.min.js';
    s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('PDF tool failed to start')));
    s.onerror = () => { loading = null; reject(new Error('Could not load the PDF tool. Check your connection and try again.')); };
    document.head.append(s);
  });
  return loading;
}

/** The built-in PDF fonts only cover Latin-1, so drop emoji and swap unsupported punctuation. */
export const pdfText = (s) => String(s ?? '')
  .replace(/[−–—]/g, '-')
  .replace(/…/g, '...')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[^\x00-\xFF]/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const C = {
  ink: '#141414', text2: '#6B6459', text3: '#9A9288', border: '#E6DFD4', soft: '#F5F1EA',
  accent: '#FF5A1F', income: '#17996F', expense: '#FF5A1F', danger: '#E5484D',
};

/**
 * data: {
 *   title, periodLabel, generated, money(n, {sign}),
 *   totals: { income, expense, net }, prev: { label, income, expense } | null,
 *   buckets: [{ label, income, expense }], spending: [{ name, color, value, count, pct }], earning: [...],
 *   top: [{ date, name, note, amount }], recurring: { out, in, count } | null, owed: { toYou, youOwe, overdue } | null,
 *   tx: [{ date, name, note, type, amount }]
 * }
 * Returns a jsPDF document.
 */
export function buildReport(JsPDF, data) {
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 595
  const H = doc.internal.pageSize.getHeight(); // 842
  const M = 40; // margin
  const CW = W - M * 2;
  const money = (n, o) => pdfText(data.money(n, o));
  let y = 0;

  const font = (size, style = 'normal', color = C.ink) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color); };
  const fit = (s, max) => {
    s = pdfText(s);
    if (doc.getTextWidth(s) <= max) return s;
    while (s.length > 1 && doc.getTextWidth(s + '...') > max) s = s.slice(0, -1);
    return s + '...';
  };
  const ensure = (need) => { if (y + need > H - 54) { doc.addPage(); y = 48; return true; } return false; };
  const heading = (t, sub) => {
    ensure(60);
    font(13, 'bold'); doc.text(pdfText(t), M, y);
    if (sub) { font(9, 'normal', C.text2); doc.text(pdfText(sub), W - M, y, { align: 'right' }); }
    y += 8; doc.setDrawColor(C.border); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 16;
  };

  /* ── Header band ── */
  doc.setFillColor(C.soft); doc.rect(0, 0, W, 112, 'F');
  font(22, 'bold'); doc.text('Spend', M, 48);
  const sw = doc.getTextWidth('Spend');
  doc.setTextColor(C.accent); doc.text('ly', M + sw, 48);
  font(10, 'normal', C.text2); doc.text(pdfText(data.title), W - M, 44, { align: 'right' });
  font(9, 'normal', C.text3); doc.text(`Created ${pdfText(data.generated)}`, W - M, 58, { align: 'right' });
  font(24, 'bold'); doc.text(pdfText(data.periodLabel), M, 88);
  y = 140;

  /* ── Summary boxes ── */
  const T = data.totals;
  const boxes = [
    ['Income', money(T.income), C.income],
    ['Spending', money(T.expense), C.expense],
    [T.net >= 0 ? 'Saved' : 'Overspent', money(Math.abs(T.net)), T.net >= 0 ? C.ink : C.danger],
  ];
  const bw = (CW - 24) / 3;
  boxes.forEach(([label, value, color], i) => {
    const x = M + i * (bw + 12);
    doc.setDrawColor(C.border); doc.setLineWidth(1); doc.roundedRect(x, y, bw, 62, 10, 10, 'S');
    doc.setFillColor(color); doc.circle(x + 16, y + 20, 3.5, 'F');
    font(9.5, 'normal', C.text2); doc.text(label, x + 26, y + 23);
    font(17, 'bold', color); doc.text(fit(value, bw - 28), x + 14, y + 47);
  });
  y += 84;

  // Plain-language summary
  const lines = [];
  if (!T.income && !T.expense) lines.push('No income or spending was recorded in this period.');
  else if (!T.income) lines.push(`You spent ${money(T.expense)} and recorded no income.`);
  else if (T.net >= 0) lines.push(`You saved ${money(T.net)}, which is ${Math.round((T.net / T.income) * 100)}% of your income.`);
  else lines.push(`You spent ${money(-T.net)} more than you earned.`);
  if (data.prev && (data.prev.expense > 0 || data.prev.income > 0)) {
    const ch = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
    const e = ch(T.expense, data.prev.expense);
    if (e !== null) lines.push(`Spending was ${e === 0 ? 'the same as' : `${Math.abs(e)}% ${e > 0 ? 'higher' : 'lower'} than`} ${pdfText(data.prev.label)} (${money(data.prev.expense)}).`);
    const inc = ch(T.income, data.prev.income);
    if (inc !== null && inc !== 0) lines.push(`Income was ${Math.abs(inc)}% ${inc > 0 ? 'higher' : 'lower'} than ${pdfText(data.prev.label)} (${money(data.prev.income)}).`);
  }
  font(10.5, 'normal', C.ink);
  lines.forEach((l) => { doc.text(doc.splitTextToSize(l, CW), M, y); y += 15; });
  y += 14;

  /* ── Income vs spending chart ── */
  if (data.buckets.length && (T.income || T.expense)) {
    heading('Income vs spending', data.buckets.length > 1 ? '' : '');
    const ch = 130, top = y + 10, base = top + ch;
    const max = Math.max(...data.buckets.flatMap((b) => [b.income, b.expense]), 1);
    const n = data.buckets.length;
    const colW = CW / n;
    const barW = Math.max(3, Math.min(16, colW * 0.32));
    doc.setDrawColor(C.border); doc.setLineWidth(0.6);
    doc.setLineDashPattern([2, 3], 0); doc.line(M, top, W - M, top); doc.setLineDashPattern([], 0);
    doc.line(M, base, W - M, base);
    font(8, 'normal', C.text3); doc.text(money(max), W - M, top - 4, { align: 'right' });
    const every = Math.max(1, Math.ceil((Math.max(...data.buckets.map((b) => b.label.length)) * 4.6) / (colW * 0.92)));
    data.buckets.forEach((b, i) => {
      const cx = M + i * colW + colW / 2;
      [[b.income, C.income, cx - barW - 1], [b.expense, C.expense, cx + 1]].forEach(([v, col, x]) => {
        if (v <= 0) return;
        const h = Math.max(1.5, (v / max) * ch);
        doc.setFillColor(col); doc.roundedRect(x, base - h, barW, h, Math.min(2.5, barW / 2), Math.min(2.5, barW / 2), 'F');
      });
      if (i % every === 0) { font(8, 'normal', C.text2); doc.text(pdfText(b.label), cx, base + 12, { align: 'center' }); }
    });
    // legend
    const ly = base + 28;
    doc.setFillColor(C.income); doc.circle(M + 4, ly - 3, 3, 'F'); font(9, 'normal', C.text2); doc.text('Income', M + 12, ly);
    doc.setFillColor(C.expense); doc.circle(M + 64, ly - 3, 3, 'F'); doc.text('Spending', M + 72, ly);
    y = ly + 26;
  }

  /* ── Category tables ── */
  const catTable = (title, rows, total, color) => {
    if (!rows.length) return;
    heading(title, `Total ${money(total)}`);
    rows.forEach((r) => {
      ensure(22);
      doc.setFillColor(r.color === '#141414' ? C.ink : r.color); doc.circle(M + 5, y - 3, 4, 'F');
      font(10.5, 'normal'); doc.text(fit(r.name, 150), M + 16, y);
      font(8.5, 'normal', C.text3); doc.text(`${r.count} ${r.count === 1 ? 'entry' : 'entries'}`, M + 172, y);
      const barX = M + 240, barMax = 160;
      doc.setFillColor(C.soft); doc.roundedRect(barX, y - 7, barMax, 6, 3, 3, 'F');
      const w = Math.max(2, (r.value / (rows[0].value || 1)) * barMax);
      doc.setFillColor(color); doc.roundedRect(barX, y - 7, w, 6, 3, 3, 'F');
      font(9, 'normal', C.text2); doc.text(`${r.pct}%`, barX + barMax + 30, y, { align: 'right' });
      font(10.5, 'bold'); doc.text(money(r.value), W - M, y, { align: 'right' });
      y += 20;
    });
    y += 12;
  };
  catTable('Spending by category', data.spending, T.expense, C.expense);
  catTable('Income by category', data.earning, T.income, C.income);

  /* ── Biggest expenses ── */
  if (data.top.length) {
    heading('Biggest expenses');
    data.top.forEach((t) => {
      ensure(20);
      font(9.5, 'normal', C.text2); doc.text(pdfText(t.date), M, y);
      font(10.5, 'normal'); doc.text(fit(t.note ? `${t.name} - ${t.note}` : t.name, 300), M + 90, y);
      font(10.5, 'bold'); doc.text(money(t.amount), W - M, y, { align: 'right' });
      y += 19;
    });
    y += 12;
  }

  /* ── Recurring + money owed ── */
  const extras = [];
  if (data.recurring && data.recurring.count) {
    extras.push(['Recurring payments', `${data.recurring.count} active · ${money(data.recurring.out)} out and ${money(data.recurring.in)} in each month`]);
  }
  if (data.owed && (data.owed.toYou || data.owed.youOwe)) {
    const bits = [];
    if (data.owed.toYou) bits.push(`${money(data.owed.toYou)} owed to you`);
    if (data.owed.youOwe) bits.push(`you owe ${money(data.owed.youOwe)}`);
    if (data.owed.overdue) bits.push(`${data.owed.overdue} overdue`);
    extras.push(['Money owed (today)', bits.join(' · ')]);
  }
  if (extras.length) {
    heading('Also worth knowing');
    extras.forEach(([k, v]) => {
      ensure(20);
      font(10, 'bold'); doc.text(pdfText(k), M, y);
      font(10, 'normal', C.text2); doc.text(doc.splitTextToSize(pdfText(v), CW - 150), M + 150, y);
      y += 20;
    });
    y += 12;
  }

  /* ── All transactions ── */
  if (data.tx.length) {
    heading('All transactions', `${data.tx.length} ${data.tx.length === 1 ? 'entry' : 'entries'}`);
    const head = () => {
      font(8.5, 'bold', C.text3);
      doc.text('DATE', M, y); doc.text('CATEGORY', M + 90, y); doc.text('NOTE', M + 220, y); doc.text('AMOUNT', W - M, y, { align: 'right' });
      y += 14;
    };
    head();
    data.tx.forEach((t, i) => {
      if (ensure(18)) head();
      if (i % 2 === 0) { doc.setFillColor('#FBF9F5'); doc.rect(M - 6, y - 11, CW + 12, 17, 'F'); }
      font(9.5, 'normal', C.text2); doc.text(pdfText(t.date), M, y);
      font(9.5, 'normal'); doc.text(fit(t.name, 120), M + 90, y);
      font(9.5, 'normal', C.text2); doc.text(fit(t.note || '', 200), M + 220, y);
      font(9.5, 'bold', t.type === 'income' ? C.income : C.ink);
      doc.text(money(t.type === 'income' ? t.amount : -t.amount, { sign: true }), W - M, y, { align: 'right' });
      y += 17;
    });
  }

  /* ── Footer on every page ── */
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.border); doc.setLineWidth(0.6); doc.line(M, H - 36, W - M, H - 36);
    font(8, 'normal', C.text3);
    doc.text(`Spendly - ${pdfText(data.periodLabel)} - made on your device, nothing was uploaded`, M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: 'right' });
  }
  return doc;
}
