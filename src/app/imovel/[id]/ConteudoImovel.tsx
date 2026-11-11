'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LogoGoFerias from '@/components/LogoGoFerias';
import WidgetReserva from './WidgetReserva';

type Imovel = {
  id: string;
  title?: string | null;
  images?: unknown;
  image_url?: string | null;
  street?: string | null;
  street_number?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  location?: string | null;
  neighborhood?: string | null;
  guests?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  bathrooms?: number | null;
  price_per_night: number | string;
  cleaning_fee?: number | string | null;
  description?: string | null;
  [key: string]: unknown;
};

type ResultadoImovel = {
  id: string;
  tentativa: number;
  imovel: Imovel | null;
  erro: string | null;
};

type Coordenadas = {
  lat: number;
  lon: number;
};

function coordenadasValidas(lat: unknown, lon: unknown): Coordenadas | null {
  if (
    (typeof lat !== 'number' && typeof lat !== 'string') ||
    (typeof lon !== 'number' && typeof lon !== 'string')
  ) {
    return null;
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { lat: latitude, lon: longitude };
}

export default function ConteudoImovel({ imovelId }: { imovelId: string }) {
  const [resultado, setResultado] = useState<ResultadoImovel | null>(null);
  const [coords, setCoords] = useState<Coordenadas>({ lat: -27.5954, lon: -48.548 });
  const [verTodasFotos, setVerTodasFotos] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;

    const buscarDetalhes = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', imovelId)
          .maybeSingle();

        if (error) throw error;
        if (!ativo) return;

        setResultado({
          id: imovelId,
          tentativa,
          imovel: data as Imovel | null,
          erro: data ? null : 'Imóvel não encontrado.',
        });
      } catch (error) {
        if (!ativo) return;
        console.error('Erro ao buscar detalhes do imóvel:', error);
        setResultado({
          id: imovelId,
          tentativa,
          imovel: null,
          erro: 'Não foi possível carregar este imóvel. Verifique sua conexão e tente novamente.',
        });
      }
    };

    void buscarDetalhes();
    return () => {
      ativo = false;
    };
  }, [imovelId, tentativa]);

  const carregando = resultado?.id !== imovelId || resultado.tentativa !== tentativa;
  const imovel = carregando ? null : resultado?.imovel || null;

  useEffect(() => {
    if (!imovel) return;

    let ativo = true;
    const buscaMapa =
      imovel.street && imovel.city
        ? `${imovel.street}, ${imovel.city}, ${imovel.state || ''}, Brasil`
        : imovel.cep || imovel.location || '';

    if (!buscaMapa) return;

    const buscarCoordenadas = async () => {
      try {
        const response = await fetch(`/api/mapa?q=${encodeURIComponent(buscaMapa)}`);
        if (!response.ok) throw new Error(`Falha ao localizar o imóvel (HTTP ${response.status}).`);

        const geo: unknown = await response.json();
        if (!geo || typeof geo !== 'object' || !('lat' in geo) || !('lon' in geo)) {
          throw new Error('Resposta do serviço de mapas sem coordenadas.');
        }

        const coordenadas = coordenadasValidas(geo.lat, geo.lon);
        if (!coordenadas) throw new Error('Coordenadas inválidas para este imóvel.');
        if (ativo) setCoords(coordenadas);
      } catch (error) {
        if (ativo) console.error('Erro ao localizar imóvel no mapa:', error);
      }
    };

    void buscarCoordenadas();
    return () => {
      ativo = false;
    };
  }, [imovel]);

  if (carregando) {
    return (
      <main
        aria-busy="true"
        aria-label="Carregando detalhes do imóvel"
        className="mx-auto min-h-screen max-w-6xl animate-pulse px-6 py-8"
      >
        <div className="mb-8 h-8 w-40 rounded-lg bg-gray-200" />
        <div className="mb-4 h-9 w-2/3 rounded-lg bg-gray-200" />
        <div className="mb-8 h-5 w-1/3 rounded bg-gray-200" />
        <div className="mb-10 h-80 rounded-2xl bg-gray-200 sm:h-[420px]" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="h-24 rounded-xl bg-gray-200" />
            <div className="h-40 rounded-xl bg-gray-200" />
          </div>
          <div className="h-96 rounded-2xl bg-gray-200" />
        </div>
      </main>
    );
  }

  if (!imovel) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-semibold text-gray-800" role="alert">
          {resultado?.id === imovelId ? resultado.erro : 'Não foi possível carregar o imóvel.'}
        </p>
        {resultado?.erro !== 'Imóvel não encontrado.' && (
          <button
            type="button"
            onClick={() => setTentativa((atual) => atual + 1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Tentar novamente
          </button>
        )}
        <Link href="/marketplace" className="text-sm font-bold text-[#155E75] underline">
          ← Voltar para acomodações
        </Link>
      </main>
    );
  }

  const fotos: string[] =
    Array.isArray(imovel.images) && imovel.images.length > 0
      ? imovel.images.filter((foto): foto is string => typeof foto === 'string')
      : imovel.image_url
        ? [imovel.image_url]
        : [];

  const bbox = [
    coords.lon - 0.015,
    coords.lat - 0.015,
    coords.lon + 0.015,
    coords.lat + 0.015,
  ].join(',');
  const urlMapa = new URL('https://www.openstreetmap.org/export/embed.html');
  urlMapa.searchParams.set('bbox', bbox);
  urlMapa.searchParams.set('layer', 'mapnik');
  urlMapa.searchParams.set('marker', `${coords.lat},${coords.lon}`);

  return (
    <div className="min-h-screen bg-white font-sans text-[#222222]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <Link href="/marketplace" aria-label="Voltar ao marketplace">
            <LogoGoFerias />
          </Link>
          <Link href="/marketplace" className="text-sm font-semibold text-gray-700 hover:underline">
            ← Voltar para acomodações
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {imovel.title || 'Detalhes do imóvel'}
        </h1>
        <p className="mb-6 mt-1 text-sm font-medium text-gray-600 underline">
          {imovel.neighborhood ? `${imovel.neighborhood}, ` : ''}
          {imovel.location} {imovel.cep ? `· CEP ${imovel.cep}` : ''}
        </p>

        {fotos.length > 0 && (
          <div className="relative mb-10 grid h-[320px] grid-cols-1 gap-2 overflow-hidden rounded-2xl bg-gray-100 sm:h-[420px] md:grid-cols-4">
            <div className="h-full md:col-span-2">
              <img src={fotos[0]} alt="Foto principal do imóvel" className="h-full w-full object-cover" />
            </div>
            <div className="hidden h-full grid-rows-2 gap-2 md:grid">
              {fotos[1] && <img src={fotos[1]} alt="Foto 2 do imóvel" className="h-full w-full object-cover" />}
              {fotos[2] && <img src={fotos[2]} alt="Foto 3 do imóvel" className="h-full w-full object-cover" />}
            </div>
            <div className="hidden h-full grid-rows-2 gap-2 md:grid">
              {fotos[3] && <img src={fotos[3]} alt="Foto 4 do imóvel" className="h-full w-full object-cover" />}
              {fotos[4] && <img src={fotos[4]} alt="Foto 5 do imóvel" className="h-full w-full object-cover" />}
            </div>

            {fotos.length > 1 && (
              <button
                type="button"
                onClick={() => setVerTodasFotos(true)}
                className="absolute bottom-4 right-4 rounded-xl border border-black bg-white/95 px-4 py-2 text-xs font-semibold text-gray-900 shadow-md transition hover:bg-white"
              >
                Mostrar todas as {fotos.length} fotos
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Espaço inteiro · Hospedagem verificada
              </h2>
              <p className="mt-1.5 text-sm font-medium text-gray-700">
                {imovel.guests || 2} hóspede(s) · {imovel.bedrooms || 1} quarto(s) ·{' '}
                {imovel.beds || 1} cama(s) · {imovel.bathrooms || 1} banheiro(s)
              </p>
            </section>

            <section className="border-b border-gray-200 pb-8">
              <h2 className="mb-3 text-lg font-semibold">Sobre este espaço</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-gray-700">
                {imovel.description}
              </p>
            </section>

            <section>
              <h2 className="mb-1 text-lg font-semibold">Onde você estará</h2>
              <p className="mb-4 text-sm text-gray-600">
                {imovel.street ? `${imovel.street}, ${imovel.street_number || 'S/N'} - ` : ''}
                {imovel.neighborhood ? `${imovel.neighborhood}, ` : ''}
                {imovel.location}
              </p>
              <div className="h-80 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                <iframe
                  title="Localização aproximada do imóvel"
                  loading="lazy"
                  className="h-full w-full border-0"
                  src={urlMapa.toString()}
                />
              </div>
            </section>
          </div>

          <div>
            <WidgetReserva imovel={imovel} />
          </div>
        </div>
      </main>

      {verTodasFotos && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-6">
          <div className="mx-auto max-w-4xl">
            <div className="sticky top-0 mb-6 flex items-center justify-between border-b bg-white py-4">
              <button
                type="button"
                onClick={() => setVerTodasFotos(false)}
                className="rounded-full px-4 py-2 text-sm font-bold hover:bg-gray-100"
              >
                ← Voltar ao anúncio
              </button>
              <span className="text-sm font-semibold">{fotos.length} fotos</span>
            </div>
            <div className="space-y-4">
              {fotos.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Foto ${index + 1} do imóvel`}
                  className="w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
