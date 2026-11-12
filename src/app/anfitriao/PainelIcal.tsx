'use client';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  imovel: { id: string; external_ical_url?: string | null };
  onSincronizado: () => void;
};

export default function PainelIcal({ imovel, onSincronizado }: Props) {
  const [icalExterno, setIcalExterno] = useState(imovel.external_ical_url || '');
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const linkExportacao =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/ical/${imovel.id}`
      : `/api/ical/${imovel.id}`;

  const handleSincronizar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setSincronizando(true);
    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) throw new Error('Entre na sua conta para sincronizar o calendário.');
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(session.access_token),
        },
        body: JSON.stringify({
          propertyId: imovel.id,
          icalUrl: icalExterno,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao sincronizar.');
      }
      setMensagem(`Sincronização concluída! ${data.importados} bloqueio(s) importado(s).`);
      onSincronizado();
    } catch (error) {
      console.error('Erro ao sincronizar calendário iCal:', error);
      setErro(error instanceof Error ? error.message : 'Erro de rede ao sincronizar iCal.');
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="border-t pt-4 mt-4 space-y-3 bg-gray-50 p-3 rounded-xl">
      <h4 className="text-xs font-bold uppercase text-gray-700">Sincronização iCal (Airbnb / Booking)</h4>
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
          1. Exportar Calendário GoFerias (Cole no Airbnb):
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={linkExportacao}
            className="flex-1 px-2.5 py-1.5 bg-white border rounded-lg text-xs text-gray-600"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(linkExportacao);
              alert('Link iCal copiado!');
            }}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-xs font-bold rounded-lg"
          >
            Copiar
          </button>
        </div>
      </div>
      <form onSubmit={handleSincronizar}>
        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
          2. Importar Calendário Externo (Link .ics do Airbnb):
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            required
            value={icalExterno}
            onChange={(e) => setIcalExterno(e.target.value)}
            placeholder="https://airbnb.com.br..."
            className="flex-1 px-2.5 py-1.5 bg-white border rounded-lg text-xs"
          />
          <button
            type="submit"
            disabled={sincronizando}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
          >
            {sincronizando ? 'Lendo...' : 'Sincronizar'}
          </button>
        </div>
      </form>
      {mensagem && <p role="status" className="text-xs text-emerald-700">{mensagem}</p>}
      {erro && <p role="alert" className="text-xs text-rose-700">{erro}</p>}
    </div>
  );
}
