import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await context.params;

    const { data: reservas, error } = await supabase
      .from('bookings')
      .select('id, check_in, check_out, status')
      .eq('property_id', propertyId);

    if (error) throw error;

    const formatarDataICS = (dataStr: string) => dataStr.replace(/-/g, '');

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GoFerias//Channel Manager 1.0//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    (reservas || []).forEach((r) => {
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${r.id}@goferias.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${formatarDataICS(r.check_in)}`,
        `DTEND;VALUE=DATE:${formatarDataICS(r.check_out)}`,
        `SUMMARY:${r.status === 'blocked' ? 'Bloqueado - GoFerias' : 'Reservado - GoFerias'}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    return new NextResponse(icsContent.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="goferias-${propertyId}.ics"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao gerar calendário iCal' }, { status: 500 });
  }
}
