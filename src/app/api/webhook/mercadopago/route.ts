import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
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

    if (topic === 'payment' && paymentId) {
      const token = (process.env.MP_ACCESS_TOKEN || '').trim();
      const client = new MercadoPagoConfig({ accessToken: token });
      const payment = new Payment(client);

      // Consulta o status real do pagamento direto no Mercado Pago por segurança
      const dadosPagamento = await payment.get({ id: String(paymentId) });

      if (dadosPagamento.status === 'approved' && dadosPagamento.external_reference) {
        const imovelId = dadosPagamento.external_reference;

        await supabase
          .from('properties')
          .update({ is_active: true, is_paid_slot: true })
          .eq('id', imovelId);
      }
    }

    // O Mercado Pago exige resposta 200 OK para parar de reenviar a notificação
    return NextResponse.json({ recebido: true }, { status: 200 });
  } catch (error) {
    console.error('Erro no Webhook Mercado Pago:', error);
    return NextResponse.json({ error: 'Falha ao processar webhook' }, { status: 500 });
  }
}
