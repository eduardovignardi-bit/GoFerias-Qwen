'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
  guest_phone?: string | null;
  guest_phone_number?: string | null;
  guest_telephone?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
};

type AbaPainel = 'visao-geral' | 'imoveis' | 'reservas' | 'assinatura';
type FiltroReserva = 'todas' | 'confirmadas' | 'pendentes' | 'canceladas';
type ToastPainel = { mensagem: string; tipo: 'sucesso' | 'erro' | 'info' } | null;

const formatarMoeda = (valor: number) =>
  (() => {
    const centavos = Math.round((Number.isFinite(valor) ? valor : 0) * 100);
    const sinal = centavos < 0 ? '-' : '';
    const valorAbsoluto = Math.abs(centavos);
    const reais = Math.floor(valorAbsoluto / 100);
    const fracao = String(valorAbsoluto % 100).padStart(2, '0');
    const reaisFormatados = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sinal}R$ ${reaisFormatados},${fracao}`;
  })();

const formatarData = (valor: string) => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return valor;
  const [, ano, mes, dia] = partes;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    data.getUTCFullYear() !== Number(ano) ||
    data.getUTCMonth() !== Number(mes) - 1 ||
    data.getUTCDate() !== Number(dia)
  ) {
    return valor;
  }
  return `${dia}/${mes}/${ano}`;
};

const diasEntreDatas = (inicio: string, fim: string) => {
  const obterTimestampUtc = (valor: string) => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (!partes) return Number.NaN;
    return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  };
  const diferenca = obterTimestampUtc(fim) - obterTimestampUtc(inicio);
  return Number.isFinite(diferenca) ? Math.round(diferenca / 86400000) : 0;
};

function statusReserva(reserva: Reserva) {
  const status = reserva.status?.toLowerCase();
  if (status === 'paid' || status === 'approved' || status === 'confirmed') {
    return { categoria: 'confirmadas' as const, rotulo: 'Confirmada' };
  }
  if (status === 'pending') return { categoria: 'pendentes' as const, rotulo: 'Pendente' };
  if (status === 'cancelled' || status === 'canceled' || status === 'rejected') {
    return { categoria: 'canceladas' as const, rotulo: 'Cancelada' };
  }
  if (status === 'blocked') return { categoria: 'bloqueadas' as const, rotulo: 'Bloqueio' };
  return { categoria: 'outras' as const, rotulo: 'Não informado' };
}

function telefoneDaReserva(reserva: Reserva) {
  return (
    reserva.guest_phone ||
    reserva.guest_phone_number ||
    reserva.guest_telephone ||
    reserva.contact_phone ||
    reserva.phone ||
    reserva.telefone ||
    reserva.whatsapp ||
    ''
  );
}

function linkWhatsApp(reserva: Reserva, tituloImovel: string) {
  const telefone = telefoneDaReserva(reserva).replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 15) return null;
  const numero = telefone.length <= 11 ? `55${telefone}` : telefone;
  const mensagem = `Olá! Estou entrando em contato sobre sua reserva de ${tituloImovel}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

function IconePainel({
  nome,
  className = 'h-5 w-5',
}: {
  nome: 'chart' | 'calendar' | 'wallet' | 'home' | 'camera' | 'external' | 'edit' | 'whatsapp' | 'plus' | 'sparkles';
  className?: string;
}) {
  const propriedades = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (nome) {
    case 'chart':
      return <svg {...propriedades}><path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" /></svg>;
    case 'calendar':
      return <svg {...propriedades}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case 'wallet':
      return <svg {...propriedades}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /></svg>;
    case 'home':
      return <svg {...propriedades}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></svg>;
    case 'camera':
      return <svg {...propriedades}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3" /></svg>;
    case 'external':
      return <svg {...propriedades}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
    case 'edit':
      return <svg {...propriedades}><path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></svg>;
    case 'whatsapp':
      return <svg {...propriedades}><path d="M20 11.5a8.4 8.4 0 0 1-12.4 7.4L4 20l1.2-3.5A8.4 8.4 0 1 1 20 11.5Z" /><path d="M9 8.5c.3 2.1 2 3.8 4.1 4.2l1-1 2 1c-.2 1.4-1.2 2.2-2.6 2.1-3.2-.3-6-3.1-6.2-6.3-.1-1.4.7-2.4 2.1-2.6l1 2-1.4.6" /></svg>;
    case 'plus':
      return <svg {...propriedades}><path d="M12 5v14M5 12h14" /></svg>;
    case 'sparkles':
      return <svg {...propriedades}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>;
  }
}

export default function AreaAnfitriao() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nomeAnfitriao, setNomeAnfitriao] = useState('');
  const [emailAnfitriao, setEmailAnfitriao] = useState('');
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
  const [filtroReserva, setFiltroReserva] = useState<FiltroReserva>('todas');
  const [reservaExpandida, setReservaExpandida] = useState<string | null>(null);
  const [imoveisAtualizando, setImoveisAtualizando] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastPainel>(null);
  const [dataReferencia, setDataReferencia] = useState<number | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMontado(true);
      setDataReferencia(Date.now());
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
        const nomeDoPerfil =
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === 'string'
              ? user.user_metadata.name
              : '';
        setEmailAnfitriao(user.email || '');
        setNomeAnfitriao(nomeDoPerfil || user.email?.split('@')[0] || 'anfitrião');
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
          .select('*')
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
      const timeout = window.setTimeout(() => {
        setToast({
          mensagem: 'Retorno da assinatura recebido. A ativação será confirmada após validação pelo Mercado Pago.',
          tipo: 'info',
        });
      }, 0);
      window.history.replaceState({}, '', '/anfitriao');
      return () => window.clearTimeout(timeout);
    }
  }, []);

  const recarregarDadosUsuario = () => {
    setCarregandoDados(true);
    setErroDados('');
    setReservas([]);
    setSolicitacaoAtualizacao((atualizacao) => atualizacao + 1);
  };

  const salvarImovelConcluido = () => {
    setToast({ mensagem: 'Alterações do imóvel salvas com sucesso.', tipo: 'sucesso' });
    recarregarDadosUsuario();
  };

  const alterarStatusImovel = async (imovel: Imovel) => {
    if (!userId || ehImovelAdicional(imovel) || imoveisAtualizando[imovel.id]) return;

    const novoStatus = !imovel.is_active;
    setImoveisAtualizando((atualizando) => ({ ...atualizando, [imovel.id]: true }));
    try {
      const { data, error } = await supabase
        .from('properties')
        .update({ is_active: novoStatus })
        .eq('id', imovel.id)
        .eq('owner_id', userId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('O anúncio não foi encontrado ou não pertence à sua conta.');

      setImoveis((atuais) =>
        atuais.map((item) => item.id === imovel.id ? { ...item, is_active: novoStatus } : item)
      );
      setToast({
        mensagem: novoStatus ? 'Anúncio ativado.' : 'Anúncio pausado.',
        tipo: 'sucesso',
      });
    } catch (error) {
      console.error('Erro ao alterar status do imóvel:', error);
      setToast({ mensagem: 'Não foi possível alterar o status do anúncio. Tente novamente.', tipo: 'erro' });
    } finally {
      setImoveisAtualizando((atualizando) => ({ ...atualizando, [imovel.id]: false }));
    }
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
        setToast({ mensagem: `Anúncio salvo como rascunho. Assine por ${formatarMoeda(ADDITIONAL_PROPERTY_MONTHLY_PRICE)}/mês para publicá-lo.`, tipo: 'info' });
      } else {
        setToast({ mensagem: 'Seu primeiro imóvel foi cadastrado gratuitamente.', tipo: 'sucesso' });
      }

      setUrlAirbnb('');
      setTextoManual('');
      setMostrarTextoManual(false);
      setAbaAtiva('imoveis');
      recarregarDadosUsuario();
    } catch (error) {
      console.error('Erro ao importar anúncio:', error);
      setToast({ mensagem: 'Erro de conexão ao importar o anúncio.', tipo: 'erro' });
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

  const indicadores = useMemo(() => {
    if (dataReferencia === null) {
      return {
        taxaOcupacao: 0,
        receitaLiquidaMes: 0,
        proximoRepasse: 0,
        dataProximoRepasse: '',
      };
    }

    const agora = new Date(dataReferencia);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    const inicioMesIso = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-01`;
    const inicioProximoMesIso = `${inicioProximoMes.getFullYear()}-${String(inicioProximoMes.getMonth() + 1).padStart(2, '0')}-01`;
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const reservasValidas = reservas.filter((reserva) => {
      const categoria = statusReserva(reserva).categoria;
      return categoria !== 'bloqueadas' && categoria !== 'canceladas';
    });
    const idsImoveisAtivos = new Set(
      imoveis.filter((imovel) => imovel.is_active).map((imovel) => imovel.id)
    );
    const noitesOcupadas = reservasValidas
      .filter((reserva) => idsImoveisAtivos.has(reserva.property_id))
      .reduce((total, reserva) => {
        const inicio = reserva.check_in > inicioMesIso ? reserva.check_in : inicioMesIso;
        const fim = reserva.check_out < inicioProximoMesIso ? reserva.check_out : inicioProximoMesIso;
        if (fim <= inicio) return total;
        return total + Math.max(diasEntreDatas(inicio, fim), 0);
      }, 0);
    const noitesDisponiveis = idsImoveisAtivos.size * diasNoMes;
    const reservasDoMes = reservasValidas.filter(
      (reserva) => reserva.check_in >= inicioMesIso && reserva.check_in < inicioProximoMesIso
    );
    const receitaLiquidaMes = reservasDoMes.reduce((total, reserva) => {
      const bruto = Number(reserva.total_price) || 0;
      const diarias = Math.max(bruto - (Number(reserva.cleaning_fee) || 0), 0);
      return total + bruto - diarias * PLATFORM_COMMISSION_RATE;
    }, 0);
    const hojeIso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    const proximaReserva = reservasValidas
      .filter(
        (reserva) =>
          statusReserva(reserva).categoria === 'confirmadas' && reserva.check_in >= hojeIso
      )
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
    const proximoRepasse = proximaReserva
      ? (() => {
          const bruto = Number(proximaReserva.total_price) || 0;
          const diarias = Math.max(bruto - (Number(proximaReserva.cleaning_fee) || 0), 0);
          return bruto - diarias * PLATFORM_COMMISSION_RATE;
        })()
      : 0;

    return {
      taxaOcupacao: noitesDisponiveis
        ? Math.min(Math.round((noitesOcupadas / noitesDisponiveis) * 100), 100)
        : 0,
      receitaLiquidaMes,
      proximoRepasse,
      dataProximoRepasse: proximaReserva?.check_in || '',
    };
  }, [dataReferencia, imoveis, reservas]);

  const reservasRecentes = [...reservas]
    .filter((reserva) => reserva.status !== 'blocked')
    .slice(0, 5);

  const reservasFiltradas = reservas
    .filter((reserva) => statusReserva(reserva).categoria !== 'bloqueadas')
    .filter((reserva) => filtroReserva === 'todas' || statusReserva(reserva).categoria === filtroReserva);

  const renderTabelaReservas = (lista: Reserva[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {lista.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-[#155E75]" aria-hidden="true">
            <IconePainel nome="calendar" />
          </span>
          <h3 className="font-semibold text-slate-900">
            {reservas.length === 0 ? 'Sua próxima reserva começa aqui' : 'Nenhuma reserva neste filtro'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {reservas.length === 0
              ? 'Quando um hóspede reservar seu espaço, os detalhes aparecerão neste extrato.'
              : 'Tente outra opção para consultar suas reservas.'}
          </p>
          {reservas.length === 0 && (
            <button
              type="button"
              onClick={() => setAbaAtiva('imoveis')}
              className="mt-5 rounded-xl bg-[#155E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#104b5e]"
            >
              Gerenciar meus imóveis
            </button>
          )}
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
                <th scope="col" className="px-5 py-4">Status / detalhes</th>
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
                  diasEntreDatas(reserva.check_in, reserva.check_out),
                  0
                );
                const status = statusReserva(reserva);
                const statusPagamento = status.rotulo;
                const statusClass =
                  status.categoria === 'confirmadas'
                    ? 'bg-emerald-50 text-emerald-700'
                    : status.categoria === 'pendentes'
                      ? 'bg-amber-50 text-amber-700'
                      : status.categoria === 'canceladas'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600';
                const telefone = linkWhatsApp(reserva, imovel?.title || 'seu imóvel');
                const expandida = reservaExpandida === reserva.id;

                return (
                  <Fragment key={reserva.id}>
                  <tr className="align-top text-slate-700">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        aria-expanded={expandida}
                        onClick={() => setReservaExpandida(expandida ? null : reserva.id)}
                        className="text-left"
                      >
                        <span className="block font-semibold text-slate-900">
                          {reserva.guest_id
                            ? emailsHospedes[reserva.guest_id] || `Hóspede ${reserva.guest_id.slice(0, 8)}`
                            : 'Hóspede não identificado'}
                        </span>
                        <span className="mt-1 block text-xs font-medium text-[#155E75]">
                          {expandida ? 'Ocultar detalhes' : 'Ver detalhes'}
                        </span>
                      </button>
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
                  {expandida && (
                    <tr key={`${reserva.id}-detalhes`} className="bg-slate-50/80">
                      <td colSpan={7} className="px-5 py-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Detalhes da reserva</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {noites} {noites === 1 ? 'diária' : 'diárias'} · {formatarData(reserva.check_in)} a {formatarData(reserva.check_out)}
                              {' · '}Limpeza repassada integralmente ({formatarMoeda(limpeza)}); comissão de 10% somente sobre diárias ({formatarMoeda(comissao)}).
                            </p>
                          </div>
                          {telefone ? (
                            <a
                              href={telefone}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <IconePainel nome="whatsapp" className="h-4 w-4" />
                              Contatar hóspede
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Telefone não informado nesta reserva.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
              Olá, {montado && nomeAnfitriao ? nomeAnfitriao : 'anfitrião'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Gerencie seus anúncios, acompanhe reservas e veja seus repasses.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {montado && emailAnfitriao && <span>{emailAnfitriao}</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {montado && userId ? 'Conta conectada' : 'Verificando conta'}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <button
              type="button"
              onClick={() => setAbaAtiva('imoveis')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E87722] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d16617] focus:outline-none focus:ring-2 focus:ring-[#E87722]/30 focus:ring-offset-2"
            >
              <IconePainel nome="plus" className="h-4 w-4" />
              Novo Imóvel
            </button>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{!montado || carregandoDados ? '—' : imoveisAtivos.length}</span> ativo(s)
              <span className="mx-1.5 text-slate-300">/</span>
              {!montado || carregandoDados ? '—' : imoveis.length} anúncio(s)
            </p>
          </div>
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
                    Indicadores do anfitrião
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Acompanhe ocupação, receitas e operação dos seus espaços.
                  </p>
                </div>
                <span className="text-xs text-slate-500">Limpeza integral para você · comissão de 10% sobre diárias</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {([
                  {
                    label: 'Taxa de ocupação',
                    value: `${indicadores.taxaOcupacao}%`,
                    detail: 'Noites reservadas neste mês',
                    icon: 'chart',
                    tone: 'bg-cyan-50 text-cyan-700',
                  },
                  {
                    label: 'Próximo repasse previsto',
                    value: formatarMoeda(indicadores.proximoRepasse),
                    detail: indicadores.dataProximoRepasse
                      ? `Estimativa · check-in em ${formatarData(indicadores.dataProximoRepasse)}`
                      : 'Sem reservas futuras confirmadas',
                    icon: 'wallet',
                    tone: 'bg-emerald-50 text-emerald-700',
                  },
                  {
                    label: 'Receita líquida no mês',
                    value: formatarMoeda(indicadores.receitaLiquidaMes),
                    detail: 'Check-ins neste mês · líquido após comissão e limpeza',
                    icon: 'calendar',
                    tone: 'bg-violet-50 text-violet-700',
                  },
                  {
                    label: 'Imóveis ativos',
                    value: String(imoveisAtivos.length),
                    detail: `${imoveis.length} anúncio(s) no total`,
                    icon: 'home',
                    tone: 'bg-amber-50 text-amber-700',
                  },
                ] as const).map((kpi) => (
                  <article key={kpi.label} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.tone}`}>
                        <IconePainel nome={kpi.icon} />
                      </span>
                    </div>
                    {carregandoDados ? (
                      <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                      <p className="text-2xl font-bold tracking-tight text-slate-950">{kpi.value}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{kpi.detail}</p>
                  </article>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Repasse apresentado como estimativa com base nas próximas reservas confirmadas; o prazo operacional pode variar. A taxa de limpeza é 100% sua, sem comissão.
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">Resumo financeiro acumulado</h3>
                  <p className="mt-1 text-xs text-slate-500">Valores registrados nas reservas, excluindo bloqueios de calendário.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Receita bruta', resumoFinanceiro.totalBruto],
                    ['Taxa de limpeza', resumoFinanceiro.taxaLimpeza],
                    ['Comissão (10% das diárias)', resumoFinanceiro.comissao],
                    ['Repasse líquido', resumoFinanceiro.repasse],
                  ].map(([label, valor]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {carregandoDados ? '—' : formatarMoeda(Number(valor))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
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
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-[#155E75]" aria-hidden="true">
                    <IconePainel nome="home" />
                  </span>
                  <h3 className="font-semibold text-slate-900">Seu primeiro espaço começa aqui</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Importe um anúncio para começar. Seu primeiro imóvel é gratuito.
                  </p>
                  <a
                    href="#importar-imovel"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#155E75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#104b5e]"
                  >
                    <IconePainel nome="plus" className="h-4 w-4" />
                    Adicionar primeiro imóvel
                  </a>
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
                    const quantidadeFotos = Array.isArray(imovel.images)
                      ? imovel.images.filter((foto): foto is string => typeof foto === 'string').length
                      : 0;
                    const totalFotos = quantidadeFotos || (imovel.image_url ? 1 : 0);
                    const statusAtualizando = !!imoveisAtualizando[imovel.id];

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
                          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                            <IconePainel nome="camera" className="h-3.5 w-3.5" />
                            {totalFotos} {totalFotos === 1 ? 'foto' : 'fotos'}
                          </span>
                        </div>

                        <div className="p-5">
                          <p className="mb-1 text-xs font-medium text-slate-500">{imovel.location}</p>
                          <h3 className="line-clamp-1 text-base font-bold text-slate-900">{imovel.title}</h3>
                          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">Publicação</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {adicional ? 'Gerenciada pela assinatura' : imovel.is_active ? 'Visível para hóspedes' : 'Pausado para hóspedes'}
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={imovel.is_active}
                              aria-label={`${imovel.is_active ? 'Pausar' : 'Ativar'} anúncio ${imovel.title}`}
                              title={adicional ? 'A ativação de imóveis adicionais é feita pela assinatura.' : undefined}
                              disabled={adicional || statusAtualizando}
                              onClick={() => void alterarStatusImovel(imovel)}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#155E75]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                                imovel.is_active ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                imovel.is_active ? 'translate-x-5' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>
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
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#155E75] hover:bg-slate-50"
                            >
                              <IconePainel nome="edit" className="h-3.5 w-3.5" />
                              Editar anúncio
                            </button>
                            <a
                              href={`/imovel/${imovel.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#155E75] hover:bg-slate-50"
                            >
                              <IconePainel nome="external" className="h-3.5 w-3.5" />
                              Ver como hóspede
                            </a>
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
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar reservas por status">
              {([
                ['todas', 'Todas'],
                ['confirmadas', 'Confirmadas'],
                ['pendentes', 'Pendentes'],
                ['canceladas', 'Canceladas'],
              ] as const).map(([filtro, label]) => {
                const quantidade = filtro === 'todas'
                  ? reservas.filter((reserva) => statusReserva(reserva).categoria !== 'bloqueadas').length
                  : reservas.filter((reserva) => statusReserva(reserva).categoria === filtro).length;
                const selecionado = filtroReserva === filtro;
                return (
                  <button
                    key={filtro}
                    type="button"
                    aria-pressed={selecionado}
                    onClick={() => setFiltroReserva(filtro)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      selecionado
                        ? 'border-[#155E75] bg-[#155E75] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {label} <span className={selecionado ? 'text-white/75' : 'text-slate-400'}>{quantidade}</span>
                  </button>
                );
              })}
            </div>
            {carregandoDados ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" role="status" aria-label="Carregando extrato">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            ) : renderTabelaReservas(reservasFiltradas)}
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

      {toast && (
        <div
          role={toast.tipo === 'erro' ? 'alert' : 'status'}
          aria-live={toast.tipo === 'erro' ? 'assertive' : 'polite'}
          className={`fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
            toast.tipo === 'erro'
              ? 'border-rose-200 bg-white text-rose-800'
              : toast.tipo === 'info'
                ? 'border-cyan-200 bg-white text-cyan-900'
                : 'border-emerald-200 bg-white text-emerald-800'
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${
            toast.tipo === 'erro' ? 'bg-rose-500' : toast.tipo === 'info' ? 'bg-cyan-500' : 'bg-emerald-500'
          }`} />
          <span>{toast.mensagem}</span>
          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={() => setToast(null)}
            className="ml-1 rounded-full px-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      )}

      {imovelEditando && (
        <ModalEditarImovel
          imovel={imovelEditando}
          onClose={() => setImovelEditando(null)}
          onSalvo={salvarImovelConcluido}
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
