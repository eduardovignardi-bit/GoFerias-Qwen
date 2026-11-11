'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LogoGoFerias from '@/components/LogoGoFerias';
import WidgetReserva from './WidgetReserva';

export default function ConteudoImovel() {
  const params = useParams();
  const router = useRouter();
  const [imovel, setImovel] = useState<any | null>(null);
  const [coords, setCoords] = useState({ lat: -27.5954, lon: -48.548 });
  const [carregando, setCarregando] = useState(true);
  const [verTodasFotos, setVerTodasFotos] = useState(false);

  useEffect(() => {
    if (params?.id) buscarDetalhes(params.id as string);
  }, [params?.id]);

  const buscarDetalhes = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setImovel(data);

      const buscaMapa =
        data.street && data.city
          ? `${data.street}, ${data.city}, ${data.state}, Brasil`
          : data.cep || data.location;

      if (buscaMapa) {
        const res = await fetch(
          `https://openstreetmap.org{encodeURIComponent(buscaMapa)}&limit=1`
        );
        const geo = await res.json();
        if (geo && geo) {
          setCoords({ lat: parseFloat(geo.lat), lon: parseFloat(geo.lon) });
        }
      }
    } catch {
      router.push('/marketplace');
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Carregando anúncio...
      </div>
    );
  }

  if (!imovel) return null;

  const fotos: string[] =
    Array.isArray(imovel.images) && imovel.images.length > 0
      ? imovel.images
      : imovel.image_url
      ? [imovel.image_url]
      : [];

  const bbox = `${coords.lon - 0.015},${coords.lat - 0.015},${coords.lon + 0.015},${coords.lat + 0.015}`;

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/marketplace">
            <LogoGoFerias />
          </Link>
          <Link href="/marketplace" className="text-sm font-semibold text-gray-700 hover:underline">
            ← Voltar para acomodações
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{imovel.title}</h1>
        <p className="text-sm font-medium text-gray-600 underline mt-1 mb-6">
          {imovel.neighborhood ? `${imovel.neighborhood}, ` : ''}
          {imovel.location} {imovel.cep ? `· CEP ${imovel.cep}` : ''}
        </p>

        {fotos.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-4 gap-2 h-[320px] sm:h-[420px] mb-10 bg-gray-100">
            <div className="md:col-span-2 h-full">
              <img src={fotos} alt="Principal" className="w-full h-full object-cover" />
            </div>
            <div className="hidden md:grid grid-rows-2 gap-2 h-full">
              {fotos && <img src={fotos} alt="Foto 2" className="w-full h-full object-cover" />}
              {fotos && <img src={fotos} alt="Foto 3" className="w-full h-full object-cover" />}
            </div>
            <div className="hidden md:grid grid-rows-2 gap-2 h-full">
              {fotos && <img src={fotos} alt="Foto 4" className="w-full h-full object-cover" />}
              {fotos && <img src={fotos} alt="Foto 5" className="w-full h-full object-cover" />}
            </div>

            {fotos.length > 1 && (
              <button
                type="button"
                onClick={() => setVerTodasFotos(true)}
                className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-gray-900 border border-black px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition"
              >
                Mostrar todas as {fotos.length} fotos
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="pb-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Espaço inteiro · Hospedagem verificada</h2>
              <p className="text-sm text-gray-700 mt-1.5 font-medium">
                {imovel.guests || 2} hóspede(s) · {imovel.bedrooms || 1} quarto(s) · {imovel.beds || 1} cama(s) · {imovel.bathrooms || 1} banheiro(s)
              </p>
            </div>

            <div className="pb-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold mb-3">Sobre este espaço</h3>
              <p className="text-gray-700 text-[15px] leading-relaxed whitespace-pre-line">
                {imovel.description}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-1">Onde você estará</h3>
              <p className="text-sm text-gray-600 mb-4">
                {imovel.street ? `${imovel.street}, ${imovel.street_number || 'S/N'} - ` : ''}
                {imovel.neighborhood ? `${imovel.neighborhood}, ` : ''}
                {imovel.location}
              </p>
              <div className="h-80 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                <iframe
                  title="Localização exata"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src={`https://openstreetmap.org{bbox}&layer=mapnik&marker=${coords.lat},${coords.lon}`}
                />
              </div>
            </div>
          </div>

          <div>
            <WidgetReserva imovel={imovel} />
          </div>
        </div>
      </main>

      {verTodasFotos && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center sticky top-0 bg-white py-4 border-b mb-6">
              <button onClick={() => setVerTodasFotos(false)} className="text-sm font-bold px-4 py-2 rounded-full hover:bg-gray-100">
                ← Voltar ao anúncio
              </button>
              <span className="text-sm font-semibold">{fotos.length} fotos</span>
            </div>
            <div className="space-y-4">
              {fotos.map((url, idx) => (
                <img key={idx} src={url} alt={`Foto ${idx + 1}`} className="w-full rounded-2xl object-cover" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
