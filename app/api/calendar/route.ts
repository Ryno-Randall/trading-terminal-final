import { NextResponse } from 'next/server';
export async function GET() {
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('FF fail');
    const data = await res.json();
    // Return only High impact + sorted
    const high = data.filter((e:any)=> e.impact === 'High').slice(0,60);
    return NextResponse.json({ data: high, all: data, source: 'ForexFactory - nfs.faireconomy.media', timestamp: new Date().toISOString() });
  } catch(e) {
    return NextResponse.json({ error: 'calendar failed', data: [] }, { status: 200 });
  }
}