import { connection, NextResponse } from 'next/server';
import {
  BIAS_HISTORY_PAIRS,
  getBiasHistory,
  recordBiasChanges,
  type Bias,
  type BiasHistoryPair,
  type BiasUpdate,
} from './store';

function isBias(value: unknown): value is Bias {
  return value === 'BULLISH' || value === 'BEARISH';
}

function isBiasUpdate(value: unknown): value is BiasUpdate {
  if (!value || typeof value !== 'object') return false;
  const update = value as Record<string, unknown>;
  return BIAS_HISTORY_PAIRS.includes(update.pair as (typeof BIAS_HISTORY_PAIRS)[number])
    && isBias(update.bias)
    && typeof update.price === 'number'
    && Number.isFinite(update.price)
    && update.price > 0
    && typeof update.reason === 'string';
}

export async function GET(request: Request) {
  await connection();

  try {
    const pair = new URL(request.url).searchParams.get('pair');
    if (pair && !BIAS_HISTORY_PAIRS.includes(pair as (typeof BIAS_HISTORY_PAIRS)[number])) {
      return NextResponse.json({ error: 'Unsupported currency pair' }, { status: 400 });
    }

    const selectedPair = pair as BiasHistoryPair | null || undefined;
    if (!selectedPair) {
      return NextResponse.json(await getBiasHistory());
    }

    const history = await getBiasHistory(selectedPair);
    if (history.length === 0) {
      const response = await fetch(new URL('/api/bias', request.url), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Live bias endpoint returned ${response.status}`);
      }

      const biasData = await response.json();
      const current = biasData.pairs?.[selectedPair];
      if (!current || (current.bias !== 'BULLISH' && current.bias !== 'BEARISH')) {
        throw new Error(`Live bias endpoint returned no current bias for ${selectedPair}`);
      }

      await recordBiasChanges([{
        pair: selectedPair,
        bias: current.bias,
        price: current.price,
        reason: current.reason,
      }]);
      return NextResponse.json(await getBiasHistory(selectedPair));
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error('Bias history API failed to read history:', error);
    return NextResponse.json({ error: 'Failed to read bias history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await connection();

  try {
    const body: unknown = await request.json();
    const updates = body && typeof body === 'object'
      ? (body as Record<string, unknown>).changes
      : undefined;

    if (!Array.isArray(updates) || !updates.every(isBiasUpdate)) {
      return NextResponse.json({ error: 'Expected a changes array with valid bias updates' }, { status: 400 });
    }

    const appended = await recordBiasChanges(updates);
    return NextResponse.json({ appended });
  } catch (error) {
    console.error('Bias history API failed to record changes:', error);
    return NextResponse.json({ error: 'Failed to record bias history' }, { status: 500 });
  }
}
