'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WidgetReserva({ imovel }: any) {
  const [reservas, setReservas] = useState<any[]>([]);
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
    if (data) setReservas(data);
  };

  const isOcupado = (dataStr: string) =>
    reservas.some((r) => dataStr >= r.check_in && dataStr < r.check_out);

  const temConflito = (ini: string, fim: string) => {
    let atual = new Date(ini + 'T12:00:00');
    const limite = new Date(fim + 'T12:00:00');
    while (atual < limite) {
      if (isOcupado(atual.toISOString().split('T')[0])) return true;
      atual.setDate(atual.getDate() + 1);
    }
    return false;
  };

  const handleDia = (dataStr: string) => {
    if (isOcupado(dataStr)) return;
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dataStr);
      setCheckOut(null);
    } else if (dataStr <= checkIn) {
      setCheckIn(dataStr);
    } else {
      if (temConflito(checkIn, dataStr)) {
        return alert('Existem datas já reservadas (em vermelho) neste período.');
      }
      setCheckOut(dataStr);
    }
  };

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const dias = [];
  for (let i = 0; i < primeiroDia; i++) dias.push(null);
  for (let d = 1; d <= totalDias; d++) {
    dias.push({
      dia: d,
      dataStr: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  const noites =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut + 'T12:00:00').getTime() -
            new Date(checkIn + 'T12:00:00').getTime()) /
            86400000
        )
      : 0;

  const limpeza = Number(imovel.cleaning_fee || 0);
  const subtotal = noites * Number(imovel.price_per_night);
  const total = subtotal + limpeza;

  const confirmarReserva = async () => {
    if (!checkIn || !checkOut) return;
    setReservando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert('Faça login para concluir sua reserva.');

      const { data: conflitos } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', imovel.id)
        .lt('check_in', checkOut)
        .gt('check_out', checkIn);

      if (conflitos && conflitos.length > 0) {
        buscarReservas();
        setCheckIn(null);
        setCheckOut(null);
        return alert('Estas datas acabaram de ser reservadas. Escolha outro período.');
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
      alert(`Reserva confirmada! Total: R$ ${total.toFixed(2)}`);
      setCheckIn(null);
      setCheckOut(null);
      buscarReservas();
    } catch (err: any) {
      alert('Erro ao reservar: ' + err.message);
    } finally {
      setReservando(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-xl bg-white sticky top-28">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <strong className="text-2xl font-bold text-[#222222]">R$ {imovel.price_per_night}</strong>
          <span className="text-sm text-gray-600"> noite</span>
        </div>
        <span className="text-xs font-semibold text-gray-500">★ Novo</span>
      </div>

      <div className="flex justify-center gap-3 text-[11px] mb-3">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400 inline-block" /> Livre</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-400 inline-block" /> Ocupado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#155E75] inline-block" /> Seleção</span>
      </div>

      <div className="flex justify-between items-center mb-2 bg-gray-50 px-3 py-1.5 rounded-xl">
        <button type="button" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))} className="font-bold text-sm px-2">←</button>
        <span className="font-semibold text-xs capitalize">
          {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => setMesAtual(new Date(ano, mes + 1, 1))} className="font-bold text-sm px-2">→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 mb-1">
        <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {dias.map((item, idx) => {
          if (!item) return <div key={idx} />;
          const ocupado = isOcupado(item.dataStr);
          const sel =
            item.dataStr === checkIn ||
            item.dataStr === checkOut ||
            (checkIn && checkOut && item.dataStr > checkIn && item.dataStr < checkOut);

          let cor = 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100';
          if (ocupado) cor = 'bg-red-50 text-red-500 border-red-200 line-through cursor-not-allowed';
          else if (sel) cor = 'bg-[#155E75] text-white border-[#155E75] font-bold';

          return (
            <button
              key={item.dataStr}
              type="button"
              disabled={ocupado}
              onClick={() => handleDia(item.dataStr)}
              className={`py-1.5 rounded-lg border text-xs transition ${cor}`}
            >
              {item.dia}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 border border-gray-300 rounded-xl overflow-hidden text-xs mb-4">
        <div className="p-2.5 border-r border-gray-300">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Check-in</span>
          <span className="font-medium text-gray-900">{checkIn || 'Escolha no mapa'}</span>
        </div>
        <div className="p-2.5">
          <span className="block text-[10px] font-bold uppercase text-gray-500">Checkout</span>
          <span className="font-medium text-gray-900">{checkOut || 'Escolha no mapa'}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={noites === 0 || reservando}
        onClick={confirmarReserva}
        className="w-full py-3.5 bg-[#E87722] hover:bg-[#d16617] text-white font-bold rounded-xl text-sm disabled:bg-gray-300 transition shadow-sm"
      >
        {reservando ? 'Confirmando...' : noites > 0 ? 'Reservar agora' : 'Selecione as datas'}
      </button>

      {noites > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span className="underline">R$ {imovel.price_per_night} x {noites} noite(s)</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="underline">Taxa de limpeza</span>
            <span>R$ {limpeza.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-900 pt-3 border-t border-gray-200">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
