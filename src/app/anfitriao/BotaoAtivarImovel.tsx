'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BotaoAtivarImovel({ imovel }: { imovel: { id: string } }) {
  const [gerando, setGerando] = useState(false);

  const handlePagar = async () => {
    setGerando(true);
    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) {
        window.alert('Sua sessão expirou. Entre novamente para continuar.');
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: imovel.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Erro ao iniciar pagamento.');
        return;
      }

      if (typeof data.checkoutUrl !== 'string') {
        throw new Error('O checkout não retornou um endereço válido.');
      }
      window.location.href = data.checkoutUrl;
    } catch (error) {
      console.error('Erro ao iniciar assinatura:', error);
      window.alert(error instanceof Error ? error.message : 'Erro de conexão ao gerar assinatura.');
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
      {gerando ? 'Abrindo...' : 'Assinar (R$ 69,96/mês)'}
    </button>
  );
}
