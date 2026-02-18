import { getCatBudget } from './constants';

/**
 * FinFlow Smart Prediction Engine v1.0
 * 
 * Analyzes transaction patterns per category to predict:
 * - Monthly totals based on historical behavior
 * - Whether current month will meet budget targets
 * - Day-of-month spending distribution curves
 * 
 * Pattern types detected:
 * 1. FIXED_RECURRING: Same amount, regular interval (e.g., subscription R$100 on day 10)
 * 2. PERIODIC: Regular interval, variable amount (e.g., fuel every 9-10 days)
 * 3. BURST_TAIL: One large + many small purchases (e.g., groceries)
 * 4. SEASONAL: Varies by month significantly
 * 5. VARIABLE: No clear pattern, uses weighted average
 */

// ─── HELPERS ───

function dayOfMonth(dateStr) {
  return parseInt(dateStr.split('-')[2], 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
}

function weightedAvg(arr) {
  // More recent months get more weight
  if (!arr.length) return 0;
  const weights = arr.map((_, i) => 1 + i * 0.5); // older=1, newer=1.5, 2, 2.5...
  const totalW = weights.reduce((s, w) => s + w, 0);
  return arr.reduce((s, v, i) => s + v * weights[i], 0) / totalW;
}

// ─── PATTERN DETECTION PER CATEGORY ───

function analyzeCategory(transactions, categoryId, type = 'expense') {
  const catTxs = transactions
    .filter(tx => tx.category === categoryId && tx.type === type && tx.type !== 'transfer')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (catTxs.length < 3) {
    return { pattern: 'INSUFFICIENT', avgMonthly: 0, confidence: 0, details: {} };
  }

  // Group by month
  const byMonth = {};
  catTxs.forEach(tx => {
    const k = monthKey(tx.date);
    if (!byMonth[k]) byMonth[k] = [];
    byMonth[k].push(tx);
  });

  const monthKeys = Object.keys(byMonth).sort();
  const monthlyTotals = monthKeys.map(k => byMonth[k].reduce((s, tx) => s + Math.abs(tx.amount), 0));
  const monthlyCounts = monthKeys.map(k => byMonth[k].length);

  // Check for FIXED_RECURRING: low variance in amounts + consistent timing
  const allAmounts = catTxs.map(tx => Math.abs(tx.amount));
  const amountCV = allAmounts.length > 1 ? stdDev(allAmounts) / (allAmounts.reduce((s, v) => s + v, 0) / allAmounts.length) : 1;

  // Check timing regularity
  const days = catTxs.map(tx => dayOfMonth(tx.date));
  const dayStd = stdDev(days);

  // Pattern 1: FIXED_RECURRING — same amount, same day each month
  if (amountCV < 0.08 && dayStd < 4 && monthlyCounts.every(c => c <= 2)) {
    const avgAmount = median(allAmounts);
    const avgDay = Math.round(median(days));
    const countPerMonth = median(monthlyCounts);
    return {
      pattern: 'FIXED_RECURRING',
      avgMonthly: avgAmount * countPerMonth,
      confidence: 0.95,
      details: {
        amount: avgAmount,
        typicalDay: avgDay,
        perMonth: countPerMonth,
        description: `~${formatVal(avgAmount)} por volta do dia ${avgDay}`,
      }
    };
  }

  // Check intervals between transactions
  const intervals = [];
  for (let i = 1; i < catTxs.length; i++) {
    const d1 = new Date(catTxs[i - 1].date + 'T12:00:00');
    const d2 = new Date(catTxs[i].date + 'T12:00:00');
    intervals.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  }

  const avgInterval = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : 30;
  const intervalStd = stdDev(intervals);

  // Pattern 2: PERIODIC — regular interval (fuel every N days)
  if (intervals.length >= 3 && intervalStd / avgInterval < 0.35 && avgInterval < 25) {
    const avgAmount = weightedAvg(allAmounts.slice(-6));
    const eventsPerMonth = 30 / avgInterval;
    return {
      pattern: 'PERIODIC',
      avgMonthly: avgAmount * eventsPerMonth,
      confidence: 0.85,
      details: {
        avgInterval: Math.round(avgInterval),
        avgAmount,
        eventsPerMonth: Math.round(eventsPerMonth * 10) / 10,
        description: `~${formatVal(avgAmount)} a cada ${Math.round(avgInterval)} dias`,
      }
    };
  }

  // Pattern 3: BURST_TAIL — one large purchase + several small ones per month
  if (monthKeys.length >= 2) {
    const monthPatterns = monthKeys.map(k => {
      const txs = byMonth[k].map(tx => Math.abs(tx.amount)).sort((a, b) => b - a);
      if (txs.length < 2) return null;
      const maxRatio = txs[0] / txs.reduce((s, v) => s + v, 0);
      return { maxRatio, count: txs.length, maxVal: txs[0], tailAvg: txs.slice(1).reduce((s, v) => s + v, 0) / (txs.length - 1) };
    }).filter(Boolean);

    const avgMaxRatio = monthPatterns.reduce((s, p) => s + p.maxRatio, 0) / (monthPatterns.length || 1);
    if (avgMaxRatio > 0.35 && avgMaxRatio < 0.85 && monthPatterns.length >= 2) {
      const avgBurst = weightedAvg(monthPatterns.map(p => p.maxVal));
      const avgTail = weightedAvg(monthPatterns.map(p => p.tailAvg));
      const avgTailCount = Math.round(median(monthPatterns.map(p => p.count - 1)));
      return {
        pattern: 'BURST_TAIL',
        avgMonthly: avgBurst + avgTail * avgTailCount,
        confidence: 0.75,
        details: {
          burstAmount: avgBurst,
          tailAmount: avgTail,
          tailCount: avgTailCount,
          description: `1 compra grande (~${formatVal(avgBurst)}) + ${avgTailCount} menores (~${formatVal(avgTail)})`,
        }
      };
    }
  }

  // Pattern 4: SEASONAL — high month-to-month variance
  const totalCV = monthlyTotals.length > 2 ? stdDev(monthlyTotals) / (monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length) : 0;
  if (totalCV > 0.5 && monthKeys.length >= 4) {
    // Build seasonal profile (avg per month-of-year)
    const seasonalProfile = {};
    monthKeys.forEach((k, i) => {
      const mo = parseInt(k.split('-')[1], 10);
      if (!seasonalProfile[mo]) seasonalProfile[mo] = [];
      seasonalProfile[mo].push(monthlyTotals[i]);
    });
    return {
      pattern: 'SEASONAL',
      avgMonthly: weightedAvg(monthlyTotals.slice(-3)),
      confidence: 0.65,
      details: {
        seasonalProfile,
        description: 'Varia significativamente por mês',
      }
    };
  }

  // Pattern 5: VARIABLE — weighted average of recent months
  return {
    pattern: 'VARIABLE',
    avgMonthly: weightedAvg(monthlyTotals.slice(-4)),
    confidence: 0.7,
    details: {
      recentAvg: weightedAvg(monthlyTotals.slice(-3)),
      trend: monthlyTotals.length >= 2 ? monthlyTotals[monthlyTotals.length - 1] - monthlyTotals[monthlyTotals.length - 2] : 0,
      description: `Média ponderada dos últimos meses`,
    }
  };
}

function formatVal(v) {
  return `R$ ${Math.abs(v).toFixed(0)}`;
}

// ─── PREDICT CURRENT MONTH REMAINING ───

/**
 * Given what's already been spent this month, predict month-end total.
 * Uses day-of-month distribution curves from historical data.
 */
function predictMonthEnd(transactions, categoryId, type, year, month) {
  const catTxs = transactions.filter(tx => tx.category === categoryId && tx.type === type && tx.type !== 'transfer');
  const currentKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysTotal = daysInMonth(year, month);
  const today = new Date();
  const currentDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : daysTotal;

  // Current month spending so far
  const currentTxs = catTxs.filter(tx => monthKey(tx.date) === currentKey);
  const spentSoFar = currentTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0);

  // If month is complete, return actual
  if (currentDay >= daysTotal) return { predicted: spentSoFar, spentSoFar, remaining: 0, confidence: 1.0 };

  // Build day-of-month spending distribution from past months
  const pastMonths = {};
  catTxs.filter(tx => monthKey(tx.date) !== currentKey).forEach(tx => {
    const k = monthKey(tx.date);
    if (!pastMonths[k]) pastMonths[k] = { total: 0, byDay: {} };
    const d = dayOfMonth(tx.date);
    pastMonths[k].total += Math.abs(tx.amount);
    if (!pastMonths[k].byDay[d]) pastMonths[k].byDay[d] = 0;
    pastMonths[k].byDay[d] += Math.abs(tx.amount);
  });

  const pastKeys = Object.keys(pastMonths).sort().slice(-6); // last 6 months
  if (pastKeys.length === 0) return { predicted: spentSoFar, spentSoFar, remaining: 0, confidence: 0.3 };

  // Calculate average cumulative spending curve (normalized 0-1 by day)
  const cumulativeCurves = pastKeys.map(k => {
    const pm = pastMonths[k];
    if (pm.total === 0) return null;
    const curve = [];
    let cumul = 0;
    for (let d = 1; d <= 31; d++) {
      cumul += pm.byDay[d] || 0;
      curve.push(cumul / pm.total);
    }
    return curve;
  }).filter(Boolean);

  if (cumulativeCurves.length === 0) return { predicted: spentSoFar, spentSoFar, remaining: 0, confidence: 0.3 };

  // Average curve (weighted: recent months matter more)
  const avgCurve = [];
  for (let d = 0; d < 31; d++) {
    const vals = cumulativeCurves.map((c, i) => c[d] * (1 + i * 0.3));
    const weights = cumulativeCurves.map((_, i) => 1 + i * 0.3);
    avgCurve.push(vals.reduce((s, v) => s + v, 0) / weights.reduce((s, w) => s + w, 0));
  }

  // What fraction of month spending typically happens by currentDay?
  const fractionSpent = avgCurve[Math.min(currentDay - 1, 30)] || 0.5;

  // Predict total
  const predicted = fractionSpent > 0.05 ? spentSoFar / fractionSpent : spentSoFar;
  const remaining = Math.max(0, predicted - spentSoFar);
  const confidence = Math.min(0.95, 0.4 + fractionSpent * 0.6); // more confident later in month

  return { predicted, spentSoFar, remaining, confidence };
}

