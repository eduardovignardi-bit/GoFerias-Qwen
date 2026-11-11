'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ModalEditarImovel from './ModalEditarImovel';
import ModalCalendarioProprietario from './ModalCalendarioProprietario';
import BotaoAtivarImovel from './BotaoAtivarImovel';
import GaleriaCard from '../marketplace/GaleriaCard';
import LogoGoFerias from '@/components/LogoGoFerias';

export default function AreaAnfitriao() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [urlAirbnb, setUrlAirbnb] = useState('');
  const [textoManual, setTextoManual] = useState('');
  const [mostrarTextoManual, setMostrarTextoManual] = useState(false);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [imovelEditando, setImovelEditando] = useState<any | null>(null);
  const [imovelCalendario, setImovelCalendario] = useState<any | null>(null);

  useEffect(() => {
    verificarRetornoPagamento();
    carregarDadosUsuario();
  }, []);

  const verificarRetornoPagamento = async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('pagamento') === 'sucesso' && params.get('imovelId')) {
      await supabase
        .from('properties')
        .update({ is_active: true, is_paid_slot: true })
        .eq('id', params.get('imovelId'));
      alert('Pagamento aprovado! Seu anúncio já está ativo.');
      window.history.replaceState({}, '', '/anfitriao');
      carregarDadosUsuario();
    }
  };

  const carregarDadosUsuario = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/');
    setUserId(user.id);
    setUserEmail(user.email || '');
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setImoveis(data);
  };

  const handleImportar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlAirbnb, userId, textoManual }),
      });
      const data = await res.json();
      if (data.bloqueioAirbnb) {
        setMostrarTextoManual(true);
        return alert(data.error);
      }
      if (!res.ok) return alert(data.error || 'Erro ao importar.');
      if (data.precisaAtivar) alert('Anúncio salvo como rascunho. Ative por R$ 69,96/mês.');
      setUrlAirbnb('');
      setTextoManual('');
      setMostrarTextoManual(false);
      carregarDadosUsuario();
    } catch {
      alert('Erro de conexão com a IA.');
    } finally {
      setCarregando(false);
    }
  };

  const imoveisAtivos = imoveis.filter((i) => i.is_active).length;

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <LogoGoFerias subtitulo="Modo Anfitrião" />
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-sm font-semibold text-[#155E75] hover:bg-gray-100 px-4 py-2 rounded-full transition">
              Mudar para viajante
            </Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-sm font-medium text-gray-500 hover:text-black">
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#155E75]">Seus anúncios</h1>
          <p className="text-sm text-gray-500 mt-1">
            1º anúncio gratuito · Adicionais por R$ 69,96/mês ({imoveisAtivos} ativo de {imoveis.length})
          </p>
        </div>

        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 mb-10">
          <form onSubmit={handleImportar} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                value={urlAirbnb}
                onChange={(e) => setUrlAirbnb(e.target.value)}
                placeholder="Importar link do Airbnb (https://airbnb.com.br...)"
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#155E75] transition"
              />
              <button
                type="submit"
                disabled={carregando}
                className="px-6 py-3 bg-[#E87722] hover:bg-[#d16617] text-white font-semibold rounded-xl text-sm transition"
              >
                {carregando ? 'Importando...' : 'Importar espaço'}
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setMostrarTextoManual(!mostrarTextoManual)}
                className="text-xs font-semibold underline text-gray-600 hover:text-black"
              >
                {mostrarTextoManual ? 'Ocultar texto manual' : 'Colar descrição manualmente'}
              </button>
              {mostrarTextoManual && (
                <textarea
                  rows={3}
                  value={textoManual}
                  onChange={(e) => setTextoManual(e.target.value)}
                  placeholder="Cole o conteúdo da página aqui..."
                  className="mt-2 w-full p-3 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-[#155E75]"
                />
              )}
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {imoveis.map((imovel) => {
            const imovelCincoFotos = {
              ...imovel,
              images: Array.isArray(imovel.images) ? imovel.images.slice(0, 5) : [],
            };

            return (
              <div key={imovel.id} className="flex flex-col group">
                <div className="relative rounded-2xl overflow-hidden aspect-4/3 bg-gray-100 mb-3 border border-gray-200">
                  <GaleriaCard imovel={imovelCincoFotos} />
                  <span className="absolute top-3 left-3 bg-white/95 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                    <span className={`w-2 h-2 rounded-full ${imovel.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {imovel.is_active ? 'Publicado' : 'Inativo'}
                  </span>
                </div>

                <h3 className="font-semibold text-base text-gray-900 line-clamp-1">{imovel.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {imovel.location} · <strong className="text-gray-900 font-medium">R$ {imovel.price_per_night}</strong>/noite · Limpeza R$ {imovel.cleaning_fee || 0}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setImovelCalendario(imovel)}
                    className="px-3.5 py-2 border border-gray-300 hover:border-[#155E75] text-gray-900 text-xs font-semibold rounded-lg transition"
                  >
                    Calendário
                  </button>
                  <button
                    onClick={() => setImovelEditando(imovel)}
                    className="px-3.5 py-2 border border-gray-300 hover:border-[#155E75] text-gray-900 text-xs font-semibold rounded-lg transition"
                  >
                    Editar
                  </button>
                  {!imovel.is_active && (
                    <BotaoAtivarImovel imovel={imovel} userEmail={userEmail} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {imovelEditando && (
        <ModalEditarImovel imovel={imovelEditando} onClose={() => setImovelEditando(null)} onSalvo={carregarDadosUsuario} />
      )}
      {imovelCalendario && (
        <ModalCalendarioProprietario imovel={imovelCalendario} userId={userId} onClose={() => setImovelCalendario(null)} />
      )}
    </div>
  );
}
