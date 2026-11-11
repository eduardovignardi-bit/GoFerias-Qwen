'use client';
import { useState } from 'react';

export default function PainelIcal({ imovel, userId, onSincronizado }: any) {
  const [icalExterno, setIcalExterno] = useState(imovel.external_ical_url || '');
  const [sincronizando, setSincronizando] = useState(false);

  const linkExportacao =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/ical/${imovel.id}`
      : `/api/ical/${imovel.id}`;

  const handleSincronizar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSincronizando(true);
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: imovel.id,
          userId,
          icalUrl: icalExterno,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao sincronizar.');
        return;
      }
      alert(`Sincronização concluída! ${data.importados} bloqueio(s) importado(s).`);
      onSincronizado();
    } catch {
      alert('Erro de rede ao sincronizar iCal.');
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
    </div>
  );
}
