'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ADDITIONAL_PROPERTY_MONTHLY_PRICE,
  PLATFORM_COMMISSION_RATE,
} from '@/lib/billing';
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
  is_paid_slot?: boolean | null;
  created_at?: string | null;
  images?: unknown;
  image_url?: string | null;
};

type Reserva = {
  id: string;
  property_id: string;
  guest_id?: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  cleaning_fee: number | string | null;
  total_price: number | string | null;
  status?: string | null;
};

type AbaPainel = 'visao-geral' | 'imoveis' | 'reservas' | 'assinatura';

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarData = (valor: string) =>
  new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');

export default function AreaAnfitriao() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [urlAirbnb, setUrlAirbnb] = useState('');
  const [textoManual, setTextoManual] = useState('');
  const [mostrarTextoManual, setMostrarTextoManual] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [emailsHospedes, setEmailsHospedes] = useState<Record<string, string>>({});
  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('visao-geral');
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
        const { data: dadosImoveis, error: erroImoveis } = await supabase
          .from('properties')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (erroImoveis) throw erroImoveis;
        if (!ativo) return;

        const listaImoveis = (dadosImoveis || []) as Imovel[];
        setImoveis(listaImoveis);
        setErroDados('');

        if (listaImoveis.length === 0) {
          setReservas([]);
          setEmailsHospedes({});
          return;
        }

        const { data: dadosReservas, error: erroReservas } = await supabase
          .from('bookings')
          .select('id, property_id, guest_id, check_in, check_out, nights, cleaning_fee, total_price, status')
          .in('property_id', listaImoveis.map((imovel) => imovel.id))
          .order('check_in', { ascending: false });

        if (erroReservas) throw erroReservas;
        if (!ativo) return;

        const listaReservas = (dadosReservas || []) as Reserva[];
        setReservas(listaReservas);

        const idsHospedes = Array.from(
          new Set(listaReservas.map((reserva) => reserva.guest_id).filter((id): id is string => !!id))
        );
        if (idsHospedes.length > 0) {
          const { data: perfis, error: erroPerfis } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', idsHospedes);

          if (erroPerfis) {
            console.error('Erro ao carregar identificação dos hóspedes:', erroPerfis);
            setEmailsHospedes({});
          } else if (ativo) {
            setEmailsHospedes(
              Object.fromEntries(
                (perfis || [])
                  .filter((perfil) => perfil.email)
                  .map((perfil) => [perfil.id, perfil.email as string])
              )
            );
          }
        } else {
          setEmailsHospedes({});
        }
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pagamento') === 'retorno') {
      window.alert('Retorno da assinatura recebido. A ativação será confirmada após validação pelo Mercado Pago.');
      window.history.replaceState({}, '', '/anfitriao');
    }
  }, []);

  const recarregarDadosUsuario = () => {
    setCarregandoDados(true);
    setErroDados('');
    setReservas([]);
    setSolicitacaoAtualizacao((atualizacao) => atualizacao + 1);
  };

  const handleImportar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCarregandoImportacao(true);

    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) {
        window.alert('Sua sessão expirou. Entre novamente para importar um anúncio.');
        return;
      }

      const response = await fetch('/api/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: urlAirbnb, textoManual }),
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
        window.alert('Anúncio salvo como rascunho. Assine por R$ 69,96/mês para publicá-lo.');
      } else {
        window.alert('Seu primeiro imóvel foi cadastrado gratuitamente.');
      }

      setUrlAirbnb('');
      setTextoManual('');
      setMostrarTextoManual(false);
      setAbaAtiva('imoveis');
      recarregarDadosUsuario();
    } catch (error) {
      console.error('Erro ao importar anúncio:', error);
      window.alert('Erro de conexão ao importar o anúncio.');
    } finally {
      setCarregandoImportacao(false);
    }
  };

  const primeiroImovelId = useMemo(
    () =>
      [...imoveis]
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0]?.id,
    [imoveis]
  );
  const ehImovelAdicional = (imovel: Imovel) =>
    imovel.is_paid_slot ?? imovel.id !== primeiroImovelId;
  const imoveisAtivos = imoveis.filter((imovel) => imovel.is_active);
  const imoveisAdicionaisAtivos = imoveisAtivos.filter(ehImovelAdicional);
  const imoveisAdicionaisPendentes = imoveis.filter(
    (imovel) => ehImovelAdicional(imovel) && !imovel.is_active
  );
  const vagasGratuitasUtilizadas = imoveis.some((imovel) => !ehImovelAdicional(imovel)) ? 1 : 0;
  const mensalidadeAtual = imoveisAdicionaisAtivos.length * ADDITIONAL_PROPERTY_MONTHLY_PRICE;

  const resumoFinanceiro = useMemo(() => {
    const reservasValidas = reservas.filter((reserva) => reserva.status !== 'blocked');
    const totalBruto = reservasValidas.reduce(
      (soma, reserva) => soma + (Number(reserva.total_price) || 0),
      0
    );
    const taxaLimpeza = reservasValidas.reduce(
      (soma, reserva) => soma + (Number(reserva.cleaning_fee) || 0),
      0
    );
    const valorDiarias = reservasValidas.reduce(
      (soma, reserva) =>
        soma + Math.max((Number(reserva.total_price) || 0) - (Number(reserva.cleaning_fee) || 0), 0),
      0
    );
    const comissao = valorDiarias * PLATFORM_COMMISSION_RATE;

    return {
      totalBruto,
      taxaLimpeza,
      comissao,
      repasse: totalBruto - comissao,
    };
  }, [reservas]);

  const reservasRecentes = [...reservas]
    .filter((reserva) => reserva.status !== 'blocked')
    .slice(0, 5);

  const renderTabelaReservas = (lista: Reserva[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {lista.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500" aria-hidden="true">
            ▤
          </span>
          <h3 className="font-semibold text-slate-900">Nenhuma reserva registrada</h3>
          <p className="mt-1 text-sm text-slate-500">Quando houver reservas, o extrato aparecerá aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-4">Hóspede / imóvel</th>
                <th scope="col" className="px-5 py-4">Check-in / check-out</th>
                <th scope="col" className="px-5 py-4 text-right">Diárias</th>
                <th scope="col" className="px-5 py-4 text-right">Taxa de limpeza</th>
                <th scope="col" className="px-5 py-4 text-right">Comissão (10%)</th>
                <th scope="col" className="px-5 py-4 text-right">Repasse líquido</th>
                <th scope="col" className="px-5 py-4">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((reserva) => {
                const imovel = imoveis.find((item) => item.id === reserva.property_id);
                const limpeza = Number(reserva.cleaning_fee) || 0;
                const bruto = Number(reserva.total_price) || 0;
                const diarias = Math.max(bruto - limpeza, 0);
                const comissao = diarias * PLATFORM_COMMISSION_RATE;
                const noites = reserva.nights ?? Math.max(
                  Math.round(
                    (new Date(`${reserva.check_out}T12:00:00`).getTime() -
                      new Date(`${reserva.check_in}T12:00:00`).getTime()) / 86400000
                  ),
                  0
                );
                const status = reserva.status?.toLowerCase();
                const statusPagamento =
                  status === 'paid' || status === 'approved'
                    ? 'Confirmado'
                    : status === 'pending'
                      ? 'Pendente'
                      : status === 'blocked'
                        ? 'Bloqueio'
                        : 'Não informado';
                const statusClass =
                  statusPagamento === 'Confirmado'
                    ? 'bg-emerald-50 text-emerald-700'
                    : statusPagamento === 'Pendente'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600';

                return (
                  <tr key={reserva.id} className="align-top text-slate-700">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {reserva.guest_id
                          ? emailsHospedes[reserva.guest_id] || `Hóspede ${reserva.guest_id.slice(0, 8)}`
                          : 'Hóspede não identificado'}
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                        {imovel?.title || 'Imóvel indisponível'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs leading-5">
                      <span className="block">{formatarData(reserva.check_in)}</span>
                      <span className="block text-slate-500">{formatarData(reserva.check_out)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <strong className="block font-semibold text-slate-900">{formatarMoeda(diarias)}</strong>
                      <span className="text-xs text-slate-500">{noites} {noites === 1 ? 'diária' : 'diárias'}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">{formatarMoeda(limpeza)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">{formatarMoeda(comissao)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                      {formatarMoeda(bruto - comissao)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                        {statusPagamento}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPlano = () => {
    const imovelPendente = imoveisAdicionaisPendentes[0];

    return (
      <section aria-labelledby="plano-titulo" className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
        <div className="grid gap-8 bg-gradient-to-br from-cyan-50 via-white to-white p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">Meu plano / assinatura</p>
            <h2 id="plano-titulo" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Seus espaços, com cobrança transparente
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              O primeiro imóvel é gratuito. Cada imóvel adicional ativo custa{' '}
              {formatarMoeda(ADDITIONAL_PROPERTY_MONTHLY_PRICE)} por mês.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-white px-5 py-4 shadow-sm lg:min-w-56">
            <span className="text-sm font-medium text-slate-500">Mensalidade atual</span>
            {carregandoDados ? (
              <div className="mt-2 h-8 w-36 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatarMoeda(mensalidadeAtual)}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">por mês, conforme imóveis ativos</p>
          </div>
        </div>

        <div className="grid divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="px-6 py-5">
            <span className="text-xs font-medium text-slate-500">Imóveis ativos</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {carregandoDados ? '—' : imoveisAtivos.length}
            </p>
          </div>
          <div className="px-6 py-5">
            <span className="text-xs font-medium text-slate-500">Vaga gratuita</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {carregandoDados ? '—' : `${vagasGratuitasUtilizadas} de 1`}
            </p>
          </div>
          <div className="px-6 py-5">
            <span className="text-xs font-medium text-slate-500">Adicionais cobrados</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {carregandoDados ? '—' : imoveisAdicionaisAtivos.length}
            </p>
          </div>
          <div className="flex items-center px-6 py-5">
            {carregandoDados ? (
              <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
            ) : imovelPendente ? (
              <BotaoAtivarImovel imovel={imovelPendente} />
            ) : (
              <button
                type="button"
                onClick={() => setAbaAtiva('imoveis')}
                className="w-full rounded-xl bg-[#155E75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#104b5e]"
              >
                Adicionar imóvel adicional
              </button>
            )}
          </div>
        </div>
        {imoveisAdicionaisPendentes.length > 0 && !carregandoDados && (
          <p className="border-t border-slate-100 px-6 py-3 text-xs text-amber-800">
            {imoveisAdicionaisPendentes.length} imóvel(is) adicional(is) aguardando assinatura e ativação.
          </p>
        )}
      </section>
    );
  };

  const abas: Array<{ id: AbaPainel; label: string }> = [
    { id: 'visao-geral', label: 'Visão Geral / Financeiro' },
    { id: 'imoveis', label: 'Meus Imóveis' },
    { id: 'reservas', label: 'Reservas' },
    { id: 'assinatura', label: 'Assinatura' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
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
                const { error } = await supabase.auth.signOut();
                if (error) {
                  console.error('Erro ao encerrar sessão:', error);
                  window.alert('Não foi possível sair agora. Tente novamente.');
                  return;
                }
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
        <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#E87722]">
              Painel do anfitrião
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Olá, anfitrião
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Gerencie seus anúncios, acompanhe reservas e veja seus repasses.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{carregandoDados ? '—' : imoveisAtivos.length}</span> imóvel(is) ativo(s)
            <span className="mx-1.5 text-slate-300">/</span>
            {carregandoDados ? '—' : imoveis.length} anúncio(s)
          </p>
        </section>

        <nav className="-mx-4 mb-8 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0" aria-label="Seções do painel">
          <div className="flex min-w-max gap-1" role="tablist">
            {abas.map((aba) => (
              <button
                key={aba.id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  abaAtiva === aba.id
                    ? 'border-[#155E75] text-[#155E75]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>
        </nav>

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

        {abaAtiva === 'visao-geral' && (
          <div role="tabpanel" className="space-y-8">
            <section aria-labelledby="resumo-financeiro-titulo">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="resumo-financeiro-titulo" className="text-lg font-bold text-slate-900">
                    Resumo financeiro
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Valores acumulados das reservas, sem bloqueios de calendário.
                  </p>
                </div>
                <span className="text-xs text-slate-500">Comissão de 10% somente sobre as diárias</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Receita bruta total',
                    value: resumoFinanceiro.totalBruto,
                    detail: 'Diárias + taxa de limpeza',
                    tone: 'bg-emerald-50 text-emerald-700',
                    icon: '↑',
                  },
                  {
                    label: 'Taxa de limpeza',
                    value: resumoFinanceiro.taxaLimpeza,
                    detail: 'Repasse integral ao anfitrião',
                    tone: 'bg-sky-50 text-sky-700',
                    icon: '✓',
                  },
                  {
                    label: 'Comissão da plataforma',
                    value: resumoFinanceiro.comissao,
                    detail: '10% apenas sobre as diárias',
                    tone: 'bg-amber-50 text-amber-700',
                    icon: '10%',
                  },
                  {
                    label: 'Repasse líquido ao anfitrião',
                    value: resumoFinanceiro.repasse,
                    detail: 'Limpeza integral + diárias após comissão',
                    tone: 'bg-cyan-50 text-cyan-800',
                    icon: '→',
                  },
                ].map((kpi) => (
                  <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
                      <span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-bold ${kpi.tone}`} aria-hidden="true">
                        {kpi.icon}
                      </span>
                    </div>
                    {carregandoDados ? (
                      <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                      <p className="text-2xl font-bold tracking-tight text-slate-950">{formatarMoeda(kpi.value)}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{kpi.detail}</p>
                  </article>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                A limpeza entra na receita bruta e é repassada 100% ao anfitrião, sem desconto de comissão.
              </p>
            </section>

            {renderPlano()}

            <section aria-labelledby="reservas-recentes-titulo">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 id="reservas-recentes-titulo" className="text-lg font-bold text-slate-900">Reservas recentes</h2>
                  <p className="mt-1 text-sm text-slate-500">Extrato de valores e status registrados.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('reservas')}
                  className="shrink-0 text-sm font-semibold text-[#155E75] hover:underline"
                >
                  Ver todas
                </button>
              </div>
              {carregandoDados ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" role="status" aria-label="Carregando reservas">
                  {[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
                </div>
              ) : renderTabelaReservas(reservasRecentes)}
            </section>
          </div>
        )}

        {abaAtiva === 'imoveis' && (
          <div role="tabpanel" className="space-y-8">
            <section id="importar-imovel" aria-labelledby="importar-anuncio-titulo">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <h2 id="importar-anuncio-titulo" className="font-bold text-slate-900">Adicione um espaço</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    O primeiro anúncio é grátis; imóveis seguintes custam {formatarMoeda(ADDITIONAL_PROPERTY_MONTHLY_PRICE)}/mês cada.
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
              <div className="mb-4">
                <h2 id="anuncios-titulo" className="text-lg font-bold text-slate-900">Seus anúncios</h2>
                <p className="mt-1 text-sm text-slate-500">Gerencie detalhes, calendário, valores e publicação.</p>
              </div>

              {carregandoDados ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando imóveis">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="aspect-[4/3] animate-pulse bg-slate-100" />
                      <div className="space-y-3 p-5">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                        <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : imoveis.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">+</span>
                  <h3 className="font-semibold text-slate-900">Seu primeiro espaço começa aqui</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Importe um anúncio para começar. Seu primeiro imóvel é gratuito.
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
                    const adicional = ehImovelAdicional(imovel);

                    return (
                      <article key={imovel.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                          <GaleriaCard imovel={imovelCincoFotos} />
                          <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
                            <span className={`h-2 w-2 rounded-full ${imovel.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {imovel.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
                            adicional ? 'bg-slate-900/90 text-white' : 'bg-emerald-600/95 text-white'
                          }`}>
                            {adicional ? `Plano adicional · ${formatarMoeda(ADDITIONAL_PROPERTY_MONTHLY_PRICE)}/mês` : 'Imóvel gratuito'}
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
                            {adicional && !imovel.is_active && <BotaoAtivarImovel imovel={imovel} />}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {abaAtiva === 'reservas' && (
          <section role="tabpanel" aria-labelledby="reservas-titulo">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E87722]">Financeiro</p>
              <h2 id="reservas-titulo" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Reservas e extrato</h2>
              <p className="mt-2 text-sm text-slate-500">
                Comissão de 10% sobre diárias; a taxa de limpeza é repassada integralmente.
              </p>
            </div>
            {carregandoDados ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" role="status" aria-label="Carregando extrato">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : renderTabelaReservas(reservas.filter((reserva) => reserva.status !== 'blocked'))}
          </section>
        )}

        {abaAtiva === 'assinatura' && (
          <div role="tabpanel" className="space-y-6">
            {renderPlano()}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-slate-900">Como funciona a cobrança</h2>
              <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 sm:grid-cols-3">
                <p><strong className="text-slate-900">1º imóvel:</strong> gratuito, sem mensalidade.</p>
                <p><strong className="text-slate-900">Imóveis adicionais:</strong> {formatarMoeda(ADDITIONAL_PROPERTY_MONTHLY_PRICE)} por mês para cada imóvel ativo.</p>
                <p><strong className="text-slate-900">Ativação:</strong> a publicação do adicional ocorre após autorização da assinatura pelo Mercado Pago.</p>
              </div>
            </section>
          </div>
        )}
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
