import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'Florianopolis, SC, Brasil';

  try {
    const base = 'https://openstreetmap.org';
    const query = `?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(base + query, {
      headers: {
        'User-Agent': 'GoFeriasApp/1.0 (contato@goferias.com.br)',
      },
    });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      });
    }

    return NextResponse.json({ lat: -27.5954, lon: -48.548 });
  } catch {
    return NextResponse.json({ lat: -27.5954, lon: -48.548 });
  }
}
