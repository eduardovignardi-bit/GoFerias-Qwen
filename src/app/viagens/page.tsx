'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LogoGoFerias from '@/components/LogoGoFerias';

export default function MinhasViagens() {
  const router = useRouter();
  const [viagens, setViagens] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarViagens();
  }, []);

  const carregarViagens = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties (
            id,
            title,
            location,
            street,
            street_number,
            neighborhood,
            image_url,
            images
          )
        `)
        .eq('guest_id', user.id)
        .neq('status', 'blocked')
        .order('check_in', { ascending: true });

      if (error) throw error;
      if (data) setViagens(data);
    } catch (err) {
      console.error('Erro ao carregar viagens:', err);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#222222] font-sans">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/marketplace">
            <LogoGoFerias />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/marketplace" className="text-sm font-semibold text-gray-700 hover:underline">
              Explorar acomodações
            </Link>
            <Link href="/anfitriao" className="text-sm font-semibold text-[#155E75] hover:bg-gray-100 px-4 py-2 rounded-full transition">
              Modo Anfitrião
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-[#155E75] mb-2">Viagens</h1>
        <p className="text-sm text-gray-500 mb-8">Acompanhe suas reservas confirmadas e endereços de hospedagem.</p>

        {carregando ? (
          <p className="text-sm text-gray-500">Carregando suas reservas...</p>
        ) : viagens.length === 0 ? (
          <div className="border border-gray-200 rounded-3xl p-10 text-center max-w-lg mx-auto my-12 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Nenhuma viagem reservada ainda</h2>
            <p className="text-sm text-gray-500 mb-6">
              Hora de tirar a poeira das malas e começar a planejar sua próxima aventura.
            </p>
            <Link
              href="/marketplace"
              className="inline-block px-6 py-3 bg-[#E87722] hover:bg-[#d16617] text-white font-bold text-sm rounded-xl transition"
            >
              Começar a explorar
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {viagens.map((reserva) => {
              const imovel = reserva.properties;
              if (!imovel) return null;

              const fotoCapa =
                (Array.isArray(imovel.images) && imovel.images[0]) || imovel.image_url;

              return (
                <div
                  key={reserva.id}
                  className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between bg-white"
                >
                  <div>
                    <div className="h-48 bg-gray-100 relative">
                      {fotoCapa ? (
                        <img src={fotoCapa} alt={imovel.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          Sem foto
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                        Confirmada
                      </span>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase">{imovel.location}</p>
                      <h3 className="font-bold text-lg text-gray-900 mt-0.5 line-clamp-1">{imovel.title}</h3>

                      <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        <div>
                          <span className="block text-gray-400 font-semibold">Check-in</span>
                          <strong className="text-gray-900 text-sm">{reserva.check_in}</strong>
                        </div>
                        <div className="border-l border-gray-200 pl-3">
                          <span className="block text-gray-400 font-semibold">Checkout</span>
                          <strong className="text-gray-900 text-sm">{reserva.check_out}</strong>
                        </div>
                      </div>

                      {imovel.street && (
                        <p className="text-xs text-gray-600">
                          <strong>Endereço:</strong> {imovel.street}, {imovel.street_number || 'S/N'} - {imovel.neighborhood}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      Total ({reserva.nights} noite{reserva.nights > 1 ? 's' : ''}):{' '}
                      <strong className="text-gray-900 text-sm">R$ {Number(reserva.total_price).toFixed(2)}</strong>
                    </div>
                    <Link
                      href={`/imovel/${imovel.id}`}
                      className="text-xs font-bold text-[#155E75] hover:underline"
                    >
                      Ver anúncio →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
