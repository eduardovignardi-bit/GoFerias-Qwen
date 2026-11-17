import { NextResponse } from 'next/server';

type Coordenada = { latitude: number; longitude: number };
type LocalProximo = {
  id: string;
  nome: string;
  categoria: string;
  distancia: string;
  distanciaMetros: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function lerCoordenada(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

function coordenadasValidas(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function obterTag(tags: Record<string, unknown>, chave: string): string {
  const valor = tags[chave];
  return typeof valor === 'string' ? valor : '';
}

function calcularDistanciaMetros(origem: Coordenada, destino: Coordenada): number {
  const raioTerraMetros = 6_371_000;
  const radianos = (graus: number) => graus * (Math.PI / 180);
  const diferencaLatitude = radianos(destino.latitude - origem.latitude);
  const diferencaLongitude = radianos(destino.longitude - origem.longitude);
  const latitudeOrigem = radianos(origem.latitude);
  const latitudeDestino = radianos(destino.latitude);
  const a =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(latitudeOrigem) *
      Math.cos(latitudeDestino) *
      Math.sin(diferencaLongitude / 2) ** 2;
  return Math.round(raioTerraMetros * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatarDistancia(distanciaMetros: number): string {
  return distanciaMetros < 1000
    ? `${distanciaMetros} m`
    : `${(distanciaMetros / 1000).toFixed(1)} km`;
}

async function buscarPorCategoria(origem: Coordenada, termo: string, categoria: string): Promise<LocalProximo[]> {
  try {
    const url = `https://komoot.io{encodeURIComponent(termo)}&lat=${origem.latitude}&lon=${origem.longitude}&limit=5`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GoFeriasApp/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];

    const dados: unknown = await resp.json();
    if (!isRecord(dados) || !Array.isArray(dados.features)) return [];

    const lista: LocalProximo[] = [];
    for (const feat of dados.features) {
      if (!isRecord(feat) || !isRecord(feat.properties) || !isRecord(feat.geometry)) continue;
      const coords = Array.isArray(feat.geometry.coordinates) ? feat.geometry.coordinates : [];
      const [lonBruto, latBruto] = coords;
      const lon = lerCoordenada(lonBruto);
      const lat = lerCoordenada(latBruto);
      const nome = obterTag(feat.properties, 'name');
      if (!nome || lat === null || lon === null) continue;

      const distanciaMetros = calcularDistanciaMetros(origem, { latitude: lat, longitude: lon });
      if (distanciaMetros > 3000) continue;

      lista.push({
        id: `${categoria}-${nome}-${distanciaMetros}`,
        nome: nome.trim().slice(0, 160),
        categoria,
        distancia: formatarDistancia(distanciaMetros),
        distanciaMetros,
      });
    }
    return lista;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = lerCoordenada(searchParams.get('latitude'));
  const longitude = lerCoordenada(searchParams.get('longitude'));

  if (
    latitude === null ||
    longitude === null ||
    !coordenadasValidas(latitude, longitude)
  ) {
    return NextResponse.json(
      { error: 'Informe latitude e longitude válidas para buscar locais próximos.' },
      { status: 400 }
    );
  }

  const origem = { latitude, longitude };

  const resultadosPorGrupo = await Promise.all([
    buscarPorCategoria(origem, 'restaurante', 'Restaurante'),
    buscarPorCategoria(origem, 'supermercado', 'Mercado'),
    buscarPorCategoria(origem, 'padaria', 'Padaria'),
    buscarPorCategoria(origem, 'farmacia', 'Farmácia'),
    buscarPorCategoria(origem, 'praia', 'Praia'),
  ]);

  const vistos = new Set<string>();
  const locais: LocalProximo[] = [];

  for (const grupo of resultadosPorGrupo) {
    for (const item of grupo) {
      const chave = item.nome.toLowerCase();
      if (!vistos.has(chave)) {
        vistos.add(chave);
        locais.push(item);
      }
    }
  }

  locais.sort((a, b) => a.distanciaMetros - b.distanciaMetros);

  return NextResponse.json(
    { locais: locais.slice(0, 20), atribuicao: '© OpenStreetMap contributors' },
    { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' } }
  );
}
