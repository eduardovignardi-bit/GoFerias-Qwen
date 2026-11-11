import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || 'Brasil';

  try {
    const res = await fetch(
      `https://openstreetmap.org{encodeURIComponent(q)}&limit=1`,
      {
        headers: {
          'User-Agent': 'GoFeriasApp/1.0 (contato@goferias.com.br)',
        },
      }
    );
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
      });
    }

    return NextResponse.json({ lat: -23.5505, lon: -46.6333 });
  } catch {
    return NextResponse.json({ lat: -23.5505, lon: -46.6333 });
  }
}
