import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { ADDITIONAL_PROPERTY_MONTHLY_PRICE } from '@/lib/billing';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const token = (process.env.MP_ACCESS_TOKEN || '').trim();
    if (!token || token.length < 15) {
      return NextResponse.json(
        { error: 'Chave MP_ACCESS_TOKEN ausente ou inválida.' },
        { status: 400 }
      );
    }

    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: 'Faça login para assinar um imóvel adicional.' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Dados inválidos para iniciar a assinatura.' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object' || !('propertyId' in payload)) {
      return NextResponse.json({ error: 'Dados inválidos para iniciar a assinatura.' }, { status: 400 });
    }

    const propertyId = payload.propertyId;
    if (typeof propertyId !== 'string' || !propertyId.trim()) {
      return NextResponse.json({ error: 'Imóvel inválido.' }, { status: 400 });
    }

    const supabaseAutenticado = createAuthenticatedSupabaseClient(accessToken);
    const { data: { user }, error: erroUsuario } = await supabaseAutenticado.auth.getUser(accessToken);
    if (erroUsuario || !user) {
      return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 });
    }

    const { data: imoveisDoAnfitriao, error: erroImoveis } = await supabaseAutenticado
      .from('properties')
      .select('id, title, is_active, is_paid_slot, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (erroImoveis) throw erroImoveis;
    const imoveis = imoveisDoAnfitriao || [];
    const imovel = imoveis.find((item) => item.id === propertyId);

    if (!imovel) {
      return NextResponse.json({ error: 'Imóvel não encontrado para esta conta.' }, { status: 404 });
    }
    if (imoveis.length < 2 || !imovel.is_paid_slot) {
      return NextResponse.json({ error: 'O primeiro imóvel é gratuito e não precisa de assinatura.' }, { status: 400 });
    }
    if (imovel.is_active) {
      return NextResponse.json({ error: 'Este imóvel já está ativo.' }, { status: 409 });
    }

    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const requestOrigin = new URL(request.url).origin;
    const origin = configuredUrl
      ? new URL(configuredUrl).origin
      : requestOrigin;

    const client = new MercadoPagoConfig({ accessToken: token });
    const assinatura = new PreApproval(client);
    const subscriptionBody = {
      reason: `Plano mensal GoFérias - ${imovel.title.slice(0, 50)}`,
      external_reference: String(propertyId),
      payer_email: user.email,
      back_url: `${origin}/anfitriao?pagamento=retorno`,
      notification_url: `${origin}/api/webhook/mercadopago`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: ADDITIONAL_PROPERTY_MONTHLY_PRICE,
        currency_id: 'BRL',
      },
    };
    const response = await assinatura.create({
      body: subscriptionBody,
    });

    if (!response.init_point) {
      throw new Error('O Mercado Pago não retornou o endereço de autorização da assinatura.');
    }

    return NextResponse.json({
      checkoutUrl: response.init_point,
    });
  } catch (error) {
    console.error('Erro ao criar assinatura no Mercado Pago:', error);
    return NextResponse.json(
      { error: 'Não foi possível iniciar a assinatura. Tente novamente.' },
      { status: 500 }
    );
  }
}
