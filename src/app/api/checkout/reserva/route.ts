import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Chave MP_ACCESS_TOKEN não configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : '';
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';

    if (!bookingId || !propertyId) {
      return NextResponse.json(
        { error: 'Dados da reserva incompletos para gerar o pagamento.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: reserva, error: erroReserva } = await supabase
      .from('bookings')
      .select('id, total_price, nights, check_in, check_out, property_id')
      .eq('id', bookingId)
      .eq('property_id', propertyId)
      .single();

    if (erroReserva || !reserva) {
      return NextResponse.json(
        { error: 'Reserva não encontrada para pagamento.' },
        { status: 404 }
      );
    }

    const { data: imovel } = await supabase
      .from('properties')
      .select('title')
      .eq('id', propertyId)
      .single();

    const valorTotal = Number(reserva.total_price);
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      return NextResponse.json(
        { error: 'Valor total da reserva inválido.' },
        { status: 400 }
      );
    }

    const urlBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      new URL(request.url).origin;

    const isLocalhost = urlBase.includes('localhost') || urlBase.includes('127.0.0.1');

    const tituloItem = imovel?.title
      ? `Reserva GoFérias: ${imovel.title} (${reserva.nights} noite(s))`
      : `Reserva de Hospedagem GoFérias (${reserva.nights} noite(s))`;

    const preferencia: Record<string, unknown> = {
      items: [
        {
          id: reserva.id,
          title: tituloItem.slice(0, 250),
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(valorTotal.toFixed(2)),
        },
      ],
      external_reference: reserva.id,
      back_urls: {
        success: `${urlBase}/viagens?pagamento=sucesso&reserva=${reserva.id}`,
        pending: `${urlBase}/viagens?pagamento=pendente&reserva=${reserva.id}`,
        failure: `${urlBase}/imovel/${propertyId}?pagamento=falha`,
      },
      ...(isLocalhost
        ? {}
        : {
            auto_return: 'approved',
            notification_url: `${urlBase}/api/webhook/mercadopago`,
          }),
    };

    const respostaMp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferencia),
    });

    const dadosMp = await respostaMp.json();

    if (!respostaMp.ok || !dadosMp?.init_point) {
      console.error('Erro Mercado Pago Checkout Reserva:', dadosMp);
      return NextResponse.json(
        { error: dadosMp?.message || 'Falha ao criar preferência de pagamento no Mercado Pago.' },
        { status: 502 }
      );
    }

    const isSandbox = accessToken.startsWith('TEST-');

    return NextResponse.json({
      init_point: isSandbox && dadosMp.sandbox_init_point ? dadosMp.sandbox_init_point : dadosMp.init_point,
      sandbox_init_point: dadosMp.sandbox_init_point,
      preference_id: dadosMp.id,
    });
  } catch (error) {
    console.error('Erro interno em /api/checkout/reserva:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao processar pagamento.' },
      { status: 500 }
    );
  }
}
