import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      EURUSD: "BULLISH",
      GBPUSD: "BEARISH", 
      USDJPY: "BEARISH",
      USDCAD: "BULLISH",
      USDCHF: "BEARISH",
      AUDUSD: "BULLISH",
      AUDCAD: "BULLISH",
      EURGBP: "NEUTRAL"
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}