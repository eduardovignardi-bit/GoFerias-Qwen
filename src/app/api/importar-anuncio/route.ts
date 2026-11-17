import { NextResponse } from 'next/server';

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
    const body = await request.json();
    const urlStr = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!urlStr) {
      return NextResponse.json(
        { error: 'Informe o link do anúncio para importar.' },
        { status: 400 }
      );
    }

    let urlValida: URL;
    try {
      urlValida = new URL(urlStr);
    } catch {
      return NextResponse.json({ error: 'Link inválido. Verifique a URL colada.' }, { status: 400 });
    }

    const dominiosPermitidos = ['airbnb.', 'booking.com', 'vrbo.com', 'temporadalivre.com', 'olx.com.br'];
    const permitido = dominiosPermitidos.some((dom) => urlValida.hostname.includes(dom));

    if (!permitido) {
      return NextResponse.json(
        { error: 'Use um link válido do Airbnb, Booking, Vrbo ou TemporadaLivre.' },
        { status: 400 }
      );
    }

    const resposta = await fetch(urlValida.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resposta.ok) {
      return NextResponse.json(
        { error: 'A plataforma bloqueou a leitura automática neste momento. Preencha os dados manualmente.' },
        { status: 422 }
      );
    }

    const html = await resposta.text();

    const tituloBruto =
      extrairMetaTag(html, 'og:title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      '';
    const descricao =
      extrairMetaTag(html, 'og:description') || extrairMetaTag(html, 'description');
    const imagem = extrairMetaTag(html, 'og:image');

    const tituloLimpo = tituloBruto
      .replace(/\s*[-|•]\s*(Airbnb|Booking\.com|Vrbo|TemporadaLivre).*$/i, '')
      .trim()
      .slice(0, 120);

    return NextResponse.json({
      title: tituloLimpo,
      description: descricao.slice(0, 3500),
      images: imagem ? [imagem] : [],
    });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível ler os dados desse link agora.' },
      { status: 500 }
    );
  }
}
