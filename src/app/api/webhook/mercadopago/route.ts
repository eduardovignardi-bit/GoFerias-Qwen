import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { ADDITIONAL_PROPERTY_MONTHLY_PRICE } from '@/lib/billing';

function obterSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const paymentId =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      body?.data?.id;

    const topic =
      url.searchParams.get('type') ||
      url.searchParams.get('topic') ||
      body?.type;

    if (!paymentId || !['payment', 'preapproval', 'subscription_preapproval'].includes(topic)) {
      return NextResponse.json({ recebido: true }, { status: 200 });
    }

    const token = (process.env.MP_ACCESS_TOKEN || '').trim();
    if (!token || token.length < 15) {
      throw new Error('MP_ACCESS_TOKEN ausente ou inválido.');
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const supabaseAdmin = obterSupabaseAdmin();

    // 1. NOTIFICAÇÃO DE PAGAMENTO AVULSO (RESERVA OU COBRANÇA ÚNICA)
    if (topic === 'payment') {
      const payment = new Payment(client);
      const dadosPagamento = await payment.get({ id: String(paymentId) });

      const referencia = dadosPagamento.external_reference;
      const statusPgto = dadosPagamento.status;
      const valorPagoCentavos = Math.round((Number(dadosPagamento.transaction_amount) || 0) * 100);

      if (!referencia || dadosPagamento.currency_id !== 'BRL') {
        return NextResponse.json({ recebido: true }, { status: 200 });
      }

      // Verifica se o external_reference é o ID de uma Reserva (tabela bookings)
      const { data: reserva } = await supabaseAdmin
        .from('bookings')
        .select('id, total_price, status')
        .eq('id', referencia)
        .maybeSingle();

      if (reserva) {
        const valorReservaCentavos = Math.round((Number(reserva.total_price) || 0) * 100);

        if (statusPgto === 'approved' && valorPagoCentavos >= valorReservaCentavos) {
          const { error: erroReserva } = await supabaseAdmin
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', reserva.id);

          if (erroReserva) throw erroReserva;
        } else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(statusPgto || '')) {
          await supabaseAdmin
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', reserva.id);
        }

        return NextResponse.json({ recebido: true, tipo: 'reserva' }, { status: 200 });
      }

      // Se não é reserva, verifica se é pagamento avulso de Assinatura de Imóvel Adicional
      const valorAssinaturaCentavos = Math.round(ADDITIONAL_PROPERTY_MONTHLY_PRICE * 100);
      if (statusPgto === 'approved' && valorPagoCentavos === valorAssinaturaCentavos) {
        const { error: erroImovel } = await supabaseAdmin
          .from('properties')
          .update({ is_active: true, is_paid_slot: true })
          .eq('id', referencia);

        if (erroImovel) throw erroImovel;
      }

      return NextResponse.json({ recebido: true, tipo: 'pagamento_imovel' }, { status: 200 });
    }

    // 2. NOTIFICAÇÃO DE ASSINATURA RECORRENTE (PREAPPROVAL)
    const preApproval = new PreApproval(client);
    const assinatura = await preApproval.get({ id: String(paymentId) });
    const imovelId = assinatura.external_reference;
    const valorAssinaturaCentavos = Math.round(
      (Number(assinatura.auto_recurring?.transaction_amount) || 0) * 100
    );
    const valorEsperadoCentavos = Math.round(ADDITIONAL_PROPERTY_MONTHLY_PRICE * 100);

    if (
      imovelId &&
      ['authorized', 'paused', 'cancelled', 'pending'].includes(assinatura.status || '') &&
      assinatura.auto_recurring?.currency_id === 'BRL' &&
      valorAssinaturaCentavos === valorEsperadoCentavos
    ) {
      const ativarImovel = assinatura.status === 'authorized';
      const { error: erroAssinatura } = await supabaseAdmin
        .from('properties')
        .update({ is_active: ativarImovel, is_paid_slot: true })
        .eq('id', imovelId);

      if (erroAssinatura) throw erroAssinatura;
    }

    return NextResponse.json({ recebido: true, tipo: 'assinatura' }, { status: 200 });
  } catch (error) {
    console.error('Erro no Webhook Mercado Pago:', error);
    return NextResponse.json({ error: 'Falha ao processar webhook' }, { status: 500 });
  }
}
