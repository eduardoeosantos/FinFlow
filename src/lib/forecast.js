import { MONTHS } from './constants';

export function computeForecast(transactions, accounts) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthlyData = {};
  transactions.forEach(tx => {
    if (tx.type === 'transfer' || tx.type === 'card_payment') return; // skip non-income/expense
    const k = tx.date.slice(0, 7);
    if (!monthlyData[k]) monthlyData[k] = { income: 0, expense: 0 };
    if (tx.type === 'income') monthlyData[k].income += tx.amount;
    else monthlyData[k].expense += Math.abs(tx.amount);
  });

  const sorted = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));
  const last3 = sorted.slice(-3);

  const avgIncome = last3.reduce((s, [, d]) => s + d.income, 0) / Math.max(last3.length, 1);
  const avgExpense = last3.reduce((s, [, d]) => s + d.expense, 0) / Math.max(last3.length, 1);
  const trend = last3.length >= 2
    ? (last3[last3.length - 1][1].expense - last3[0][1].expense) / last3.length
    : 0;

  const currentBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const forecast = [];
  let bal = currentBalance;

  for (let i = 1; i <= 12; i++) {
    const mo = (currentMonth + i) % 12;
    const yr = currentYear + Math.floor((currentMonth + i) / 12);
    const projExp = Math.max(avgExpense + trend * i, avgExpense * 0.7);
    const projInc = avgIncome;
    const net = projInc - projExp;
    bal += net;
    forecast.push({
      month: `${MONTHS[mo]}/${yr}`,
      shortMonth: MONTHS[mo],
      income: projInc,
      expense: projExp,
      net,
      balance: bal,
      savings: Math.max(net, 0),
    });
  }

  return { forecast, avgIncome, avgExpense, trend, currentBalance, monthlyData: sorted };
}
