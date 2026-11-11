'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ModalEditarImovel from './ModalEditarImovel';
import ModalCalendarioProprietario from './ModalCalendarioProprietario';
import BotaoAtivarImovel from './BotaoAtivarImovel';
import GaleriaCard from '../marketplace/GaleriaCard';
import LogoGoFerias from '@/components/LogoGoFerias';

type Imovel = {
  id: string;
  title: string;
  location: string;
  price_per_night: number | string;
  cleaning_fee?: number | string | null;
  is_active: boolean;
  images?: unknown;
  image_url?: string | null;
  [key: string]: unknown;
};

type Reserva = {
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  nights: number | null;
  cleaning_fee: number | string | null;
  total_price: number | string | null;
  status?: string | null;
};

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AreaAnfitriao() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [urlAirbnb, setUrlAirbnb] = useState('');
  const [textoManual, setTextoManual] = useState('');
  const [mostrarTextoManual, setMostrarTextoManual] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [carregandoImportacao, setCarregandoImportacao] = useState(false);
  const [erroDados, setErroDados] = useState('');
  const [solicitacaoAtualizacao, setSolicitacaoAtualizacao] = useState(0);
  const [imovelEditando, setImovelEditando] = useState<Imovel | null>(null);
  const [imovelCalendario, setImovelCalendario] = useState<Imovel | null>(null);

  useEffect(() => {
    let ativo = true;

    const carregarDadosUsuario = async () => {
      try {
        const { data: { user }, error: erroUsuario } = await supabase.auth.getUser();
        if (erroUsuario) throw erroUsuario;
        if (!ativo) return;
        if (!user) {
          router.push('/');
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || '');

        const { data: dadosImoveis, error: erroImoveis } = await supabase
          .from('properties')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (erroImoveis) throw erroImoveis;
        if (!ativo) return;

        const listaImoveis = (dadosImoveis || []) as Imovel[];
        setImoveis(listaImoveis);

        if (listaImoveis.length === 0) {
          setReservas([]);
          return;
        }

        const { data: dadosReservas, error: erroReservas } = await supabase
          .from('bookings')
          .select('id, property_id, check_in, check_out, nights, cleaning_fee, total_price, status')
          .in('property_id', listaImoveis.map((imovel) => imovel.id));

        if (erroReservas) throw erroReservas;
        if (!ativo) return;
        setReservas((dadosReservas || []) as Reserva[]);
        setErroDados('');
      } catch (error) {
        if (!ativo) return;
        console.error('Erro ao carregar painel do anfitrião:', error);
        setErroDados('Não foi possível carregar seus anúncios e reservas. Tente novamente.');
      } finally {
        if (ativo) setCarregandoDados(false);
      }
    };

    void carregarDadosUsuario();
    return () => {
      ativo = false;
    };
  }, [router, solicitacaoAtualizacao]);

  const recarregarDadosUsuario = () => {
    setCarregandoDados(true);
    setErroDados('');
    setReservas([]);
    setSolicitacaoAtualizacao((atualizacao) => atualizacao + 1);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pagamento') === 'sucesso' && params.get('imovelId')) {
      window.alert('Retorno do checkout recebido. A confirmação do pagamento será processada pelo Mercado Pago.');
      window.history.replaceState({}, '', '/anfitriao');
    }

  }, []);

  const handleImportar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCarregandoImportacao(true);

    try {
      const response = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlAirbnb, userId, textoManual }),
      });
      const data = await response.json();

      if (data.bloqueioAirbnb) {
        setMostrarTextoManual(true);
        window.alert(data.error);
        return;
      }
      if (!response.ok) {
        window.alert(data.error || 'Erro ao importar.');
        return;
      }

      if (data.precisaAtivar) {
        window.alert('Anúncio salvo como rascunho. Ative por R$ 69,96/mês.');
      }

      setUrlAirbnb('');
      setTextoManual('');
      setMostrarTextoManual(false);
      recarregarDadosUsuario();
    } catch (error) {
      console.error('Erro ao importar anúncio:', error);
      window.alert('Erro de conexão ao importar o anúncio.');
    } finally {
      setCarregandoImportacao(false);
    }
  };

  const imoveisAtivos = imoveis.filter((imovel) => imovel.is_active).length;
  const resumoFinanceiro = useMemo(() => {
    const reservasValidas = reservas.filter((reserva) => reserva.status !== 'blocked');
    const totalRecebido = reservasValidas.reduce(
      (soma, reserva) => soma + (Number(reserva.total_price) || 0),
      0
    );
    const baseComissao = reservasValidas.reduce((soma, reserva) => {
      const totalReserva = Number(reserva.total_price) || 0;
      const taxaLimpeza = Number(reserva.cleaning_fee) || 0;
      return soma + Math.max(totalReserva - taxaLimpeza, 0);
    }, 0);
    const comissao = baseComissao * 0.1;

    return {
      totalRecebido,
      comissao,
      repasse: totalRecebido - comissao,
    };
  }, [reservas]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <LogoGoFerias subtitulo="Modo Anfitrião" />
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Navegação do anfitrião">
            <Link
              href="/marketplace"
              className="rounded-full px-3 py-2 text-xs font-semibold text-[#155E75] transition hover:bg-slate-100 sm:px-4 sm:text-sm"
            >
              Mudar para viajante
            </Link>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
              className="rounded-full px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:px-4 sm:text-sm"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#E87722]">
              Painel do anfitrião
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Visão geral
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Acompanhe seus anúncios, reservas e valores de repasse.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{imoveisAtivos}</span> ativo(s)
            <span className="mx-1.5 text-slate-300">/</span>
            {imoveis.length} anúncio(s)
          </p>
        </section>

        {erroDados && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{erroDados}</span>
            <button
              type="button"
              onClick={recarregarDadosUsuario}
              className="self-start font-semibold underline sm:self-auto"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <section aria-labelledby="resumo-financeiro-titulo" className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="resumo-financeiro-titulo" className="text-lg font-bold text-slate-900">
                Resumo financeiro
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Valores acumulados das reservas registradas, excluindo bloqueios de calendário.
              </p>
            </div>
            <span className="text-xs text-slate-500">Comissão: 10% somente sobre as diárias</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Total bruto recebido</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700" aria-hidden="true">
                  ↑
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-slate-950">
                {carregandoDados ? '—' : formatarMoeda(resumoFinanceiro.totalRecebido)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Reservas registradas, incluindo limpeza</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Comissão GoFérias</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-700" aria-hidden="true">
                  10%
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-slate-950">
                {carregandoDados ? '—' : formatarMoeda(resumoFinanceiro.comissao)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Calculada apenas sobre o valor das diárias</p>
            </article>

            <article className="rounded-2xl border border-[#155E75]/15 bg-[#155E75] p-5 text-white shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">Repasse estimado</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg" aria-hidden="true">
                  →
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight">
                {carregandoDados ? '—' : formatarMoeda(resumoFinanceiro.repasse)}
              </p>
              <p className="mt-2 text-xs text-white/75">Após comissão; limpeza integral incluída</p>
            </article>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            O cálculo considera 10% sobre as diárias. A taxa de limpeza é somada integralmente ao repasse, sem comissão.
          </p>
        </section>

        <section aria-labelledby="importar-anuncio-titulo" className="mb-10">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 id="importar-anuncio-titulo" className="font-bold text-slate-900">
                Adicione um espaço
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Importe os dados de um anúncio existente para começar.
              </p>
            </div>
            <form onSubmit={handleImportar} className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="url-airbnb" className="sr-only">Link do anúncio</label>
                <input
                  id="url-airbnb"
                  type="url"
                  required
                  value={urlAirbnb}
                  onChange={(event) => setUrlAirbnb(event.target.value)}
                  placeholder="Cole o link do anúncio (https://...)"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#155E75] focus:ring-2 focus:ring-[#155E75]/10"
                />
                <button
                  type="submit"
                  disabled={carregandoImportacao || !userId}
                  className="rounded-xl bg-[#E87722] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d16617] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {carregandoImportacao ? 'Importando...' : 'Importar espaço'}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  aria-expanded={mostrarTextoManual}
                  onClick={() => setMostrarTextoManual((visivel) => !visivel)}
                  className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900"
                >
                  {mostrarTextoManual ? 'Ocultar descrição manual' : 'Prefere? Cole a descrição manualmente'}
                </button>
                {mostrarTextoManual && (
                  <label className="mt-3 block">
                    <span className="sr-only">Descrição do anúncio</span>
                    <textarea
                      rows={4}
                      value={textoManual}
                      onChange={(event) => setTextoManual(event.target.value)}
                      placeholder="Cole aqui o texto e as informações do anúncio..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#155E75] focus:ring-2 focus:ring-[#155E75]/10"
                    />
                  </label>
                )}
              </div>
            </form>
          </div>
        </section>

        <section aria-labelledby="anuncios-titulo">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="anuncios-titulo" className="text-lg font-bold text-slate-900">
                Seus anúncios
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Gerencie detalhes, calendário e publicação dos seus espaços.
              </p>
            </div>
          </div>

          {carregandoDados ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" role="status">
              Carregando seus anúncios...
            </div>
          ) : imoveis.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">
                +
              </span>
              <h3 className="font-semibold text-slate-900">Seu primeiro espaço começa aqui</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Importe um anúncio pelo formulário acima para organizar fotos, preços e disponibilidade neste painel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {imoveis.map((imovel) => {
                const imovelCincoFotos = {
                  ...imovel,
                  images: Array.isArray(imovel.images) ? imovel.images.slice(0, 5) : [],
                };
                const limpeza = Number(imovel.cleaning_fee) || 0;

                return (
                  <article
                    key={imovel.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      <GaleriaCard imovel={imovelCincoFotos} />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
                        <span className={`h-2 w-2 rounded-full ${imovel.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {imovel.is_active ? 'Publicado' : 'Rascunho'}
                      </span>
                    </div>

                    <div className="p-5">
                      <p className="mb-1 text-xs font-medium text-slate-500">{imovel.location}</p>
                      <h3 className="line-clamp-1 text-base font-bold text-slate-900">{imovel.title}</h3>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                        <div>
                          <span className="block text-[11px] text-slate-500">Diária</span>
                          <strong className="mt-0.5 block text-sm text-slate-900">
                            {formatarMoeda(Number(imovel.price_per_night) || 0)}
                          </strong>
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="block text-[11px] text-slate-500">Taxa de limpeza</span>
                          <strong className="mt-0.5 block text-sm text-slate-900">{formatarMoeda(limpeza)}</strong>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => setImovelCalendario(imovel)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#155E75] hover:bg-slate-50"
                        >
                          Calendário
                        </button>
                        <button
                          type="button"
                          onClick={() => setImovelEditando(imovel)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#155E75] hover:bg-slate-50"
                        >
                          Editar anúncio
                        </button>
                        {!imovel.is_active && (
                          <BotaoAtivarImovel imovel={imovel} userEmail={userEmail} />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {imovelEditando && (
        <ModalEditarImovel
          imovel={imovelEditando}
          onClose={() => setImovelEditando(null)}
          onSalvo={recarregarDadosUsuario}
        />
      )}
      {imovelCalendario && (
        <ModalCalendarioProprietario
          imovel={imovelCalendario}
          userId={userId}
          onClose={() => setImovelCalendario(null)}
        />
      )}
    </div>
  );
}
