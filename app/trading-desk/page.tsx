"use client";
import { useState, useEffect } from 'react';
import BiasExplainer from '../components/BiasExplainer';
const PAIR_LIST = ['EUR/USD','GBP/JPY','USD/JPY','AUD/USD','USD/CAD','NZD/USD','EUR/GBP','GBP/USD','EUR/JPY','USD/CHF','AUD/JPY','EUR/CHF'];
const HISTORY_PAIRS = ['EUR/USD','GBP/USD','USD/JPY','USD/CAD','AUD/USD','NZD/USD'];

type BiasHistoryEntry = {
  timestamp: string;
  from: 'BULLISH' | 'BEARISH';
  to: 'BULLISH' | 'BEARISH';
  price: number;
  reason: string;
  initial?: boolean;
  count: number;
};

type PairBiasData = {
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
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

type MarketFundamentals = {
  rates?: Record<string, number>;
  rateTrends?: Record<string, 'up' | 'down' | 'hold'>;
  rateBanks?: Record<string, string>;
  centralBankTexts?: Record<string, string>;
  yields?: { US10Y?: number; DE10Y?: number };
  dxy?: number;
  trend?: 'up' | 'down';
};

type FundamentalsResponse = MarketFundamentals & {
  pairs?: Record<string, PairBiasData>;
};

type BiasResponse = MarketFundamentals & {
  pairs?: Record<string, PairBiasData>;
};

export default function FullTradingDesk() {
  const [live, setLive] = useState<any>({});
  const [fund, setFund] = useState<any>({});
  const [fundamentals, setFundamentals] = useState<FundamentalsResponse>({});
  const [biasData, setBiasData] = useState<BiasResponse>({});
  const [cal, setCal] = useState<any[]>([]);
  const [time, setTime] = useState('');
  const [historyPair, setHistoryPair] = useState<string | null>(null);
  const [explainerPair, setExplainerPair] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<BiasHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const openHistory = async (pair: string) => {
    setHistoryPair(pair);
    setHistoryEntries([]);
    setHistoryError('');
    setHistoryLoading(true);

    try {
      const response = await fetch(`/api/bias-history?pair=${encodeURIComponent(pair)}`);
      if (!response.ok) throw new Error(`History request failed (${response.status})`);
      const entries: BiasHistoryEntry[] = await response.json();
      setHistoryEntries(entries);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatHistoryTime = (timestamp: string) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp));

  const copyHistoryTime = async (timestamp: string) => {
    try {
      await navigator.clipboard.writeText(formatHistoryTime(timestamp));
    } catch (error) {
      setHistoryError(error instanceof Error ? `Could not copy date/time: ${error.message}` : 'Could not copy date/time');
    }
  };

  const fetchAll = async () => {
    try {
      const [l, f, b, c] = await Promise.all([
        fetch('/api/live-forex').then(r=>r.json()),
        fetch('/api/fundamentals').then(r=>r.json()),
        fetch('/api/bias').then(r=>r.json()),
        fetch('/api/calendar').then(r=>r.json()),
      ]);
      setLive(l.data||{}); setFund(f.pairs||{}); setFundamentals(f); setBiasData(b||{}); setCal(c.data||[]); setTime(new Date().toLocaleTimeString());
    } catch(e){ console.log(e) }
  };

  useEffect(()=>{ fetchAll(); const i=setInterval(fetchAll, 15000); return()=>clearInterval(i); }, []);

  const getCalForPair = (pair:string) => {
    const [b,q]=pair.split('/');
    return cal.filter((e:any)=> e.country===b || e.country===q || e.country=== (b==='USD'?'USD':null) || e.country=== (q==='USD'?'USD':null)).slice(0,3);
  };

  return (
    <div className="min-h-screen bg-[#050811] text-white p-3">
      <div className="border border-cyan-500/30 p-4 rounded-xl bg-black/60 mb-4 flex justify-between">
        <div><h1 className="text-2xl font-black tracking-wider">TRADING DESK - REAL FUNDAMENTAL PLAYBOOK</h1><p className="text-xs text-cyan-300">Yahoo Finance Live + ForexFactory Calendar + CFTC COT + Central Bank Rates | All REAL</p></div>
        <div className="text-right text-xs"><div className="text-cyan-300">Live: {time}</div><div className="text-green-400">● Yahoo 200 OK</div><div className="text-yellow-400">● FF Calendar {cal.length} High Impact</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PAIR_LIST.map(pair=>{
          const lp = live[pair];
          const fp = fund[pair];
          const events = getCalForPair(pair);
          if(!fp) return <div key={pair} className="border border-white/10 p-4 rounded-xl animate-pulse">Loading {pair}...</div>;
          const isBull = fp.bias==='BULLISH';
          const isBear = fp.bias==='BEARISH';
          return (
            <div key={pair} className={`border rounded-2xl p-4 relative overflow-hidden ${isBull?'border-green-500/30 bg-green-950/10': isBear?'border-red-500/30 bg-red-950/10':'border-yellow-500/30 bg-yellow-950/10'}`}>
              <div className="flex justify-between items-start">
                <div><h2 className="text-xl font-black">{pair}</h2><div className="text-xs text-gray-400">{fp.bankBias}</div></div>
                <div className="text-right"><div className="flex items-center justify-end gap-2"><div className={`px-3 py-1 rounded-full text-xs font-black ${isBull?'bg-green-500 text-black': isBear?'bg-red-500 text-white':'bg-yellow-500 text-black'}`}>{fp.bias}</div>{HISTORY_PAIRS.includes(pair) && <button type="button" onClick={() => openHistory(pair)} className="rounded border border-white/20 px-2 py-1 text-[10px] text-cyan-200 hover:border-cyan-300 hover:text-white">◷ History</button>}</div><div className="text-lg font-mono font-bold mt-1">{lp?.priceFormatted || '...'}</div></div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="bg-black/60 p-2 rounded border border-white/10"><div className="text-gray-400">LIVE PRICE</div><div className="text-white font-bold">{lp?.priceFormatted}</div></div>
                <div className="bg-black/60 p-2 rounded border border-white/10"><div className="text-gray-400">PDH</div><div>{lp?.pdhFormatted}</div><div className="text-[10px] text-red-300">SL SELL: {lp?.slForSellFormatted}</div></div>
                <div className="bg-black/60 p-2 rounded border border-white/10"><div className="text-gray-400">PDL</div><div>{lp?.pdlFormatted}</div><div className="text-[10px] text-green-300">SL BUY: {lp?.slForBuyFormatted}</div></div>
              </div>

              <div className="mt-3 bg-black/70 p-3 rounded-xl border border-cyan-500/20">
                <div className="text-[11px] font-bold text-cyan-300 mb-1">WHY {fp.bias}?</div>
                <div className="text-[12px] leading-snug text-gray-200">{fp.explanation}</div>
                <div className="text-[11px] mt-2 text-yellow-200/80">{fp.bankFlow}</div>
                <div className="text-[10px] mt-1 text-gray-400">Rate Diff: {fp.base} {fp.baseRate}% vs {fp.quote} {fp.quoteRate}% = {fp.rateDiff>0?'+':''}{fp.rateDiff.toFixed(2)}%</div>
                <button type="button" onClick={() => setExplainerPair(pair)} className="mt-2 rounded border border-cyan-500/30 px-2 py-1 text-[10px] font-bold text-cyan-200 hover:border-cyan-300 hover:text-white">Why this bias?</button>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-bold text-orange-300">NEWS THAT WILL MOVE IT (Real ForexFactory)</div>
                <div className="mt-1 space-y-1">
                  {events.length>0? events.map((ev:any,i:number)=>(
                    <div key={i} className="flex justify-between text-[11px] bg-black/50 p-1.5 rounded border border-white/5">
                      <span className="text-white">{ev.country} {ev.title}</span>
                      <span className="text-gray-400">{ev.forecast? `F:${ev.forecast}`:''} {ev.previous? `P:${ev.previous}`:''}</span>
                    </div>
                  )) : <div className="text-[11px] text-gray-500">No High Impact today - technical only</div>}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <div className={`flex-1 text-center py-2 rounded font-black text-xs ${isBull?'bg-green-500 text-black':'bg-black/60 text-gray-500 border border-white/10'}`}>BUY {lp?.priceFormatted} SL {lp?.slForBuyFormatted}</div>
                <div className={`flex-1 text-center py-2 rounded font-black text-xs ${isBear?'bg-red-500 text-white':'bg-black/60 text-gray-500 border border-white/10'}`}>SELL {lp?.priceFormatted} SL {lp?.slForSellFormatted}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border border-white/10 p-4 rounded-xl bg-black/50">
        <h3 className="font-bold text-sm mb-2">Full Economic Calendar (Real - ForexFactory High Impact This Week)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {cal.slice(0,18).map((ev:any,i:number)=>(
            <div key={i} className="text-[11px] flex justify-between bg-[#0a0e1a] p-2 rounded border border-white/5">
              <span><b className="text-cyan-300">{ev.country}</b> {ev.title}</span>
              <span className="text-gray-500">{new Date(ev.date).toLocaleDateString()} {ev.impact}</span>
            </div>
          ))}
        </div>
      </div>

      {historyPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setHistoryPair(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bias-history-title"
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-cyan-500/40 bg-[#080d18] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="bias-history-title" className="text-lg font-black text-cyan-200">{historyPair} Bias History</h2>
                <p className="text-[11px] text-gray-400">Times shown in Africa/Johannesburg</p>
              </div>
              <button type="button" onClick={() => setHistoryPair(null)} aria-label="Close history" className="rounded border border-white/20 px-3 py-1 text-gray-300 hover:text-white">Close</button>
            </div>
            {historyLoading ? <div className="py-8 text-center text-sm text-gray-400">Loading history...</div>
              : historyError ? <div role="alert" className="py-6 text-sm text-red-300">{historyError}</div>
                : historyEntries.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">Loading the initial bias record...</div>
                  : <ol className="space-y-3">
                    {[...historyEntries].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).map((entry, index) => (
                      <li key={`${entry.timestamp}-${index}`} className="rounded-lg border border-white/10 bg-black/40 p-3">
                        {entry.initial ? (
                          <div className="text-sm text-gray-200">
                            Initial bias recorded now: <span className={entry.to === 'BULLISH' ? 'font-bold text-green-300' : 'font-bold text-red-300'}>{entry.to}</span> at{' '}
                            <button type="button" onClick={() => copyHistoryTime(entry.timestamp)} className="select-text font-mono text-cyan-200 underline decoration-dotted underline-offset-2" title="Copy date and time">
                              {formatHistoryTime(entry.timestamp)}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
                            <button type="button" onClick={() => copyHistoryTime(entry.timestamp)} className="select-text text-cyan-200 underline decoration-dotted underline-offset-2" title="Copy date and time">
                              {formatHistoryTime(entry.timestamp)}
                            </button>
                            <span className="text-gray-500">|</span>
                            <span className={entry.from === 'BEARISH' ? 'font-bold text-red-300' : 'font-bold text-green-300'}>{entry.from}</span>
                            <span className="text-gray-400">→</span>
                            <span className={entry.to === 'BEARISH' ? 'font-bold text-red-300' : 'font-bold text-green-300'}>{entry.to}</span>
                            <span className="text-gray-500">|</span>
                            <span className="text-gray-200">Price {entry.price}</span>
                            <span className="text-gray-500">|</span>
                            <span className="text-gray-400">#{entry.count}</span>
                          </div>
                        )}
                        <p className="mt-2 text-xs leading-relaxed text-gray-300">{entry.reason}</p>
                      </li>
                    ))}
                  </ol>}
          </section>
        </div>
      )}
      {explainerPair && (() => {
        const fundamentalPair = fund[explainerPair];
        const pairDetails = biasData.pairs?.[explainerPair] || fundamentalPair;
        return pairDetails ? (
          <BiasExplainer
            pair={explainerPair}
            details={pairDetails}
            market={{
              rates: fundamentals.rates || biasData.rates,
              rateTrends: fundamentals.rateTrends || biasData.rateTrends,
              rateBanks: fundamentals.rateBanks || biasData.rateBanks,
              centralBankTexts: biasData.centralBankTexts,
              yields: fundamentals.yields || biasData.yields,
              dxy: fundamentals.dxy ?? biasData.dxy,
              trend: fundamentals.trend || biasData.trend,
            }}
            onClose={() => setExplainerPair(null)}
          />
        ) : null;
      })()}
    </div>
  );
}