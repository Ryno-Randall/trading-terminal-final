import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BIAS_HISTORY_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CAD',
  'AUD/USD',
  'NZD/USD',
] as const;

export type BiasHistoryPair = (typeof BIAS_HISTORY_PAIRS)[number];
export type Bias = 'BULLISH' | 'BEARISH';
export type BiasChange = {
  timestamp: string;
  from: Bias;
  to: Bias;
  price: number;
  reason: string;
  initial?: boolean;
  count: number;
};
export type BiasHistory = Record<BiasHistoryPair, BiasChange[]>;
export type BiasUpdate = {
  pair: BiasHistoryPair;
  bias: Bias;
  price: number;
  reason: string;
};

const dataDirectory = path.join(process.cwd(), 'data');
const historyFile = path.join(dataDirectory, 'bias-history.json');
let writeQueue: Promise<void> = Promise.resolve();
const currentBias = new Map<string, Bias>();

function emptyHistory(): BiasHistory {
  return {
    'EUR/USD': [],
    'GBP/USD': [],
    'USD/JPY': [],
    'USD/CAD': [],
    'AUD/USD': [],
    'NZD/USD': [],
  };
}

function isBiasHistory(value: unknown): value is BiasHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return BIAS_HISTORY_PAIRS.every((pair) => Array.isArray(record[pair]));
}

async function readHistory(): Promise<BiasHistory> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    const content = await readFile(historyFile, 'utf8');
    const history: unknown = JSON.parse(content);
    if (!isBiasHistory(history)) {
      throw new Error('Bias history file has an invalid structure');
    }

    let migrated = false;
    for (const pair of BIAS_HISTORY_PAIRS) {
      let flipCount = 0;
      for (const entry of history[pair]) {
        const initial = entry.initial === true || entry.from === entry.to;
        const count = initial ? 0 : ++flipCount;
        if (entry.initial !== initial || entry.count !== count) {
          entry.initial = initial;
          entry.count = count;
          migrated = true;
        }
      }
    }
    if (migrated) await writeHistory(history);
    return history;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const history = emptyHistory();
    await writeHistory(history);
    return history;
  }
}

async function writeHistory(history: BiasHistory): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${historyFile}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, historyFile);
}

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getBiasHistory(pair: BiasHistoryPair): Promise<BiasChange[]>;
export function getBiasHistory(): Promise<BiasHistory>;
export async function getBiasHistory(
  pair?: BiasHistoryPair,
): Promise<BiasHistory | BiasChange[]> {
  return withWriteLock(async () => {
    const history = await readHistory();
    if (!pair) return history;
    return [...history[pair]].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  });
}

export function recordBiasChanges(updates: BiasUpdate[]): Promise<number> {
  return withWriteLock(async () => {
    const history = await readHistory();
    let appended = 0;

    for (const update of updates) {
      const entries = history[update.pair];
      const previousBias = currentBias.get(update.pair) ?? entries[entries.length - 1]?.to;
      currentBias.set(update.pair, update.bias);

      if (previousBias === update.bias) continue;

      entries.push({
        timestamp: new Date().toISOString(),
        from: previousBias ?? update.bias,
        to: update.bias,
        price: update.price,
        reason: update.reason,
        initial: previousBias === undefined,
        count: previousBias === undefined
          ? 0
          : entries.filter((entry) => !entry.initial).length + 1,
      });
      appended += 1;
    }

    if (appended > 0) await writeHistory(history);
    return appended;
  });
}
