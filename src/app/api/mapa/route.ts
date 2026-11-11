import { NextResponse } from 'next/server';

type ResultadoGeocodificacao = {
  lat?: string;
  lon?: string;
};

function coordenadasValidas(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'string' || typeof lon !== 'string') return false;

  const latitude = Number(lat);
  const longitude = Number(lon);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Informe uma localização para pesquisar.' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GoFeriasApp/1.0 (contato@goferias.com.br)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error('Geocodificador OSM respondeu com erro:', response.status);
      return NextResponse.json(
        { error: 'O serviço de mapas não conseguiu localizar esse endereço.' },
        { status: 502 }
      );
    }

    const resultados = (await response.json()) as ResultadoGeocodificacao[];
    const resultado = resultados[0];

    if (!resultado || !coordenadasValidas(resultado.lat, resultado.lon)) {
      return NextResponse.json(
        { error: 'Nenhuma coordenada válida foi encontrada para esse endereço.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lat: Number(resultado.lat),
      lon: Number(resultado.lon),
    });
  } catch (error) {
    console.error('Erro ao consultar geocodificador OSM:', error);
    return NextResponse.json(
      { error: 'Não foi possível consultar o serviço de mapas.' },
      { status: 502 }
    );
  }
}
