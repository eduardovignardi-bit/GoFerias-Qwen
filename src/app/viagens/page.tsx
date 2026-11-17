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
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [erroPagamento, setErroPagamento] = useState('');
  const [solicitada, setSolicitada] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [cpfSalvo, setCpfSalvo] = useState('');
  const [reservaParaPagar, setReservaParaPagar] = useState<any | null>(null);
  const [cpfInput, setCpfInput] = useState('');
  const [erroCpf, setErroCpf] = useState('');

  const formatarCpf = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 11);
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const validarCpf = (cpf: string) => {
    const num = cpf.replace(/\D/g, '');
    if (num.length !== 11 || /^(\d)\1+$/.test(num)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(num[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== Number(num[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(num[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === Number(num[10]);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('solicitada') === '1') {
      setSolicitada(true);
    }
    const wa = params.get('wa');
    if (wa) {
      setWhatsappUrl(wa);
    }
    carregarViagens();
  }, []);

  const carregarViagens = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data: perfil } = await supabase
        .from('profiles')
        .select('cpf')
        .eq('id', user.id)
        .maybeSingle();

      if (perfil?.cpf) {
        setCpfSalvo(perfil.cpf);
      }

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

  const iniciarPagamento = async (reserva: any, cpfConfirmado?: string) => {
    const cpfFinal = (cpfConfirmado || cpfSalvo).replace(/\D/g, '');
    if (!validarCpf(cpfFinal)) {
      setCpfInput(cpfSalvo ? formatarCpf(cpfSalvo) : '');
      setErroCpf('');
      setReservaParaPagar(reserva);
      return;
    }

    setPagandoId(reserva.id);
    setErroPagamento('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ cpf: cpfFinal }).eq('id', user.id);
        setCpfSalvo(cpfFinal);
      }

      const resp = await fetch('/api/checkout/reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: reserva.id,
          propertyId: reserva.property_id,
          total: Number(reserva.total_price),
          cpf: cpfFinal,
        }),
      });

      const dados = await resp.json();
      if (!resp.ok || !dados?.init_point) {
        throw new Error(dados?.error || 'Não foi possível gerar o link de pagamento.');
      }

      window.location.href = dados.init_point;
    } catch (err) {
      setErroPagamento(err instanceof Error ? err.message : 'Erro ao abrir pagamento.');
      setPagandoId(null);
    }
  };

  const obterStatusVisual = (status?: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed' || s === 'paid') {
      return { rotulo: 'Confirmada e paga', cor: 'bg-emerald-600 text-white' };
    }
    if (s === 'approved') {
      return { rotulo: 'Aprovada · Aguardando pagamento', cor: 'bg-[#155E75] text-white' };
    }
    if (s === 'cancelled' || s === 'canceled' || s === 'rejected') {
      return { rotulo: 'Recusada / Cancelada', cor: 'bg-rose-600 text-white' };
    }
    return { rotulo: 'Aguardando aprovação do anfitrião', cor: 'bg-amber-500 text-white' };
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
        {solicitada && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
            <p className="font-bold">Solicitação de reserva enviada ao anfitrião!</p>
            <p className="mt-1 text-xs text-emerald-800">
              Assim que o proprietário confirmar a disponibilidade no painel dele, o botão de pagamento será liberado abaixo.
            </p>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                Avisar anfitrião agora pelo WhatsApp
              </a>
            )}
          </div>
        )}

        {erroPagamento && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {erroPagamento}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-[#155E75] mb-2">Viagens</h1>
        <p className="text-sm text-gray-500 mb-8">Acompanhe suas solicitações, liberações de pagamento e reservas confirmadas.</p>

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
              const statusInfo = obterStatusVisual(reserva.status);
              const s = (reserva.status || '').toLowerCase();
              const podePagar = s === 'approved';
              const jaPago = s === 'confirmed' || s === 'paid';

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
                      <span className={`absolute top-3 left-3 text-[11px] font-bold px-3 py-1 rounded-full shadow-xs ${statusInfo.cor}`}>
                        {statusInfo.rotulo}
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

                      {jaPago && imovel.street && (
                        <p className="text-xs text-gray-600">
                          <strong>Endereço completo:</strong> {imovel.street}, {imovel.street_number || 'S/N'} - {imovel.neighborhood}
                        </p>
                      )}

                      {podePagar && (
                        <div className="mt-4">
                          <button
                            type="button"
                            disabled={pagandoId === reserva.id}
                            onClick={() => void iniciarPagamento(reserva)}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {pagandoId === reserva.id
                              ? 'Abrindo Mercado Pago...'
                              : `Pagar agora · R$ ${Number(reserva.total_price).toFixed(2)}`}
                          </button>
                        </div>
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

        {reservaParaPagar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!validarCpf(cpfInput)) {
                  setErroCpf('Informe um CPF válido com 11 dígitos.');
                  return;
                }
                const reservaAlvo = reservaParaPagar;
                setReservaParaPagar(null);
                void iniciarPagamento(reservaAlvo, cpfInput);
              }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-900">Informe seu CPF para continuar</h3>
              <p className="mt-1 text-xs text-slate-600">
                Necessário para emissão do comprovante fiscal e identificação junto ao Mercado Pago.
              </p>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">CPF do titular</span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => {
                    setErroCpf('');
                    setCpfInput(formatarCpf(e.target.value));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#155E75]"
                />
              </label>

              {erroCpf && <p className="mt-2 text-xs font-semibold text-rose-600">{erroCpf}</p>}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReservaParaPagar(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Ir para o pagamento
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
