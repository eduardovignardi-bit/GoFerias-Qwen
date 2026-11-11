import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(request: Request) {
  try {
    const token = (process.env.MP_ACCESS_TOKEN || '').trim();
    if (!token || token.length < 15) {
      return NextResponse.json(
        { error: 'Chave MP_ACCESS_TOKEN ausente ou inválida.' },
        { status: 400 }
      );
    }

    const { propertyId, title, userEmail } = await request.json();
    const origin = request.headers.get('origin') || 'https://goferias.com.br';
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

    const client = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(client);

    const bodyMP: any = {
      items: [
        {
          id: String(propertyId),
          title: `Ativação Mensal GoFerias - ${String(title).slice(0, 50)}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: 69.96,
        },
      ],
      payer: {
        email: userEmail || 'anfitriao@goferias.com.br',
      },
      external_reference: String(propertyId),
      back_urls: {
        success: `${origin}/anfitriao?pagamento=sucesso&imovelId=${propertyId}`,
        failure: `${origin}/anfitriao?pagamento=falha`,
        pending: `${origin}/anfitriao?pagamento=pendente`,
      },
    };

    if (!isLocalhost) {
      bodyMP.auto_return = 'approved';
      bodyMP.notification_url = `${origin}/api/webhook/mercadopago`;
    }

    const response = await preference.create({ body: bodyMP });

    return NextResponse.json({
      checkoutUrl: response.init_point,
    });
  } catch (error: any) {
    console.error('Erro SDK Mercado Pago:', error);
    return NextResponse.json(
      { error: `Erro ao gerar checkout: ${error.message || 'Falha na comunicação'}` },
      { status: 500 }
    );
  }
}
