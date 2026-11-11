import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { ADDITIONAL_PROPERTY_MONTHLY_PRICE } from '@/lib/billing';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    // O Mercado Pago envia o ID do pagamento na URL (?data.id=...) ou no corpo (body.data.id)
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
    let imovelId: string | undefined;
    let ativarImovel = false;

    if (topic === 'payment') {
      const payment = new Payment(client);
      const dadosPagamento = await payment.get({ id: String(paymentId) });
      const valorPago = Math.round((Number(dadosPagamento.transaction_amount) || 0) * 100);
      const valorEsperado = Math.round(ADDITIONAL_PROPERTY_MONTHLY_PRICE * 100);

      if (
        dadosPagamento.status === 'approved' &&
        dadosPagamento.currency_id === 'BRL' &&
        valorPago === valorEsperado &&
        dadosPagamento.external_reference
      ) {
        imovelId = dadosPagamento.external_reference;
        ativarImovel = true;
      }
    } else {
      const preApproval = new PreApproval(client);
      const assinatura = await preApproval.get({ id: String(paymentId) });
      const valorAssinatura = Math.round(
        (Number(assinatura.auto_recurring?.transaction_amount) || 0) * 100
      );
      const valorEsperado = Math.round(ADDITIONAL_PROPERTY_MONTHLY_PRICE * 100);

      if (
        ['authorized', 'paused', 'cancelled', 'pending'].includes(assinatura.status || '') &&
        assinatura.auto_recurring?.currency_id === 'BRL' &&
        valorAssinatura === valorEsperado &&
        assinatura.external_reference
      ) {
        imovelId = assinatura.external_reference;
        ativarImovel = assinatura.status === 'authorized';
      }
    }

    if (imovelId) {
      const { data: imovelAtualizado, error } = await supabase
        .from('properties')
        .update({ is_active: ativarImovel, is_paid_slot: true })
        .eq('id', imovelId)
        .eq('is_paid_slot', true)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!imovelAtualizado) {
        throw new Error('O imóvel não foi atualizado; verifique sua existência e elegibilidade.');
      }
    }

    return NextResponse.json({ recebido: true }, { status: 200 });
  } catch (error) {
    console.error('Erro no Webhook Mercado Pago:', error);
    return NextResponse.json({ error: 'Falha ao processar webhook' }, { status: 500 });
  }
}
