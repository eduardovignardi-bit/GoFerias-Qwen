import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type ImovelComparavel = {
  id: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  bedrooms?: number | string | null;
  quartos?: number | string | null;
  guests?: number | string | null;
  max_guests?: number | string | null;
  hospedes?: number | string | null;
  price_per_night?: number | string | null;
};

function numeroValido(valor: string | null): number | null {
  if (valor === null || valor.trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function coordenadasValidas(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function distanciaEmMetros(
  latitudeOrigem: number,
  longitudeOrigem: number,
  latitudeDestino: number,
  longitudeDestino: number
) {
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const diferencaLatitude = radianos(latitudeDestino - latitudeOrigem);
  const diferencaLongitude = radianos(longitudeDestino - longitudeOrigem);
  const aOriginal =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(radianos(latitudeOrigem)) *
      Math.cos(radianos(latitudeDestino)) *
      Math.sin(diferencaLongitude / 2) ** 2;
  const a = Math.min(1, Math.max(0, aOriginal));
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function numeroImovel(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function estimarReferenciaMercado(quartos: number, hospedes: number): number {
  const baseQuarto = Math.max(1, quartos) * 145;
  const adicionalHospede = Math.max(0, hospedes - 2) * 35;
  return Math.round((baseQuarto + adicionalHospede + 95) * 100) / 100;
}

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const propertyId = parametros.get('propertyId')?.trim();
  const latitude = numeroValido(parametros.get('latitude'));
  const longitude = numeroValido(parametros.get('longitude'));
  const bedrooms = numeroValido(parametros.get('bedrooms')) ?? 1;
  const guests = numeroValido(parametros.get('guests')) ?? 2;

  if (
    !propertyId ||
    latitude === null ||
    longitude === null ||
    !coordenadasValidas(latitude, longitude)
  ) {
    return NextResponse.json(
      { error: 'Informe a localização e coordenadas válidas do imóvel para calcular o preço.' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message);
    }

    const imoveis = (data || []) as ImovelComparavel[];
    const noRaio = imoveis.filter((imovel) => {
      if (imovel.id === propertyId) return false;
      const lat = numeroImovel(imovel.latitude ?? imovel.lat);
      const lon = numeroImovel(imovel.longitude ?? imovel.lon);
      return (
        lat !== null &&
        lon !== null &&
        coordenadasValidas(lat, lon) &&
        distanciaEmMetros(latitude, longitude, lat, lon) <= 3000
      );
    });

    const semelhantes = noRaio.filter((imovel) => {
      const quartosImovel = numeroImovel(imovel.bedrooms ?? imovel.quartos);
      const hospedesImovel = numeroImovel(imovel.guests ?? imovel.max_guests ?? imovel.hospedes);
      return quartosImovel === bedrooms || hospedesImovel === guests;
    });

    const baseComparavel = semelhantes.length >= 2 ? semelhantes : noRaio;
    const precos = baseComparavel
      .map((imovel) => numeroImovel(imovel.price_per_night))
      .filter((preco): preco is number => preco !== null && preco > 0);

    const usandoReferenciaMercado = precos.length === 0;
    const media = precos.length > 0
      ? Math.round((precos.reduce((total, preco) => total + preco, 0) / precos.length) * 100) / 100
      : estimarReferenciaMercado(bedrooms, guests);

    return NextResponse.json({
      analyzedCount: precos.length > 0 ? precos.length : 1,
      source: usandoReferenciaMercado ? 'mercado_referencia' : 'plataforma_local',
      standardPrice: media,
      weekendPrice: Math.round(media * 1.25 * 100) / 100,
      highSeasonPrice: Math.round(media * 1.4 * 100) / 100,
    });
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao calcular precificação por região:', detalhe);
    return NextResponse.json(
      { error: `Não foi possível consultar os preços: ${detalhe}` },
      { status: 500 }
    );
  }
}