// ─── MAIN PREDICTION FUNCTION ───

/**
 * Generate smart predictions for all categories in a given month.
 * Returns per-category predictions + aggregated totals.
 */
export function generatePredictions(transactions, expenseCats, incomeCats, year, month) {
  const predictions = {
    expenses: {},
    incomes: {},
    totalExpensePredicted: 0,
    totalIncomePredicted: 0,
  };

  // Expense predictions
  for (const cat of expenseCats) {
    const analysis = analyzeCategory(transactions, cat.id, 'expense');
    const monthEnd = predictMonthEnd(transactions, cat.id, 'expense', year, month);
    const budget = getCatBudget(cat, month);

    // Smart prediction: spentSoFar + estimated remaining
    let smartPredicted = monthEnd.predicted;
    if (analysis.pattern !== 'INSUFFICIENT' && monthEnd.spentSoFar > 0) {
      // Use the larger of: monthEnd projection OR historical average
      const projected = Math.max(monthEnd.predicted, analysis.avgMonthly);
      // Estimated remaining = projected total - what's spent
      const remaining = Math.max(0, projected - monthEnd.spentSoFar);
      smartPredicted = monthEnd.spentSoFar + remaining;
    } else if (analysis.pattern !== 'INSUFFICIENT') {
      smartPredicted = analysis.avgMonthly;
    }
    // CRITICAL: prediction must always be >= what's already spent
    smartPredicted = Math.max(smartPredicted, monthEnd.spentSoFar);

    const willMeetBudget = budget > 0 ? smartPredicted <= budget : null;

    predictions.expenses[cat.id] = {
      ...analysis,
      monthEnd,
      budget,
      smartPredicted,
      willMeetBudget,
      percentOfBudget: budget > 0 ? (smartPredicted / budget) * 100 : null,
    };
    predictions.totalExpensePredicted += smartPredicted;
  }

  // Income predictions
  for (const cat of incomeCats) {
    const analysis = analyzeCategory(transactions, cat.id, 'income');
    const monthEnd = predictMonthEnd(transactions, cat.id, 'income', year, month);
    const budget = getCatBudget(cat, month);

    let smartPredicted = monthEnd.predicted;
    if (analysis.pattern !== 'INSUFFICIENT' && monthEnd.spentSoFar > 0) {
      const projected = Math.max(monthEnd.predicted, analysis.avgMonthly);
      const remaining = Math.max(0, projected - monthEnd.spentSoFar);
      smartPredicted = monthEnd.spentSoFar + remaining;
    } else if (analysis.pattern !== 'INSUFFICIENT') {
      smartPredicted = analysis.avgMonthly;
    }
    smartPredicted = Math.max(smartPredicted, monthEnd.spentSoFar);

    predictions.incomes[cat.id] = {
      ...analysis,
      monthEnd,
      budget,
      smartPredicted,
      willMeetBudget: budget > 0 ? smartPredicted >= budget : null,
    };
    predictions.totalIncomePredicted += smartPredicted;
  }

  return predictions;
}

/**
 * Get monthly budget target (sum of all category budgets for a month).
 */
export function getMonthlyBudgetTarget(expenseCats, incomeCats, month) {
  const expBudget = expenseCats.reduce((s, c) => s + getCatBudget(c, month), 0);
  const incBudget = incomeCats.reduce((s, c) => s + getCatBudget(c, month), 0);
  const savingsTarget = incBudget - expBudget;
  return { expBudget, incBudget, savingsTarget };
}
