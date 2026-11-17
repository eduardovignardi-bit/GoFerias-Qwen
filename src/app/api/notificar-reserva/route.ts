import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const checkIn = typeof body?.checkIn === 'string' ? body.checkIn : '';
    const checkOut = typeof body?.checkOut === 'string' ? body.checkOut : '';
    const nights = Number(body?.nights) || 1;
    const total = Number(body?.total) || 0;

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'Dados incompletos para notificação.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json({ aviso: 'SUPABASE_SERVICE_ROLE_KEY ausente.' }, { status: 200 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: imovel } = await supabaseAdmin
      .from('properties')
      .select('title, owner_id')
      .eq('id', propertyId)
      .single();

    if (!imovel?.owner_id) {
      return NextResponse.json({ aviso: 'Proprietário não localizado.' }, { status: 200 });
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(imovel.owner_id);
    const emailAnfitriao = userData?.user?.email || '';

    const { data: perfilAnfitriao } = await supabaseAdmin
      .from('profiles')
      .select('whatsapp')
      .eq('id', imovel.owner_id)
      .maybeSingle();

    const telefoneBruto = String(perfilAnfitriao?.whatsapp || '').replace(/\D/g, '');
    const telefoneFormatado = telefoneBruto
      ? telefoneBruto.startsWith('55')
        ? telefoneBruto
        : `55${telefoneBruto}`
      : '';

    const urlBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      new URL(request.url).origin;

    const valorFormatado = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (resendKey && emailAnfitriao) {
      await fetch('https://resend.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'GoFérias <onboarding@resend.dev>',
          to: [emailAnfitriao],
          subject: `Nova solicitação de reserva: ${imovel.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
              <h2 style="color: #155E75;">Você recebeu uma nova solicitação de reserva!</h2>
              <p>Um hóspede solicitou estadia no imóvel <strong>${imovel.title}</strong>.</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Check-in:</strong> ${checkIn}</p>
                <p style="margin: 4px 0;"><strong>Check-out:</strong> ${checkOut}</p>
                <p style="margin: 4px 0;"><strong>Duração:</strong> ${nights} noite(s)</p>
                <p style="margin: 4px 0; color: #047857;"><strong>Valor integral a receber:</strong> ${valorFormatado}</p>
              </div>
              <p>Acesse seu painel do anfitrião para aprovar a estadia e liberar o pagamento para o hóspede:</p>
              <a href="${urlBase}/anfitriao" style="display: inline-block; background: #E87722; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 8px;">
                Acessar Painel do Anfitrião
              </a>
            </div>
          `,
        }),
      }).catch((err) => console.error('Erro ao enviar e-mail Resend:', err));
    }

    const textoWhats = `Olá! Acabei de solicitar uma reserva no GoFérias para o imóvel "${imovel.title}" (${checkIn} até ${checkOut} - ${nights} noite(s), total ${valorFormatado}). Poderia confirmar a disponibilidade no painel para liberar o pagamento? ${urlBase}/anfitriao`;
    const whatsappUrl = telefoneFormatado
      ? `https://wa.me/${telefoneFormatado}?text=${encodeURIComponent(textoWhats)}`
      : null;

    return NextResponse.json({
      notificado: true,
      emailEnviado: Boolean(resendKey && emailAnfitriao),
      whatsappUrl,
    });
  } catch (error) {
    console.error('Erro em /api/notificar-reserva:', error);
    return NextResponse.json({ error: 'Falha ao notificar anfitrião.' }, { status: 500 });
  }
}
