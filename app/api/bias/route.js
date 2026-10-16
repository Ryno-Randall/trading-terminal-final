import { connection } from 'next/server';
import { recordBiasChanges } from '../bias-history/store';
import { scoreCurrency } from './scoring';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD'];

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${new URL(url).pathname} returned ${response.status}`);
  }
  return response.json();
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export async function GET() {
  await connection();

  try {
    const origin = process.env.APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`);
    const fundamentalsUrl = new URL('/api/fundamentals', origin);
    const liveForexUrl = new URL('/api/live-forex', origin);
    const [fundamentals, liveForex] = await Promise.all([
      fetchJson(fundamentalsUrl),
      fetchJson(liveForexUrl),
    ]);

    if (!fundamentals.rates || !fundamentals.rateTrends || !fundamentals.yields || !liveForex.data) {
      throw new Error('Fundamentals or live-forex response is missing required data');
    }

    const pairs = {};
    const historyUpdates = [];
    for (const pair of PAIRS) {
      const [base, quote] = pair.split('/');
      const baseRate = fundamentals.rates[base];
      const quoteRate = fundamentals.rates[quote];
      if (!Number.isFinite(baseRate) || !Number.isFinite(quoteRate)) {
        throw new Error(`Missing live policy rate for ${pair}`);
      }

      const baseScore = scoreCurrency(base, fundamentals);
      const quoteScore = scoreCurrency(quote, fundamentals);
      const scoreDifference = baseScore - quoteScore;
      const bias = scoreDifference >= 0 ? 'BULLISH' : 'BEARISH';
      const rateDiff = baseRate - quoteRate;
      const stronger = scoreDifference >= 0 ? base : quote;
      const weaker = scoreDifference >= 0 ? quote : base;
      const rateLeader = rateDiff >= 0 ? base : quote;
      const rateFollower = rateDiff >= 0 ? quote : base;
      const priceData = liveForex.data[pair];
      const price = priceData?.price;
      if (!isPositiveNumber(price)) {
        throw new Error(`Missing live price for ${pair}`);
      }

      const pipSize = pair.includes('JPY') ? 0.01 : 0.0001;
      const pdh = isPositiveNumber(priceData.pdh) ? priceData.pdh : price * 1.005;
      const pdl = isPositiveNumber(priceData.pdl) ? priceData.pdl : price * 0.995;
      const slSellFromLive = Number.parseFloat(priceData.slForSellFormatted);
      const slBuyFromLive = Number.parseFloat(priceData.slForBuyFormatted);
      const slSell = Number.isFinite(slSellFromLive) ? slSellFromLive : pdh + 20 * pipSize;
      const slBuy = Number.isFinite(slBuyFromLive) ? slBuyFromLive : pdl - 20 * pipSize;
      const rateExplanation = rateDiff === 0
        ? `Policy rates are matched at ${baseRate.toFixed(2)}%.`
        : `${rateLeader} policy-rate advantage ${Math.abs(rateDiff).toFixed(2)}% over ${rateFollower}.`;
      const flow = `Institutional flow: ${bias === 'BEARISH' ? `Short ${pair} - Banks rotating out of ${base} into higher-scoring ${quote}.` : `Long ${pair} - Banks rotating out of ${quote} into higher-scoring ${base}.`}`;
      const reason = `${stronger} currency score advantage ${Math.abs(scoreDifference).toFixed(2)} over ${weaker}. ${rateExplanation} Banks selling ${weaker}, moving to ${stronger}. ${flow}`;

      pairs[pair] = {
        pair,
        bias,
        price,
        pdh,
        pdl,
        slSell,
        slBuy,
        reason,
        flow,
        rateDiff,
        baseRate,
        quoteRate,
        baseScore,
        quoteScore,
      };
      historyUpdates.push({ pair, bias, price, reason });
    }

    await recordBiasChanges(historyUpdates);
    const centralBankTexts = Object.fromEntries(
      Object.entries(fundamentals.rates).map(([currency, rate]) => {
        const trend = fundamentals.rateTrends[currency];
        const stance = trend === 'up'
          ? 'Hawkish - hiking'
          : trend === 'down'
            ? 'Dovish - cutting'
            : rate >= 3 ? 'Hawkish Hold' : 'Dovish Hold';
        return [currency, `${fundamentals.rateBanks?.[currency] || currency}: ${stance} (${rate.toFixed(2)}%)`];
      }),
    );

    return Response.json({
      pairs,
      rates: fundamentals.rates,
      rateTrends: fundamentals.rateTrends,
      rateBanks: fundamentals.rateBanks,
      centralBankTexts,
      yields: fundamentals.yields,
      dxy: fundamentals.dxy,
      trend: fundamentals.trend,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Bias API failed to generate live pair scores:', error);
    return Response.json({ error: 'Failed to generate live automated bias' }, { status: 502 });
  }
}
