import { NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase';

const TAMANHO_MAXIMO_ICS = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const DOMINIOS_ICAL_PERMITIDOS = ['airbnb.com', 'booking.com'];

function validarUrlIcal(valor: string) {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('Informe um link iCal válido do Airbnb ou Booking.');
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const dominioPermitido = DOMINIOS_ICAL_PERMITIDOS.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`)
  );
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !dominioPermitido
  ) {
    throw new Error('Use um link HTTPS válido do Airbnb ou Booking.');
  }

  return url;
}

async function baixarCalendario(urlInicial: URL) {
  let urlAtual = urlInicial;

  for (let redirecionamentos = 0; redirecionamentos <= MAX_REDIRECTS; redirecionamentos++) {
    const resposta = await fetch(urlAtual, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
    });

    if (resposta.status >= 300 && resposta.status < 400) {
      const localizacao = resposta.headers.get('location');
      if (!localizacao || redirecionamentos === MAX_REDIRECTS) {
        throw new Error('O link iCal excedeu o limite de redirecionamentos.');
      }
      urlAtual = validarUrlIcal(new URL(localizacao, urlAtual).toString());
      continue;
    }

    if (!resposta.ok) throw new Error('Não foi possível ler o link iCal informado.');
    const tamanhoInformado = Number(resposta.headers.get('content-length'));
    if (Number.isFinite(tamanhoInformado) && tamanhoInformado > TAMANHO_MAXIMO_ICS) {
      throw new Error('O arquivo iCal excede o limite permitido de 2 MB.');
    }

    const leitor = resposta.body?.getReader();
    if (!leitor) throw new Error('O link iCal não retornou um arquivo legível.');
    const partes: Uint8Array[] = [];
    let tamanhoTotal = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanhoTotal += value.byteLength;
      if (tamanhoTotal > TAMANHO_MAXIMO_ICS) {
        await leitor.cancel();
        throw new Error('O arquivo iCal excede o limite permitido de 2 MB.');
      }
      partes.push(value);
    }
    const bytes = new Uint8Array(tamanhoTotal);
    let deslocamento = 0;
    for (const parte of partes) {
      bytes.set(parte, deslocamento);
      deslocamento += parte.byteLength;
    }
    const conteudo = new TextDecoder().decode(bytes);
    if (!conteudo.includes('BEGIN:VCALENDAR')) {
      throw new Error('O endereço informado não retornou um calendário iCal válido.');
    }
    return conteudo;
  }

  throw new Error('Não foi possível seguir os redirecionamentos do calendário.');
}

function dataIcalValida(valor: string) {
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`;
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: 'Entre na sua conta para sincronizar o calendário.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Envie dados válidos para sincronização.' }, { status: 400 });
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('propertyId' in payload) ||
    typeof payload.propertyId !== 'string' ||
    !payload.propertyId.trim() ||
    !('icalUrl' in payload) ||
    typeof payload.icalUrl !== 'string' ||
    !payload.icalUrl.trim()
  ) {
    return NextResponse.json({ error: 'Dados incompletos para sincronização.' }, { status: 400 });
  }

  let urlIcal: URL;
  try {
    urlIcal = validarUrlIcal(payload.icalUrl.trim());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Link iCal inválido.' },
      { status: 400 }
    );
  }

  try {
    const supabaseAutenticado = createAuthenticatedSupabaseClient(accessToken);
    const { data: { user }, error: erroUsuario } = await supabaseAutenticado.auth.getUser(accessToken);
    if (erroUsuario || !user) {
      return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 });
    }

    const { data: imovel, error: erroImovel } = await supabaseAutenticado
      .from('properties')
      .select('id')
      .eq('id', payload.propertyId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (erroImovel) throw erroImovel;
    if (!imovel) {
      return NextResponse.json({ error: 'Imóvel não encontrado ou você não tem permissão para editá-lo.' }, { status: 404 });
    }

    const textoIcs = await baixarCalendario(urlIcal);
    const eventos = textoIcs.split('BEGIN:VEVENT').slice(1);
    let importados = 0;

    for (const bloco of eventos) {
      const startMatch = bloco.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
      const endMatch = bloco.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);
      if (!startMatch || !endMatch) continue;

      const checkIn = dataIcalValida(startMatch[1]);
      const checkOut = dataIcalValida(endMatch[1]);
      if (!checkIn || !checkOut || checkOut <= checkIn) continue;

      const { data: existente, error: erroConsulta } = await supabaseAutenticado
        .from('bookings')
        .select('id')
        .eq('property_id', imovel.id)
        .eq('check_in', checkIn)
        .eq('check_out', checkOut);
      if (erroConsulta) throw erroConsulta;

      if (!existente?.length) {
        const { error: erroInsercao } = await supabaseAutenticado.from('bookings').insert([
          {
            property_id: imovel.id,
            guest_id: user.id,
            check_in: checkIn,
            check_out: checkOut,
            nights: Math.round(
              (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000
            ),
            cleaning_fee: 0,
            total_price: 0,
            status: 'blocked',
          },
        ]);
        if (erroInsercao) throw erroInsercao;
        importados++;
      }
    }

    const sincronizadoEm = new Date().toISOString();
    const { data: atualizado, error: erroAtualizacao } = await supabaseAutenticado
      .from('properties')
      .update({
        external_ical_url: urlIcal.toString(),
        ical_last_synced_at: sincronizadoEm,
      })
      .eq('id', imovel.id)
      .eq('owner_id', user.id)
      .select('id')
      .maybeSingle();
    if (erroAtualizacao) throw erroAtualizacao;
    if (!atualizado) throw new Error('Não foi possível salvar o status da sincronização.');

    return NextResponse.json({ sucesso: true, importados, sincronizadoEm });
  } catch (error) {
    console.error('Erro no sync iCal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao processar arquivo iCal.' },
      { status: 502 }
    );
  }
}
