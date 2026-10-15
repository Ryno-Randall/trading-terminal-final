import { NextResponse } from 'next/server';

const PAIRS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/JPY': 'GBPJPY=X',
  'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'NZD/USD': 'NZDUSD=X',
  'EUR/GBP': 'EURGBP=X',
  'GBP/USD': 'GBPUSD=X',
  'EUR/JPY': 'EURJPY=X',
  'USD/CHF': 'USDCHF=X',
  'AUD/JPY': 'AUDJPY=X',
  'EUR/CHF': 'EURCHF=X',
};

export async function GET() {
  try {
    const results: any = {};
    for (const [pair, symbol] of Object.entries(PAIRS)) {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2d&interval=1d`, {
          cache: 'no-store',
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const quote = data.chart.result[0].indicators.quote[0];
        const livePrice = meta.regularMarketPrice;
        const prevHigh = quote.high?.[0]?? livePrice;
        const prevLow = quote.low?.[0]?? livePrice;
        const isJpy = pair.includes('JPY');
        const pipValue = isJpy? 0.01 : 0.0001;
        const pip20 = 20 * pipValue;
        results[pair] = {
          price: livePrice,
          pdh: prevHigh,
          pdl: prevLow,
          priceFormatted: livePrice.toFixed(isJpy? 3 : 5),
          pdhFormatted: prevHigh.toFixed(isJpy? 3 : 5),
          pdlFormatted: prevLow.toFixed(isJpy? 3 : 5),
          slForBuyFormatted: (prevLow - pip20).toFixed(isJpy? 3 : 5),
          slForSellFormatted: (prevHigh + pip20).toFixed(isJpy? 3 : 5),
        };
      } catch (e) { console.error(pair, e); }
    }
    return NextResponse.json({ data: results, source: 'Yahoo Finance - yfinance', timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}