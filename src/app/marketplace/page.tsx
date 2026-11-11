'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GaleriaCard from './GaleriaCard';
import LogoGoFerias from '@/components/LogoGoFerias';

type Coordenadas = {
  lat: number;
  lon: number;
};

type Imovel = {
  id: string;
  title?: string | null;
  location?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lon?: number | string | null;
  price_per_night?: number | string | null;
  cleaning_fee?: number | string | null;
  images?: unknown;
  [key: string]: unknown;
};

const COORDENADAS_PADRAO: Coordenadas = { lat: -27.5954, lon: -48.548 };

function coordenadasValidas(lat: unknown, lon: unknown): Coordenadas | null {
  if ((typeof lat !== 'number' && typeof lat !== 'string') ||
      (typeof lon !== 'number' && typeof lon !== 'string') ||
      String(lat).trim() === '' ||
      String(lon).trim() === '') {
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

function obterCoordenadasImovel(imovel: Imovel): Coordenadas | null {
  return (
    coordenadasValidas(imovel.latitude, imovel.longitude) ||
    coordenadasValidas(imovel.lat, imovel.lon)
  );
}

function obterEnderecoImovel(imovel: Imovel): string {
  if (imovel.street && imovel.city) {
    return [imovel.street, imovel.city, imovel.state, 'Brasil'].filter(Boolean).join(', ');
  }
  return imovel.cep || imovel.location || '';
}

export default function Marketplace() {
  const router = useRouter();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [busca, setBusca] = useState('');
  const [termoMapa, setTermoMapa] = useState('');
  const [coordsMapa, setCoordsMapa] = useState<Coordenadas>(COORDENADAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erroMapa, setErroMapa] = useState('');
  const requisicaoMapa = useRef(0);

  useEffect(() => {
    let ativo = true;

    const buscarImoveisAtivos = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!ativo) return;

        const lista = (data || []) as Imovel[];
        setImoveis(lista);
        const primeiro = lista[0];
        if (primeiro) {
          const coordenadas = obterCoordenadasImovel(primeiro);
          if (coordenadas) {
            setCoordsMapa(coordenadas);
          } else {
            setTermoMapa(obterEnderecoImovel(primeiro));
          }
        }
      } catch (error) {
        if (ativo) console.error('Erro ao buscar imóveis:', error);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void buscarImoveisAtivos();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!termoMapa.trim()) return;

    const idRequisicao = ++requisicaoMapa.current;
    const temporizador = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/mapa?q=${encodeURIComponent(termoMapa.trim())}`);
        if (!response.ok) {
          throw new Error(`Falha ao localizar o endereço (HTTP ${response.status}).`);
        }

        const dados: unknown = await response.json();
        if (!dados || typeof dados !== 'object' || !('lat' in dados) || !('lon' in dados)) {
          throw new Error('A resposta do serviço de mapas não contém coordenadas válidas.');
        }

        const coordenadas = coordenadasValidas(dados.lat, dados.lon);
        if (!coordenadas) {
          throw new Error('O serviço de mapas retornou coordenadas inválidas.');
        }

        if (idRequisicao === requisicaoMapa.current) {
          setCoordsMapa(coordenadas);
          setErroMapa('');
        }
      } catch (error) {
        if (idRequisicao === requisicaoMapa.current) {
          console.error('Erro ao atualizar coordenadas do mapa:', error);
          setErroMapa('Não foi possível localizar esse endereço. Exibindo a última localização válida.');
        }
      }
    }, 1000);

    return () => window.clearTimeout(temporizador);
  }, [termoMapa]);

  const selecionarImovelNoMapa = (imovel: Imovel) => {
    const coordenadas = obterCoordenadasImovel(imovel);
    if (coordenadas) {
      requisicaoMapa.current++;
      setCoordsMapa(coordenadas);
      setTermoMapa('');
      setErroMapa('');
      return;
    }

    const endereco = obterEnderecoImovel(imovel);
    if (endereco) setTermoMapa(endereco);
  };

  const imoveisFiltrados = imoveis.filter((imovel) => {
    const termoBusca = busca.toLocaleLowerCase();
    return (
      (imovel.title || '').toLocaleLowerCase().includes(termoBusca) ||
      (imovel.location || '').toLocaleLowerCase().includes(termoBusca)
    );
  });

  const bbox = [
    coordsMapa.lon - 0.08,
    coordsMapa.lat - 0.08,
    coordsMapa.lon + 0.08,
    coordsMapa.lat + 0.08,
  ].join(',');
  const urlMapa = new URL('https://www.openstreetmap.org/export/embed.html');
  urlMapa.searchParams.set('bbox', bbox);
  urlMapa.searchParams.set('layer', 'mapnik');
  urlMapa.searchParams.set('marker', `${coordsMapa.lat},${coordsMapa.lon}`);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#222222]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <LogoGoFerias />

          <div className="hidden w-full max-w-md items-center rounded-full border border-gray-300 px-4 py-2 shadow-xs transition hover:shadow-md sm:flex">
            <label htmlFor="busca-destino" className="sr-only">Buscar acomodação ou destino</label>
            <input
              id="busca-destino"
              type="search"
              value={busca}
              onChange={(event) => {
                const valor = event.target.value;
                setBusca(valor);
                setTermoMapa(valor.trim().length > 3 ? valor : '');
              }}
              placeholder="Para onde você vai? (Ex: Florianópolis, São Paulo)"
              className="w-full bg-transparent text-sm outline-none"
            />
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E87722] text-xs font-bold text-white">
              🔍
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-4" aria-label="Navegação principal">
            <Link href="/viagens" className="rounded-full px-2.5 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 sm:px-3.5 sm:text-sm">
              Minhas Viagens
            </Link>
            <Link href="/anfitriao" className="rounded-full px-2.5 py-2 text-xs font-semibold text-[#155E75] transition hover:bg-gray-100 sm:px-3.5 sm:text-sm">
              Anuncie seu espaço
            </Link>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="px-2 py-2 text-xs font-medium text-gray-500 transition hover:text-black sm:text-sm"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        <main className="w-full px-4 py-8 sm:px-6 lg:w-3/5">
          <p className="mb-6 text-xs font-semibold text-gray-500">
            {imoveisFiltrados.length} acomodação(ões) disponível(is)
          </p>

          {carregando ? (
            <p className="text-sm text-gray-500" role="status">Carregando acomodações...</p>
          ) : imoveisFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-gray-800">Nenhuma acomodação encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
              {imoveisFiltrados.map((imovel) => {
                const imovelCincoFotos = {
                  ...imovel,
                  images: Array.isArray(imovel.images) ? imovel.images.slice(0, 5) : [],
                };

                return (
                  <Link
                    key={imovel.id}
                    href={`/imovel/${imovel.id}`}
                    onMouseEnter={() => selecionarImovelNoMapa(imovel)}
                    onFocus={() => selecionarImovelNoMapa(imovel)}
                    className="group flex cursor-pointer flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#155E75] focus-visible:ring-offset-4"
                  >
                    <div className="mb-3 aspect-4/3 overflow-hidden rounded-2xl bg-gray-100">
                      <GaleriaCard imovel={imovelCincoFotos} mostrarControles={false} />
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-1 text-[15px] font-semibold text-gray-900">
                        {imovel.location || 'Localização não informada'}
                      </h2>
                      <span className="shrink-0 text-xs font-medium text-gray-800">★ Novo</span>
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{imovel.title || 'Acomodação'}</p>

                    <div className="mt-1.5 flex flex-wrap items-baseline gap-1">
                      <strong className="text-[15px] font-semibold text-gray-900">
                        R$ {Number(imovel.price_per_night || 0).toLocaleString('pt-BR')}
                      </strong>
                      <span className="text-sm text-gray-600">noite</span>
                      {Number(imovel.cleaning_fee) > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          (+ R$ {Number(imovel.cleaning_fee).toLocaleString('pt-BR')} limpeza)
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>

        <aside className="w-full border-t border-gray-200 bg-gray-100 p-4 lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:min-h-[500px] lg:w-2/5 lg:border-l lg:border-t-0 lg:p-0">
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <h2 className="text-sm font-semibold text-gray-800">Mapa das acomodações</h2>
            <span className="text-xs text-gray-500">Arraste para explorar</span>
          </div>
          {erroMapa && (
            <p className="mb-2 text-xs text-amber-800" role="status">{erroMapa}</p>
          )}
          <iframe
            key={`${coordsMapa.lat},${coordsMapa.lon}`}
            title="Mapa interativo das acomodações"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[420px] w-full rounded-xl border-0 bg-gray-100 lg:h-full lg:rounded-none"
            src={urlMapa.toString()}
          />
        </aside>
      </div>
    </div>
  );
}
