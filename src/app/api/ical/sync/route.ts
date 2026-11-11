import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { propertyId, userId, icalUrl } = await request.json();

    if (!icalUrl || !propertyId || !userId) {
      return NextResponse.json({ error: 'Dados incompletos para sincronização.' }, { status: 400 });
    }

    // 1. Salva o link iCal no cadastro do imóvel para sincronizações futuras
    await supabase
      .from('properties')
      .update({ external_ical_url: icalUrl })
      .eq('id', propertyId);

    // 2. Baixa o arquivo .ics do Airbnb ou Booking
    const res = await fetch(icalUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Não foi possível ler o link iCal informado.' }, { status: 400 });
    }
    const textoIcs = await res.text();

    // 3. Extrai os blocos de datas (VEVENT)
    const eventos = textoIcs.split('BEGIN:VEVENT').slice(1);
    let importados = 0;

    for (const bloco of eventos) {
      const startMatch = bloco.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
      const endMatch = bloco.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);

      if (startMatch && endMatch) {
        const s = startMatch[1];
        const e = endMatch[1];
        const checkIn = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        const checkOut = `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}`;

        // Verifica se já existe bloqueio ou reserva nessa exata data para não duplicar
        const { data: existente } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', propertyId)
          .eq('check_in', checkIn)
          .eq('check_out', checkOut);

        if (!existente || existente.length === 0) {
          await supabase.from('bookings').insert([
            {
              property_id: propertyId,
              guest_id: userId,
              check_in: checkIn,
              check_out: checkOut,
              nights: 1,
              cleaning_fee: 0,
              total_price: 0,
              status: 'blocked',
            },
          ]);
          importados++;
        }
      }
    }

    return NextResponse.json({
      sucesso: true,
      importados,
    });
  } catch (error) {
    console.error('Erro no sync iCal:', error);
    return NextResponse.json({ error: 'Falha ao processar arquivo iCal.' }, { status: 500 });
  }
}
