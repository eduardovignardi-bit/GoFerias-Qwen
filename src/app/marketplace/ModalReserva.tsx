'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Reserva = {
  check_in: string;
  check_out: string;
};

type ImovelReservavel = {
  id: string;
  title: string;
  price_per_night: number | string;
  cleaning_fee?: number | string | null;
};

export default function ModalReserva({
  imovel,
  onClose,
}: {
  imovel: ImovelReservavel;
  onClose: () => void;
}) {
  const [reservasExistentes, setReservasExistentes] = useState<Reserva[]>([]);
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
        setReservasExistentes(data || []);
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
    setReservasExistentes([]);
    setCheckIn(null);
    setCheckOut(null);
    setMensagem('');
    setTentativaAtualizacao((tentativa) => tentativa + 1);
  };

  const disponibilidadeCarregando =
    carregandoDisponibilidade || imovelCarregadoId !== imovel.id;

  const isDataReservada = (dataStr: string) =>
    imovelCarregadoId === imovel.id &&
    reservasExistentes.some(
      (reserva) => dataStr >= reserva.check_in && dataStr < reserva.check_out
    );

  const temConflitoNoIntervalo = (inicio: string, fim: string) =>
    imovelCarregadoId === imovel.id &&
    reservasExistentes.some(
      (reserva) => inicio < reserva.check_out && fim > reserva.check_in
    );

  const handleCliqueDia = (dataStr: string) => {
    if (
      disponibilidadeCarregando ||
      erroDisponibilidade ||
      isDataReservada(dataStr) ||
      reservando
    ) {
      return;
    }

    setMensagem('');
    if (!checkIn || checkOut) {
      setCheckIn(dataStr);
      setCheckOut(null);
    } else if (dataStr <= checkIn) {
      setCheckIn(dataStr);
    } else if (temConflitoNoIntervalo(checkIn, dataStr)) {
      setMensagem('O período selecionado inclui datas ocupadas. Escolha outras datas.');
    } else {
      setCheckOut(dataStr);
    }
  };

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const diasCalendario: Array<{ dia: number; dataStr: string } | null> = [];

  for (let i = 0; i < primeiroDiaSemana; i++) diasCalendario.push(null);
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    diasCalendario.push({
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
  const taxaLimpeza = Number(imovel.cleaning_fee) || 0;
  const subtotalDiarias = noites * diaria;
  const valorTotal = subtotalDiarias + taxaLimpeza;
  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const confirmarReserva = async () => {
    if (!checkIn || !checkOut || noites <= 0 || disponibilidadeCarregando || erroDisponibilidade) return;

    setReservando(true);
    setMensagem('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMensagem('Você precisa estar logado para reservar.');
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
          cleaning_fee: taxaLimpeza,
          total_price: valorTotal,
        },
      ]);

      if (error) throw error;

      window.alert(`Reserva confirmada com sucesso! Total: ${formatarMoeda(valorTotal)}`);
      onClose();
    } catch (error) {
      console.error('Erro ao confirmar reserva:', error);
      recarregarDisponibilidade();
      setMensagem('Não foi possível concluir a reserva. Verifique a disponibilidade e tente novamente.');
    } finally {
      setReservando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-reserva-titulo"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 id="modal-reserva-titulo" className="line-clamp-1 text-lg font-bold text-gray-900">
            {imovel.title}
          </h2>
          <button
            type="button"
            aria-label="Fechar reserva"
            onClick={onClose}
            className="ml-3 rounded-full px-2 py-1 text-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex justify-center gap-4 text-xs" aria-label="Legenda de disponibilidade">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-emerald-400 bg-emerald-100" />
            Livre
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border border-red-400 bg-red-100" />
            Ocupado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-[#155E75]" />
            Seleção
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-xl bg-gray-50 p-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="rounded-lg px-3 py-1 text-sm font-bold transition hover:bg-gray-200"
          >
            ←
          </button>
          <span className="text-sm font-bold capitalize">
            {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="rounded-lg px-3 py-1 text-sm font-bold transition hover:bg-gray-200"
          >
            →
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500">
          <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
        </div>
        <div className="mb-3 grid grid-cols-7 gap-1">
          {diasCalendario.map((item, index) => {
            if (!item) return <div key={`vazio-${index}`} />;
            const ocupado = isDataReservada(item.dataStr);
            const selecionado =
              item.dataStr === checkIn ||
              item.dataStr === checkOut ||
              (!!checkIn && !!checkOut && item.dataStr > checkIn && item.dataStr < checkOut);

            let estilo = 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100';
            if (ocupado) {
              estilo = 'cursor-not-allowed border-red-200 bg-red-50 text-red-600 line-through';
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
                onClick={() => handleCliqueDia(item.dataStr)}
                className={`rounded-lg border py-2 text-xs transition disabled:opacity-80 ${estilo}`}
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

        <div className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Check-in: <strong className="text-gray-900">{checkIn || 'Selecione'}</strong></span>
            <span>Check-out: <strong className="text-gray-900">{checkOut || 'Selecione'}</strong></span>
          </div>
          {noites > 0 && (
            <>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-700">
                <span>{formatarMoeda(diaria)} × {noites} noite(s)</span>
                <span>{formatarMoeda(subtotalDiarias)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Taxa de limpeza</span>
                <span>{formatarMoeda(taxaLimpeza)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                <span>Total da reserva</span>
                <span>{formatarMoeda(valorTotal)}</span>
              </div>
              <p className="text-right text-xs text-gray-500">Total já inclui a taxa de limpeza.</p>
            </>
          )}
        </div>

        {mensagem && <p className="mb-3 text-sm text-red-700" role="alert">{mensagem}</p>}

        <button
          type="button"
          disabled={noites <= 0 || reservando || disponibilidadeCarregando || !!erroDisponibilidade}
          onClick={() => void confirmarReserva()}
          className="w-full rounded-xl bg-[#E87722] py-3 text-sm font-bold text-white transition hover:bg-[#d16617] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {reservando ? 'Confirmando...' : noites > 0 ? 'Confirmar reserva' : 'Selecione check-in e check-out'}
        </button>
      </div>
    </div>
  );
}
