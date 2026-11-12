'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PainelIcal from './PainelIcal';

export default function ModalCalendarioProprietario({ imovel, userId, onClose }: any) {
  const [reservas, setReservas] = useState<any[]>([]);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [inicio, setInicio] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    carregarReservas();
  }, [imovel.id]);

  const carregarReservas = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', imovel.id)
      .order('check_in', { ascending: true });
    if (data) setReservas(data);
  };

  const getReserva = (dataStr: string) => {
    return reservas.find((r) => dataStr >= r.check_in && dataStr < r.check_out);
  };

  const handleCliqueDia = (dataStr: string) => {
    if (getReserva(dataStr)) return;
    if (!inicio || (inicio && fim)) {
      setInicio(dataStr);
      setFim(null);
    } else if (dataStr <= inicio) {
      setInicio(dataStr);
    } else {
      setFim(dataStr);
    }
  };

  const handleBloquear = async () => {
    if (!inicio || !fim) return;
    setProcessando(true);
    try {
      const { error } = await supabase.from('bookings').insert([
        {
          property_id: imovel.id,
          guest_id: userId,
          check_in: inicio,
          check_out: fim,
          nights: 1,
          cleaning_fee: 0,
          total_price: 0,
          status: 'blocked',
        },
      ]);
      if (error) throw error;
      setInicio(null);
      setFim(null);
      carregarReservas();
    } catch (err: any) {
      alert('Erro ao bloquear: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const dias = [];
  for (let i = 0; i < primeiroDia; i++) dias.push(null);
  for (let d = 1; d <= totalDias; d++) {
    const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dias.push({ dia: d, dataStr: dataFormatada });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold line-clamp-1">Calendário: {imovel.title}</h3>
          <button onClick={onClose} className="font-bold text-gray-500">X</button>
        </div>

        <div className="flex justify-between items-center mb-3 bg-gray-50 p-2 rounded-xl">
          <button type="button" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))} className="px-3 py-1 font-bold text-sm">←</button>
          <span className="font-bold text-sm capitalize">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => setMesAtual(new Date(ano, mes + 1, 1))} className="px-3 py-1 font-bold text-sm">→</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {dias.map((item, idx) => {
            if (!item) return <div key={idx} />;
            const res = getReserva(item.dataStr);
            const sel = item.dataStr === inicio || item.dataStr === fim || (inicio && fim && item.dataStr > inicio && item.dataStr < fim);
            let cor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
            if (res) cor = res.status === 'blocked' ? 'bg-gray-300 text-gray-700' : 'bg-rose-200 text-rose-900 font-bold';
            else if (sel) cor = 'bg-blue-600 text-white font-bold';

            return (
              <button
                key={item.dataStr}
                type="button"
                disabled={!!res}
                onClick={() => handleCliqueDia(item.dataStr)}
                className={`py-2 rounded-lg border text-xs ${cor}`}
              >
                {item.dia}
              </button>
            );
          })}
        </div>

        {inicio && fim && (
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex justify-between items-center mb-4">
            <span className="text-xs">Bloquear: <strong>{inicio}</strong> a <strong>{fim}</strong></span>
            <button onClick={handleBloquear} disabled={processando} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">
              {processando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        )}

        <PainelIcal imovel={imovel} onSincronizado={carregarReservas} />

        <div className="border-t pt-3 mt-4">
          <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Histórico ({reservas.length})</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {reservas.map((r) => (
              <div key={r.id} className="text-xs p-2 rounded-lg border bg-gray-50 flex justify-between">
                <span>{r.status === 'blocked' ? 'Bloqueio/iCal' : 'Reserva'}: {r.check_in} a {r.check_out}</span>
                {r.status !== 'blocked' && <strong>R$ {Number(r.total_price).toFixed(2)}</strong>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
