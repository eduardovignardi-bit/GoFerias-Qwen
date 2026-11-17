'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PeriodoOcupado = {
  check_in: string;
  check_out: string;
};

type ImovelReservavel = {
  id: string;
  owner_id?: string;
  price_per_night: number | string;
  cleaning_fee?: number | string | null;
    guests?: number | null;
};

function obterDataHojeLocal(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function WidgetReserva({ imovel }: { imovel: ImovelReservavel }) {
  const router = useRouter();
  const [periodosOcupados, setPeriodosOcupados] = useState<PeriodoOcupado[]>([]);
  const [carregandoDisponibilidade, setCarregandoDisponibilidade] = useState(true);
  const [imovelCarregadoId, setImovelCarregadoId] = useState<string | null>(null);
  const [tentativaAtualizacao, setTentativaAtualizacao] = useState(0);
  const [erroDisponibilidade, setErroDisponibilidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [hospedes, setHospedes] = useState(1);
  const [reservando, setReservando] = useState(false);

  const hojeStr = obterDataHojeLocal();
  const maxHospedes = Math.max(1, Number(imovel.guests) || 10);

  useEffect(() => {
    let ativo = true;

    const buscarDisponibilidade = async () => {
      try {
        const { data: reservasData, error: erroReservas } = await supabase
          .from('bookings')
          .select('check_in, check_out, status')
          .eq('property_id', imovel.id);

        if (erroReservas) throw erroReservas;

        const ativas = (reservasData || [])
          .filter((r) => r.status !== 'cancelled' && r.status !== 'canceled' && r.status !== 'rejected')
          .map((r) => ({ check_in: r.check_in, check_out: r.check_out }));

        const bloqueiosExtras: PeriodoOcupado[] = [];
        const { data: bloqueiosData } = await supabase
          .from('blocked_dates')
          .select('start_date, end_date')
          .eq('property_id', imovel.id);

        if (Array.isArray(bloqueiosData)) {
          for (const b of bloqueiosData) {
            if (b.start_date && b.end_date) {
              bloqueiosExtras.push({ check_in: b.start_date, check_out: b.end_date });
            }
          }
        }

        if (!ativo) return;
        setPeriodosOcupados([...ativas, ...bloqueiosExtras]);
        setErroDisponibilidade('');
        setCheckIn(null);
        setCheckOut(null);
        setMensagem('');
      } catch (error) {
        if (!ativo) return;
        console.error('Erro ao carregar disponibilidade:', error);
        setErroDisponibilidade('Não foi possível carregar a disponibilidade. Tente novamente.');
      } finally {
        if (ativo) {
          setCarregandoDisponibilidade(false);
          setImovelCarregadoId(imovel.id);
        }
      }
    };

    void buscarDisponibilidade();
    return () => {
      ativo = false;
    };
  }, [imovel.id, tentativaAtualizacao]);

  const recarregarDisponibilidade = () => {
    setCarregandoDisponibilidade(true);
    setErroDisponibilidade('');
    setPeriodosOcupados([]);
    setCheckIn(null);
    setCheckOut(null);
    setMensagem('');
    setTentativaAtualizacao((tentativa) => tentativa + 1);
  };

  const disponibilidadeCarregando =
    carregandoDisponibilidade || imovelCarregadoId !== imovel.id;

  const isPassado = (dataStr: string) => dataStr < hojeStr;

  const isOcupado = (dataStr: string) =>
    imovelCarregadoId === imovel.id &&
    periodosOcupados.some((p) => dataStr >= p.check_in && dataStr < p.check_out);

  const isIndisponivel = (dataStr: string) => isPassado(dataStr) || isOcupado(dataStr);

  const temConflito = (inicio: string, fim: string) =>
    imovelCarregadoId === imovel.id &&
    periodosOcupados.some((p) => inicio < p.check_out && fim > p.check_in);

  const handleDia = (dataStr: string) => {
    if (disponibilidadeCarregando || erroDisponibilidade || isIndisponivel(dataStr) || reservando) return;

    setMensagem('');
    if (!checkIn || checkOut) {
      setCheckIn(dataStr);
      setCheckOut(null);
    } else if (dataStr <= checkIn) {
      setCheckIn(dataStr);
    } else if (temConflito(checkIn, dataStr)) {
      setMensagem('O período selecionado inclui datas ocupadas. Escolha outras datas.');
    } else {
      setCheckOut(dataStr);
    }
  };

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const dias: Array<{ dia: number; dataStr: string } | null> = [];

  for (let i = 0; i < primeiroDia; i++) dias.push(null);
  for (let dia = 1; dia <= totalDias; dia++) {
    dias.push({
      dia,
      dataStr: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    });
  }

  const noites =
    checkIn && checkOut
      ? Math.round(
          (new Date(`${checkOut}T12:00:00`).getTime() -
            new Date(`${checkIn}T12:00:00`).getTime()) /
            86400000
        )
      : 0;
  const diaria = Number(imovel.price_per_night) || 0;
  const limpeza = Number(imovel.cleaning_fee) || 0;
  const subtotal = noites * diaria;
  const total = subtotal + limpeza;
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const confirmarReserva = async () => {
    if (!checkIn || !checkOut || noites <= 0 || disponibilidadeCarregando || erroDisponibilidade) return;

    if (checkIn < hojeStr) {
      setMensagem('A data de check-in não pode estar no passado.');
      return;
    }

    setReservando(true);
    setMensagem('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMensagem('Faça login para concluir sua solicitação.');
        router.push(`/?redirect=/imovel/${imovel.id}`);
        return;
      }

      if (imovel.owner_id && user.id === imovel.owner_id) {
        setMensagem('Você não pode reservar o seu próprio imóvel. Use o painel do anfitrião para bloquear datas.');
        return;
      }

      // Garante o registro do hóspede na tabela profiles para evitar erro de chave estrangeira
      await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email }, { onConflict: 'id' });

      // Checagem final contra reservas concorrentes
      const { data: conflitos, error: erroConflitos } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', imovel.id)
        .lt('check_in', checkOut)
        .gt('check_out', checkIn);

      if (erroConflitos) throw erroConflitos;
      const conflitosAtivos = (conflitos || []).filter(
        (c) => c.status !== 'cancelled' && c.status !== 'canceled' && c.status !== 'rejected'
      );

      if (conflitosAtivos.length > 0) {
        recarregarDisponibilidade();
        setMensagem('Estas datas acabaram de ser ocupadas. Atualizamos o calendário; escolha outro período.');
        return;
      }

      // Cria a solicitação de reserva aguardando aprovação do anfitrião
      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            property_id: imovel.id,
            guest_id: user.id,
            check_in: checkIn,
            check_out: checkOut,
            nights: noites,
            cleaning_fee: limpeza,
            total_price: total,
            status: 'pending',
          },
        ]);

      if (error) {
        throw new Error(error.message || 'Erro ao solicitar reserva.');
      }

      // Dispara e-mail para o anfitrião e gera link do WhatsApp
      const respNotif = await fetch('/api/notificar-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: imovel.id,
          checkIn,
          checkOut,
          nights: noites,
          total,
        }),
      }).catch(() => null);

      const dadosNotif = respNotif && respNotif.ok ? await respNotif.json() : null;
      const destinoViagens = dadosNotif?.whatsappUrl
        ? `/viagens?solicitada=1&wa=${encodeURIComponent(dadosNotif.whatsappUrl)}`
        : '/viagens?solicitada=1';

      router.push(destinoViagens);
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Não foi possível concluir a solicitação. Verifique a disponibilidade e tente novamente.';
      console.error('Erro ao solicitar reserva:', msg, error);
      recarregarDisponibilidade();
      setMensagem(msg);
    } finally {
      setReservando(false);
    }
  };

  const hoje = new Date();
  const podeVoltarMes =
    ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());

  return (
    <div className="sticky top-28 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <strong className="text-2xl font-bold text-[#222222]">{formatarMoeda(diaria)}</strong>
          <span className="text-sm text-gray-600"> / noite</span>
        </div>
        <span className="text-xs font-semibold text-gray-500">★ Novo</span>
      </div>

      <div className="mb-3 flex justify-center gap-3 text-[11px]" aria-label="Legenda de disponibilidade">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-emerald-400 bg-emerald-100" />
          Livre
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded border border-red-400 bg-red-100" />
          Ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-[#155E75]" />
          Seleção
        </span>
      </div>

      <div className="mb-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-1.5">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={!podeVoltarMes}
          onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
          className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-gray-200 disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-xs font-semibold capitalize">
          {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
          className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-gray-200"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400">
        <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1">
        {dias.map((item, index) => {
          if (!item) return <div key={`vazio-${index}`} />;
          const passado = isPassado(item.dataStr);
          const ocupado = isOcupado(item.dataStr);
          const desabilitado = passado || ocupado;
          const selecionado =
            item.dataStr === checkIn ||
            item.dataStr === checkOut ||
            (!!checkIn && !!checkOut && item.dataStr > checkIn && item.dataStr < checkOut);

          let estilo = 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
          if (passado) {
            estilo = 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300';
          } else if (ocupado) {
            estilo = 'cursor-not-allowed border-red-200 bg-red-50 text-red-500 line-through';
          } else if (selecionado) {
            estilo = 'border-[#155E75] bg-[#155E75] font-bold text-white';
          }

          return (
            <button
              key={item.dataStr}
              type="button"
              aria-label={`${item.dia}${ocupado ? ', ocupado' : passado ? ', indisponível' : ', livre'}`}
              aria-pressed={selecionado}
              disabled={desabilitado || disponibilidadeCarregando || !!erroDisponibilidade || reservando}
              onClick={() => handleDia(item.dataStr)}
              className={`rounded-lg border py-1.5 text-xs transition disabled:opacity-80 ${estilo}`}
            >
              {item.dia}
            </button>
          );
        })}
      </div>

      {disponibilidadeCarregando && (
        <p className="mb-3 text-center text-xs text-gray-500" role="status">Carregando disponibilidade...</p>
      )}
      {erroDisponibilidade && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-800" role="alert">
          <p>{erroDisponibilidade}</p>
          <button type="button" onClick={recarregarDisponibilidade} className="mt-1 font-semibold underline">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl border border-gray-300 text-xs">
        <div className="border-r border-gray-300 p-2.5">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Check-in</span>
          <span className="font-medium text-gray-900">{checkIn || 'Selecione'}</span>
        </div>
        <div className="p-2.5">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Check-out</span>
          <span className="font-medium text-gray-900">{checkOut || 'Selecione'}</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-300 p-2.5 text-xs">
        <label className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-gray-500">Hóspedes (máx. {maxHospedes})</span>
          <select
            value={hospedes}
            onChange={(e) => setHospedes(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-900 outline-none"
          >
            {Array.from({ length: maxHospedes }, (_, i) => i + 1).map((qtd) => (
              <option key={qtd} value={qtd}>
                {qtd} {qtd === 1 ? 'hóspede' : 'hóspedes'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mensagem && <p className="mb-3 text-sm text-red-700" role="alert">{mensagem}</p>}

      <button
        type="button"
        disabled={noites <= 0 || reservando || disponibilidadeCarregando || !!erroDisponibilidade}
        onClick={() => void confirmarReserva()}
        className="w-full rounded-xl bg-[#E87722] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d16617] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {reservando ? 'Enviando solicitação...' : noites > 0 ? 'Solicitar reserva' : 'Selecione as datas'}
      </button>

      {noites > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>{formatarMoeda(diaria)} × {noites} noite(s)</span>
            <span>{formatarMoeda(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa de limpeza</span>
            <span>{formatarMoeda(limpeza)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
            <span>Total da estadia</span>
            <span>{formatarMoeda(total)}</span>
          </div>
          <p className="text-right text-xs text-gray-500">100% repassado ao anfitrião, sem taxas ocultas.</p>
        </div>
      )}
    </div>
  );
}
