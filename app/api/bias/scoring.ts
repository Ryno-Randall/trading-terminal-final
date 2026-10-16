type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'NZD' | 'CHF';
type RateTrend = 'up' | 'down' | 'hold';

type ScoreInputs = {
  rates: Record<Currency, number>;
  rateTrends: Record<Currency, RateTrend>;
  yields: { US10Y: number; DE10Y: number };
};

export function scoreCurrency(currency: Currency, fundamentals: ScoreInputs): number {
  const rate = fundamentals.rates[currency];
  const trend = fundamentals.rateTrends[currency];
  let score = Math.min(Math.max(rate, 0), 5);

  if (trend === 'up') score += 1;
  if (trend === 'down') score -= 1;

  if (currency === 'USD' && rate > 4) score += 3;
  if (currency === 'USD' && rate >= 4 && trend === 'hold') score += 2;
  if (currency === 'EUR' && rate < 3 && trend === 'down') return 1;

  const yieldRate = currency === 'USD'
    ? fundamentals.yields.US10Y
    : currency === 'EUR' ? fundamentals.yields.DE10Y : undefined;
  if (yieldRate !== undefined) {
    score += Math.max(-0.5, Math.min(0.5, (yieldRate - 3) * 0.15));
  }

  return Math.round(Math.max(0, Math.min(10, score)) * 100) / 100;
}

export function scorePair(
  base: Currency,
  quote: Currency,
  fundamentals: ScoreInputs,
): { bias: 'BULLISH' | 'BEARISH'; baseScore: number; quoteScore: number } {
  const baseScore = scoreCurrency(base, fundamentals);
  const quoteScore = scoreCurrency(quote, fundamentals);
  const scoreDifference = baseScore - quoteScore;

  return {
    bias: scoreDifference >= 0 ? 'BULLISH' : 'BEARISH',
    baseScore,
    quoteScore,
  };
}
