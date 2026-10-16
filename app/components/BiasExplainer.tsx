type Bias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
type RateTrend = 'up' | 'down' | 'hold';

type PairDetails = {
  bias: Bias;
  reason?: string;
  explanation?: string;
  flow?: string;
  bankFlow?: string;
  rateDiff: number;
  baseRate: number;
  quoteRate: number;
  baseScore?: number;
  quoteScore?: number;
};

type MarketDetails = {
  rates?: Record<string, number>;
  rateTrends?: Record<string, RateTrend>;
  rateBanks?: Record<string, string>;
  centralBankTexts?: Record<string, string>;
  yields?: { US10Y?: number; DE10Y?: number };
  dxy?: number;
  trend?: 'up' | 'down';
};

type BiasExplainerProps = {
  pair: string;
  details: PairDetails;
  market: MarketDetails;
  onClose: () => void;
};

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Federal Reserve',
  EUR: 'ECB',
  GBP: 'Bank of England',
  JPY: 'Bank of Japan',
  AUD: 'RBA',
  CAD: 'Bank of Canada',
  NZD: 'RBNZ',
  CHF: 'SNB',
};

function rateStance(currency: string, rate: number, trend?: RateTrend): string {
  if (trend === 'down') return 'Dovish - cutting';
  if (trend === 'up') return 'Hawkish - hiking';
  return rate >= 3 ? 'Hawkish Hold' : 'Dovish Hold';
}

function formatRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

