import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'seu-email-admin@goferias.com.br';

function extrairMetaTag(html: string, propriedade: string): string {
  const regexProp = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propriedade}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const matchProp = html.match(regexProp);
  if (matchProp?.[1]) return decodificarHtml(matchProp[1]);

  const regexInvertido = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propriedade}["']`,
    'i'
  );
  const matchInvertido = html.match(regexInvertido);
  return matchInvertido?.[1] ? decodificarHtml(matchInvertido[1]) : '';
}

function decodificarHtml(texto: string): string {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
    }

    const body = await request.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
    const cidadePadrao = typeof body?.cidade === 'string' && body.cidade.trim() ? body.cidade.trim() : 'Florianópolis';
    const estadoPadrao = typeof body?.estado === 'string' && body.estado.trim() ? body.estado.trim().toUpperCase() : 'SC';
    const diariaPadrao = Number(body?.diariaPadrao) > 0 ? Number(body.diariaPadrao) : 350;

    if (urls.length === 0) {
      return NextResponse.json({ error: 'Envie pelo menos um link válido.' }, { status: 400 });
    }

    const resultados = [];

    for (const rawUrl of urls.slice(0, 15)) {
      const urlLimpa = rawUrl.trim();
      if (!urlLimpa) continue;

      try {
        const resposta = await fetch(urlLimpa, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!resposta.ok) {
          resultados.push({ url: urlLimpa, status: 'erro', motivo: `Bloqueio HTTP ${resposta.status}` });
          continue;
        }

        const html = await resposta.text();
        const tituloBruto =
          extrairMetaTag(html, 'og:title') ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
          'Imóvel Importado';
        const descricao =
          extrairMetaTag(html, 'og:description') || extrairMetaTag(html, 'description') || '';
        const imagem = extrairMetaTag(html, 'og:image');

        const titulo = tituloBruto
          .replace(/\s*[-|•]\s*(Airbnb|Booking\.com|Vrbo|TemporadaLivre).*$/i, '')
          .trim()
          .slice(0, 120);

        const { data: inserido, error: insertError } = await supabase
          .from('properties')
          .insert({
            owner_id: user.id,
            title: titulo,
            description: `${descricao}\n\nFonte original: ${urlLimpa}`.trim().slice(0, 3800),
            city: cidadePadrao,
            state: estadoPadrao,
            location: `${cidadePadrao}, ${estadoPadrao}`,
            price_per_night: diariaPadrao,
            cleaning_fee: 150,
            guests: 4,
            bedrooms: 2,
            beds: 2,
            bathrooms: 1,
            image_url: imagem || '',
            images: imagem ? [imagem] : [],
            is_active: true,
          })
          .select('id, title')
          .single();

        if (insertError) {
          resultados.push({ url: urlLimpa, status: 'erro', motivo: insertError.message });
        } else {
          resultados.push({ url: urlLimpa, status: 'sucesso', id: inserido.id, titulo: inserido.title });
        }
      } catch (err) {
        resultados.push({
          url: urlLimpa,
          status: 'erro',
          motivo: err instanceof Error ? err.message : 'Tempo esgotado',
        });
      }
    }

    return NextResponse.json({ resultados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno na importação.' },
      { status: 500 }
    );
  }
}
