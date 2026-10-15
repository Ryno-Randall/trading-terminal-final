import { NextResponse } from 'next/server'

export async function GET() {
  const data = {
    timestamp: new Date().toISOString(),
    pairs: {
      "EURUSD": { bias: "BEARISH", confidence: 85 },
      "GBPUSD": { bias: "BULLISH", confidence: 72 },
      "USDJPY": { bias: "BEARISH", confidence: 90 },
      "XAUUSD": { bias: "BULLISH", confidence: 88 },
      "GBPJPY": { bias: "BULLISH", confidence: 65 },
      "EURGBP": { bias: "NEUTRAL", confidence: 50 },
    }
  }
  return NextResponse.json(data, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}