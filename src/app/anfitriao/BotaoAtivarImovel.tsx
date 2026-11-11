'use client';
import { useState } from 'react';

export default function BotaoAtivarImovel({ imovel, userEmail }: any) {
  const [gerando, setGerando] = useState(false);

  const handlePagar = async () => {
    setGerando(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: imovel.id,
          title: imovel.title,
          userEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Erro ao iniciar pagamento.');
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      alert('Erro de conexão ao gerar checkout.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <button
      onClick={handlePagar}
      disabled={gerando}
      className="px-4 py-2 bg-[#E87722] hover:bg-[#d16617] text-white text-xs font-semibold rounded-lg disabled:bg-gray-300 transition shadow-xs"
    >
      {gerando ? 'Abrindo...' : 'Publicar (R$ 69,96/mês)'}
    </button>
  );
}
