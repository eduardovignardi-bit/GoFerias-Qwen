'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ModalReserva({ imovel, onClose }: any) {
  const [reservasExistentes, setReservasExistentes] = useState<any[]>([]);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  useEffect(() => {
    buscarReservas();
  }, [imovel.id]);

  const buscarReservas = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('check_in, check_out')
      .eq('property_id', imovel.id);
    if (data) setReservasExistentes(data);
  };

  // Verifica se uma data YYYY-MM-DD está ocupada
  const isDataReservada = (dataStr: string) => {
    return reservasExistentes.some(
      (r) => dataStr >= r.check_in && dataStr < r.check_out
    );
  };

  // Verifica se há algum dia reservado no meio do intervalo escolhido (Anti-Overbooking)
  const temOverbookingNoIntervalo = (inicio: string, fim: string) => {
    let atual = new Date(inicio + 'T12:00:00');
    const limite = new Date(fim + 'T12:00:00');
    while (atual < limite) {
      const str = atual.toISOString().split('T')[0];
      if (isDataReservada(str)) return true;
      atual.setDate(atual.getDate() + 1);
    }
    return false;
  };

  const handleCliqueDia = (dataStr: string) => {
    if (isDataReservada(dataStr)) return;

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dataStr);
      setCheckOut(null);
    } else if (dataStr <= checkIn) {
      setCheckIn(dataStr);
    } else {
      if (temOverbookingNoIntervalo(checkIn, dataStr)) {
        alert('Período inválido! Existem datas já reservadas (em vermelho) dentro deste intervalo.');
        return;
      }
      setCheckOut(dataStr);
    }
  };

  // Gera os dias do mês exibido no calendário
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

  const diasCalendario = [];
  for (let i = 0; i < primeiroDiaSemana; i++) diasCalendario.push(null);
  for (let d = 1; d <= totalDiasMes; d++) {
    const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    diasCalendario.push({ dia: d, dataStr: dataFormatada });
  }

  // Cálculo de Diárias + Taxa de Limpeza
  const calcularNoites = () => {
    if (!checkIn || !checkOut) return 0;
    const d1 = new Date(checkIn + 'T12:00:00');
    const d2 = new Date(checkOut + 'T12:00:00');
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  };

  const noites = calcularNoites();
  const taxaLimpeza = Number(imovel.cleaning_fee || 0);
  const subtotalDiarias = noites * Number(imovel.price_per_night);
  const valorTotal = subtotalDiarias + taxaLimpeza;

  const confirmarReserva = async () => {
    if (!checkIn || !checkOut) return;
    setReservando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Você precisa estar logado para reservar.');
        return;
      }

      // Dupla checagem no banco antes de salvar para evitar overbooking simultâneo
      const { data: conflitos } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', imovel.id)
        .lt('check_in', checkOut)
        .gt('check_out', checkIn);

      if (conflitos && conflitos.length > 0) {
        alert('Ops! Alguém acabou de reservar essas datas. Atualizando calendário...');
        buscarReservas();
        setCheckIn(null);
        setCheckOut(null);
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

      alert(`Reserva confirmada com sucesso! Total: R$ ${valorTotal.toFixed(2)}`);
      onClose();
    } catch (err: any) {
      alert('Erro ao confirmar reserva: ' + err.message);
    } finally {
      setReservando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold line-clamp-1">{imovel.title}</h3>
          <button onClick={onClose} className="font-bold text-gray-500">X</button>
        </div>

        {/* Legenda de Cores */}
        <div className="flex justify-center gap-4 text-xs mb-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block"></span> Livre</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-400 inline-block"></span> Reservado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block"></span> Selecionado</span>
        </div>

        {/* Navegação do Mês */}
        <div className="flex justify-between items-center mb-3 bg-gray-50 p-2 rounded-xl">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="px-3 py-1 font-bold text-sm hover:bg-gray-200 rounded-lg"
          >
            ←
          </button>
          <span className="font-bold text-sm capitalize">
            {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="px-3 py-1 font-bold text-sm hover:bg-gray-200 rounded-lg"
          >
            →
          </button>
        </div>

        {/* Grade do Calendário */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-1">
          <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-5">
          {diasCalendario.map((item, idx) => {
            if (!item) return <div key={idx} />;
            const ocupado = isDataReservada(item.dataStr);
            const selecionado =
              item.dataStr === checkIn ||
              item.dataStr === checkOut ||
              (checkIn && checkOut && item.dataStr > checkIn && item.dataStr < checkOut);

            let estilo = 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 cursor-pointer';
            if (ocupado) {
              estilo = 'bg-red-100 text-red-700 border-red-300 line-through cursor-not-allowed opacity-75';
            } else if (selecionado) {
              estilo = 'bg-blue-600 text-white border-blue-700 font-bold cursor-pointer';
            }

            return (
              <button
                key={item.dataStr}
                type="button"
                disabled={ocupado}
                onClick={() => handleCliqueDia(item.dataStr)}
                className={`py-2 rounded-lg border text-xs transition ${estilo}`}
              >
                {item.dia}
              </button>
            );
          })}
        </div>

        {/* Resumo Financeiro da Reserva */}
        <div className="bg-gray-50 p-4 rounded-xl border space-y-2 text-sm mb-4">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Check-in: <strong>{checkIn || 'Selecione'}</strong></span>
            <span>Check-out: <strong>{checkOut || 'Selecione'}</strong></span>
          </div>
          {noites > 0 && (
            <>
              <div className="flex justify-between pt-2 border-t">
                <span>R$ {imovel.price_per_night} x {noites} noite(s)</span>
                <span>R$ {subtotalDiarias.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de limpeza</span>
                <span>R$ {taxaLimpeza.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t text-gray-900">
                <span>Total da Reserva</span>
                <span>R$ {valorTotal.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={noites === 0 || reservando}
          onClick={confirmarReserva}
          className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 disabled:bg-gray-300 transition text-sm"
        >
          {reservando ? 'Confirmando...' : noites > 0 ? 'Confirmar Reserva' : 'Selecione Check-in e Check-out'}
        </button>
      </div>
    </div>
  );
}
