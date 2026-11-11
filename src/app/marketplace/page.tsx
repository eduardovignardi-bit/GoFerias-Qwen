'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GaleriaCard from './GaleriaCard';
import LogoGoFerias from '@/components/LogoGoFerias';

export default function Marketplace() {
  const router = useRouter();
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [coordsMapa, setCoordsMapa] = useState({ lat: -27.5954, lon: -48.548 });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarImoveisAtivos();
  }, []);

  const buscarImoveisAtivos = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setImoveis(data);
        if (data[0]?.location && data[0].location !== 'Não informada') {
          atualizarCoordenadasMapa(data[0].location);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
    } finally {
      setCarregando(false);
    }
  };

  const atualizarCoordenadasMapa = async (cidade: string) => {
    try {
      const res = await fetch(
        `https://openstreetmap.org{encodeURIComponent(cidade)}&limit=1`
      );
      const dados = await res.json();
      if (dados && dados[0]) {
        setCoordsMapa({ lat: parseFloat(dados[0].lat), lon: parseFloat(dados[0].lon) });
      }
    } catch {}
  };

  const imoveisFiltrados = imoveis.filter(
    (i) =>
      i.title.toLowerCase().includes(busca.toLowerCase()) ||
      i.location.toLowerCase().includes(busca.toLowerCase())
  );

  const bbox = `${coordsMapa.lon - 0.12},${coordsMapa.lat - 0.12},${coordsMapa.lon + 0.12},${coordsMapa.lat + 0.12}`;

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans flex flex-col">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-40">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <LogoGoFerias />

          <div className="hidden sm:flex items-center border border-gray-300 rounded-full px-4 py-2 shadow-xs hover:shadow-md transition w-full max-w-md">
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                if (e.target.value.length > 3) atualizarCoordenadasMapa(e.target.value);
              }}
              placeholder="Para onde você vai? (Ex: Florianópolis, São Paulo)"
              className="w-full text-sm focus:outline-none bg-transparent"
            />
            <span className="w-8 h-8 rounded-full bg-[#E87722] text-white flex items-center justify-center text-xs font-bold shrink-0">
              🔍
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/anfitriao" className="text-sm font-semibold text-[#155E75] hover:bg-gray-100 px-4 py-2 rounded-full transition">
              Anuncie seu espaço
            </Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-sm font-medium text-gray-500 hover:text-black">
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto">
        <main className="w-full lg:w-3/5 px-6 py-8">
          <p className="text-xs font-semibold text-gray-500 mb-6">
            {imoveisFiltrados.length} acomodação(ões) disponível(is)
          </p>

          {carregando ? (
            <p className="text-gray-500 text-sm">Carregando acomodações...</p>
          ) : imoveisFiltrados.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-semibold text-gray-800">Nenhuma acomodação encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10">
              {imoveisFiltrados.map((imovel) => {
                const imovelCincoFotos = {
                  ...imovel,
                  images: Array.isArray(imovel.images) ? imovel.images.slice(0, 5) : [],
                };

                return (
                  <Link
                    href={`/imovel/${imovel.id}`}
                    key={imovel.id}
                    onMouseEnter={() => {
                      if (imovel.location && imovel.location !== 'Não informada') {
                        atualizarCoordenadasMapa(imovel.location);
                      }
                    }}
                    className="group cursor-pointer flex flex-col"
                  >
                    <div className="rounded-2xl overflow-hidden aspect-4/3 bg-gray-100 mb-3">
                      <GaleriaCard imovel={imovelCincoFotos} />
                    </div>

                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-[15px] text-gray-900 line-clamp-1">{imovel.location}</h3>
                      <span className="text-xs font-medium text-gray-800 shrink-0">★ Novo</span>
                    </div>

                    <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{imovel.title}</p>

                    <div className="mt-1.5 flex items-baseline gap-1">
                      <strong className="font-semibold text-[15px] text-gray-900">R$ {imovel.price_per_night}</strong>
                      <span className="text-sm text-gray-600">noite</span>
                      {Number(imovel.cleaning_fee) > 0 && (
                        <span className="text-xs text-gray-400 ml-1">(+ R$ {imovel.cleaning_fee} limpeza)</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>

        <aside className="hidden lg:block lg:w-2/5 sticky top-20 h-[calc(100vh-5rem)] border-l border-gray-200 bg-gray-100">
          <iframe
            title="Mapa interativo"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={`https://openstreetmap.org{bbox}&layer=mapnik&marker=${coordsMapa.lat},${coordsMapa.lon}`}
          />
        </aside>
      </div>
    </div>
  );
}