export default function BiasExplainer({ pair, details, market, onClose }: BiasExplainerProps) {
  const [base, quote] = pair.split('/');
  const baseRate = market.rates?.[base] ?? details.baseRate;
  const quoteRate = market.rates?.[quote] ?? details.quoteRate;
  const baseYield = base === 'USD' ? market.yields?.US10Y : base === 'EUR' ? market.yields?.DE10Y : undefined;
  const quoteYield = quote === 'USD' ? market.yields?.US10Y : quote === 'EUR' ? market.yields?.DE10Y : undefined;
  const yieldSpread = baseYield !== undefined && quoteYield !== undefined
    ? baseYield - quoteYield
    : undefined;
  const biasColor = details.bias === 'BULLISH'
    ? 'text-green-300 border-green-500/40'
    : details.bias === 'BEARISH'
      ? 'text-red-300 border-red-500/40'
      : 'text-gray-300 border-gray-500/40';
  const baseBank = market.rateBanks?.[base] || CURRENCY_NAMES[base] || base;
  const quoteBank = market.rateBanks?.[quote] || CURRENCY_NAMES[quote] || quote;
  const baseStance = rateStance(base, baseRate, market.rateTrends?.[base]);
  const quoteStance = rateStance(quote, quoteRate, market.rateTrends?.[quote]);
  const dollarEffect = base === 'USD'
    ? 'A rising DXY usually supports this pair because USD is the base currency.'
    : quote === 'USD'
      ? 'A rising DXY usually weighs on this pair because USD is the quote currency.'
      : 'DXY tracks broad US dollar strength; it matters most when USD is one side of this pair.';
  const bullishYieldCondition = baseYield !== undefined && quoteYield !== undefined
    ? `${base} 10Y yield moves above ${quote} 10Y yield`
    : `${base} rate advantage grows and its bond yields attract more demand`;
  const bearishYieldCondition = baseYield !== undefined && quoteYield !== undefined
    ? `${quote} 10Y yield moves above ${base} 10Y yield`
    : `${quote} rate advantage grows and its bond yields attract more demand`;
  const quickReason = details.reason || details.explanation || 'The bias reflects the relative currency scores and available fundamentals.';
  const quickFlow = details.flow || details.bankFlow || 'Institutional flow follows the currency with the stronger fundamentals.';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bias-explainer-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#080d18] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Fundamentals, made simple</div>
            <h2 id="bias-explainer-title" className={`mt-1 text-xl font-black ${biasColor.split(' ')[0]}`}>
              {pair} - {details.bias}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bias explanation"
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-gray-300 hover:border-cyan-300 hover:text-white"
          >
            X
          </button>
        </header>

        <section className={`mb-4 rounded-xl border bg-black/40 p-4 ${biasColor.split(' ').slice(1).join(' ')}`}>
          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">1. Quick Why</h3>
          <p className="text-sm leading-relaxed text-gray-200">{quickReason}</p>
          <p className="mt-2 text-xs leading-relaxed text-yellow-100/90">{quickFlow}</p>
          <p className="mt-2 font-mono text-[11px] text-gray-400">
            Rate difference: {base} {formatRate(details.baseRate)} vs {quote} {formatRate(details.quoteRate)} = {details.rateDiff > 0 ? '+' : ''}{details.rateDiff.toFixed(2)}%
          </p>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">2. What We Look At</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <article className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h4 className="text-xs font-bold text-cyan-100">Central Bank Score</h4>
              <p className="mt-2 text-xs text-gray-200">
                {market.centralBankTexts?.[base] || `${baseBank}: ${baseStance} (${formatRate(baseRate)})`}
              </p>
              <p className="text-xs text-gray-200">
                {market.centralBankTexts?.[quote] || `${quoteBank}: ${quoteStance} (${formatRate(quoteRate)})`}
              </p>
              <p className="mt-2 text-[11px] text-gray-400">
                Score: {details.baseScore ?? '—'} vs {details.quoteScore ?? '—'}. Cutting rates can weaken a currency; holding high rates can support it.
              </p>
            </article>

            <article className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h4 className="text-xs font-bold text-cyan-100">Yield Advantage</h4>
              {yieldSpread !== undefined ? (
                <p className="mt-2 text-xs text-gray-200">
                  {base} 10Y {formatRate(baseYield!)} vs {quote} 10Y {formatRate(quoteYield!)}; spread {yieldSpread > 0 ? '+' : ''}{yieldSpread.toFixed(2)}%.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-200">
                  US 10Y {market.yields?.US10Y !== undefined ? formatRate(market.yields.US10Y) : '—'} vs DE 10Y {market.yields?.DE10Y !== undefined ? formatRate(market.yields.DE10Y) : '—'}.
                </p>
              )}
              <p className="mt-2 text-[11px] text-gray-400">Investors often seek higher yields, which can increase demand for that currency.</p>
            </article>

            <article className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h4 className="text-xs font-bold text-cyan-100">DXY &amp; Dollar Strength</h4>
              <p className="mt-2 text-xs text-gray-200">
                DXY {market.dxy !== undefined ? market.dxy.toFixed(2) : '—'} - {market.trend === 'up' ? 'trending up' : market.trend === 'down' ? 'trending down' : 'trend unavailable'}.
              </p>
              <p className="mt-2 text-[11px] text-gray-400">{dollarEffect}</p>
            </article>

            <article className="rounded-xl border border-white/10 bg-black/40 p-3">
              <h4 className="text-xs font-bold text-cyan-100">Institutional Flow</h4>
              <p className="mt-2 text-xs leading-relaxed text-gray-200">{quickFlow}</p>
              <p className="mt-2 text-[11px] text-gray-400">In plain language: large banks and funds are shifting money toward the currency they expect to reward them more.</p>
            </article>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/40 p-4">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">3. What Makes It Flip?</h3>
          <ul className="space-y-2 text-xs leading-relaxed text-gray-300">
            <li><span className="font-bold text-green-300">BULLISH {pair}:</span> {base} becomes more hawkish or stops cutting, {quote} starts cutting, or {bullishYieldCondition}.</li>
            <li><span className="font-bold text-red-300">BEARISH {pair}:</span> {quote} becomes more hawkish while {base} cuts, or {bearishYieldCondition}.</li>
            <li><span className="font-bold text-gray-200">NEUTRAL:</span> both central banks have similar rate outlooks and neither currency has a clear yield advantage.</li>
          </ul>
        </section>
      </section>
    </div>
  );
}
