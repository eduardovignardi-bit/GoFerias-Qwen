'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Reserva = {
  check_in: string;
  check_out: string;
};

type ImovelReservavel = {
  id: string;
  price_per_night: number | string;
  cleaning_fee?: number | string | null;
};

export default function WidgetReserva({ imovel }: { imovel: ImovelReservavel }) {
  const router = useRouter();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregandoDisponibilidade, setCarregandoDisponibilidade] = useState(true);
  const [imovelCarregadoId, setImovelCarregadoId] = useState<string | null>(null);
  const [tentativaAtualizacao, setTentativaAtualizacao] = useState(0);
  const [erroDisponibilidade, setErroDisponibilidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  useEffect(() => {
    let ativo = true;

    const buscarReservas = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('check_in, check_out')
          .eq('property_id', imovel.id);

        if (error) throw error;
        if (!ativo) return;
        setReservas(data || []);
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

    void buscarReservas();
    return () => {
      ativo = false;
    };
  }, [imovel.id, tentativaAtualizacao]);

  const recarregarDisponibilidade = () => {
    setCarregandoDisponibilidade(true);
    setErroDisponibilidade('');
    setReservas([]);
    setCheckIn(null);
    setCheckOut(null);
    setMensagem('');
    setTentativaAtualizacao((tentativa) => tentativa + 1);
  };

  const disponibilidadeCarregando =
    carregandoDisponibilidade || imovelCarregadoId !== imovel.id;

  const isOcupado = (dataStr: string) =>
    imovelCarregadoId === imovel.id &&
    reservas.some((reserva) => dataStr >= reserva.check_in && dataStr < reserva.check_out);

  const temConflito = (inicio: string, fim: string) =>
    imovelCarregadoId === imovel.id &&
    reservas.some((reserva) => inicio < reserva.check_out && fim > reserva.check_in);

  const handleDia = (dataStr: string) => {
    if (disponibilidadeCarregando || erroDisponibilidade || isOcupado(dataStr) || reservando) return;

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

    setReservando(true);
    setMensagem('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMensagem('Faça login para concluir sua reserva.');
        return;
      }

      const { data: conflitos, error: erroConflitos } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', imovel.id)
        .lt('check_in', checkOut)
        .gt('check_out', checkIn);

      if (erroConflitos) throw erroConflitos;
      if (conflitos?.length) {
        recarregarDisponibilidade();
        setMensagem('Estas datas acabaram de ser ocupadas. Atualizamos o calendário; escolha outro período.');
        return;
      }

      const { error } = await supabase.from('bookings').insert([
        {
          property_id: imovel.id,
          guest_id: user.id,
          check_in: checkIn,
          check_out: checkOut,
          nights: noites,
          cleaning_fee: limpeza,
          total_price: total,
        },
      ]);

      if (error) throw error;
      window.alert(`Reserva confirmada! Total: ${formatarMoeda(total)}`);
      router.push('/viagens');
    } catch (error) {
      console.error('Erro ao confirmar reserva:', error);
      recarregarDisponibilidade();
      setMensagem('Não foi possível concluir a reserva. Verifique a disponibilidade e tente novamente.');
    } finally {
      setReservando(false);
    }
  };

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
          onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
          className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-gray-200"
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
          const ocupado = isOcupado(item.dataStr);
          const selecionado =
            item.dataStr === checkIn ||
            item.dataStr === checkOut ||
            (!!checkIn && !!checkOut && item.dataStr > checkIn && item.dataStr < checkOut);

          let estilo = 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
          if (ocupado) {
            estilo = 'cursor-not-allowed border-red-200 bg-red-50 text-red-500 line-through';
          } else if (selecionado) {
            estilo = 'border-[#155E75] bg-[#155E75] font-bold text-white';
          }

          return (
            <button
              key={item.dataStr}
              type="button"
              aria-label={`${item.dia}${ocupado ? ', ocupado' : ', livre'}`}
              aria-pressed={selecionado}
              disabled={ocupado || disponibilidadeCarregando || !!erroDisponibilidade || reservando}
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

      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-gray-300 text-xs">
        <div className="border-r border-gray-300 p-2.5">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Check-in</span>
          <span className="font-medium text-gray-900">{checkIn || 'Selecione uma data'}</span>
        </div>
        <div className="p-2.5">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Check-out</span>
          <span className="font-medium text-gray-900">{checkOut || 'Selecione uma data'}</span>
        </div>
      </div>

      {mensagem && <p className="mb-3 text-sm text-red-700" role="alert">{mensagem}</p>}

      <button
        type="button"
        disabled={noites <= 0 || reservando || disponibilidadeCarregando || !!erroDisponibilidade}
        onClick={() => void confirmarReserva()}
        className="w-full rounded-xl bg-[#E87722] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d16617] disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {reservando ? 'Confirmando...' : noites > 0 ? 'Reservar agora' : 'Selecione as datas'}
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
          <p className="text-right text-xs text-gray-500">Total já inclui a taxa de limpeza.</p>
        </div>
      )}
    </div>
  );
}
