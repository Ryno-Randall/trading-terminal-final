import { connection, NextResponse } from 'next/server';
import { scorePair } from '../bias/scoring';

const CACHE_DURATION_MS = 15 * 60 * 1000;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'] as const;
const PAIRS = [
  'EUR/USD', 'GBP/JPY', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'GBP/USD', 'EUR/JPY', 'USD/CHF', 'AUD/JPY', 'EUR/CHF',
] as const;
const CENTRAL_BANKS: Record<(typeof CURRENCIES)[number], { country: string; name: string }> = {
  USD: { country: 'United States', name: 'Federal Reserve' },
  EUR: { country: 'Europe', name: 'European Central Bank' },
  GBP: { country: 'United Kingdom', name: 'Bank of England' },
  JPY: { country: 'Japan', name: 'Bank of Japan' },
  AUD: { country: 'Australia', name: 'Reserve Bank of Australia' },
  CAD: { country: 'Canada', name: 'Bank of Canada' },
  NZD: { country: 'New Zealand', name: 'Reserve Bank of New Zealand' },
  CHF: { country: 'Switzerland', name: 'Swiss National Bank' },
};

type Currency = (typeof CURRENCIES)[number];
type Direction = 'up' | 'down' | 'hold';
type YahooQuote = { price: number; trend: 'up' | 'down' };
type Fundamentals = {
  rates: Record<Currency, number>;
  rateTrends: Record<Currency, Direction>;
  rateBanks: Record<Currency, string>;
  yields: { US10Y: number; DE10Y: number };
  dxy: number;
  trend: 'up' | 'down';
  timestamp: string;
};

let cachedFundamentals: Fundamentals | undefined;
let cacheExpiresAt = 0;

async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`,
    { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status} for ${symbol}`);

  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  const price = Number(result?.meta?.regularMarketPrice);
  const closes = (result?.indicators?.quote?.[0]?.close ?? [])
    .filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!Number.isFinite(price) || price <= 0 || closes.length === 0) {
    throw new Error(`Yahoo Finance returned no usable quote for ${symbol}`);
  }

  return { price, trend: closes[closes.length - 1] >= closes[0] ? 'up' : 'down' };
}

async function fetchPolicyRates(): Promise<{
  rates: Record<Currency, number>;
  trends: Record<Currency, Direction>;
}> {
  const response = await fetch('https://www.global-rates.com/en/interest-rates/central-banks/', {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) throw new Error(`Central-bank rate feed returned ${response.status}`);

  const html = await response.text();
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rates = {} as Record<Currency, number>;
  const trends = {} as Record<Currency, Direction>;

  for (const currency of CURRENCIES) {
    const { country } = CENTRAL_BANKS[currency];
    const row = rows.find((match) => {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
      return text.includes(country);
    });
    const text = row?.[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
    const observations = [...(text ?? '').matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
      .map((match) => Number(match[1].replace(',', '.')));
    if (observations.length < 2 || observations.some((value) => !Number.isFinite(value))) {
      throw new Error(`No current and previous policy-rate observations found for ${currency}`);
    }

    rates[currency] = observations[0];
    trends[currency] = observations[0] > observations[1]
      ? 'up'
      : observations[0] < observations[1] ? 'down' : 'hold';
  }

  return { rates, trends };
}

async function fetchGerman10YearYield(): Promise<number> {
  const response = await fetch(
    'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?format=csvdata&lastNObservations=2',
    { cache: 'no-store', headers: { Accept: 'text/csv' } },
  );
  if (!response.ok) throw new Error(`ECB yield feed returned ${response.status}`);

  const rows = (await response.text()).trim().split(/\r?\n/).slice(1).reverse();
  for (const row of rows) {
    const value = Number(row.split(',')[9]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  throw new Error('ECB yield feed returned no usable German 10-year yield');
}

async function loadFundamentals(): Promise<Fundamentals> {
  const [policyRates, us10y, dxy, de10y] = await Promise.all([
    fetchPolicyRates(),
    fetchYahooQuote('%5ETNX'),
    fetchYahooQuote('DX-Y.NYB'),
    fetchGerman10YearYield(),
  ]);
  const rateBanks = Object.fromEntries(
    CURRENCIES.map((currency) => [currency, CENTRAL_BANKS[currency].name]),
  ) as Record<Currency, string>;

  return {
    rates: policyRates.rates,
    rateTrends: policyRates.trends,
    rateBanks,
    yields: { US10Y: us10y.price, DE10Y: de10y },
    dxy: dxy.price,
    trend: dxy.trend,
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  await connection();

  try {
    if (!cachedFundamentals || Date.now() >= cacheExpiresAt) {
      cachedFundamentals = await loadFundamentals();
      cacheExpiresAt = Date.now() + CACHE_DURATION_MS;
    }

    const fundamentals = cachedFundamentals;
    const pairs: Record<string, object> = {};

    for (const pair of PAIRS) {
      const [base, quote] = pair.split('/') as [Currency, Currency];
      const difference = fundamentals.rates[base] - fundamentals.rates[quote];
      const { bias, baseScore, quoteScore } = scorePair(base, quote, fundamentals);
      const rateAction = (currency: Currency) => {
        const direction = fundamentals.rateTrends[currency];
        if (direction === 'up') return 'Hawkish - central bank hiking';
        if (direction === 'down') return 'Dovish - central bank cutting';
        return fundamentals.rates[currency] >= 3
          ? 'Hawkish Hold'
          : 'Dovish Hold';
      };
      const advantage = Math.abs(difference);
      const stronger = difference >= 0 ? base : quote;
      const weaker = difference >= 0 ? quote : base;
      const explanation = difference === 0
        ? `Policy rates are matched at ${fundamentals.rates[base].toFixed(2)}%. Relative rate momentum and yields favor ${bias === 'BULLISH' ? base : quote}.`
        : `${stronger} policy-rate advantage ${advantage.toFixed(2)}% over ${weaker}. Banks favor ${stronger} on carry.`;
      const bankFlow = bias === 'BULLISH'
        ? `Institutional flow: Long ${pair} - Banks rotating into higher-scoring ${base}.`
        : `Institutional flow: Short ${pair} - Banks rotating out of ${base} into higher-scoring ${quote}.`;

      pairs[pair] = {
        base,
        quote,
        baseRate: fundamentals.rates[base],
        quoteRate: fundamentals.rates[quote],
        rateDiff: difference,
        bias,
        bankBias: `${fundamentals.rateBanks[base]}: ${rateAction(base)} | ${fundamentals.rateBanks[quote]}: ${rateAction(quote)}`,
        explanation,
        bankFlow,
        baseScore,
        quoteScore,
      };
    }

    return NextResponse.json({
      pairs,
      rates: fundamentals.rates,
      rateTrends: fundamentals.rateTrends,
      rateBanks: fundamentals.rateBanks,
      yields: fundamentals.yields,
      dxy: fundamentals.dxy,
      trend: fundamentals.trend,
      source: 'Live central-bank rates, Yahoo Finance and ECB yield data',
      timestamp: fundamentals.timestamp,
    });
  } catch (error) {
    console.error('Fundamentals API failed to load live data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live fundamentals' },
      { status: 502 },
    );
  }
}
