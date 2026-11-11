import { NextResponse } from 'next/server';
import { qwenClient } from '@/lib/openai';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: 'Usuário não autenticado. Faça login novamente.' }, { status: 401 });
    }

    const { url, textoManual } = await request.json();
    const supabaseAutenticado = createAuthenticatedSupabaseClient(accessToken);
    const { data: { user }, error: erroUsuario } = await supabaseAutenticado.auth.getUser(accessToken);
    if (erroUsuario || !user) {
      return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 });
    }

    // 1. Verifica quantos imóveis este proprietário já possui
    const { count, error: countError } = await supabaseAutenticado
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (countError) throw countError;

    const totalImoveis = count || 0;
    const isPrimeiroGratuito = totalImoveis === 0;

    // 2. Extração Real: Tenta capturar metadados e JSON-LD direto do Airbnb
    let fotoCapa = '';
    let tituloOriginal = '';
    let descricaoOriginal = '';
    let textoPagina = textoManual || '';

    if (!textoPagina && url) {
      try {
        const htmlRes = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        const html = await htmlRes.text();

        // Captura foto oficial (og:image)
        const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1]) fotoCapa = imgMatch[1];

        // Captura título oficial (og:title)
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (titleMatch && titleMatch[1]) tituloOriginal = titleMatch[1];

        // Captura descrição oficial (og:description)
        const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
        if (descMatch && descMatch[1]) descricaoOriginal = descMatch[1];
      } catch (e) {
        console.warn('Aviso ao ler HTML direto:', e);
      }

      // Tenta complementar via Jina Reader
      try {
        const readerRes = await fetch(`https://jina.ai{url}`, {
          headers: { 'X-Return-Format': 'markdown' },
        });
        if (readerRes.ok) {
          const textoCompleto = await readerRes.text();
          // Verifica se o Airbnb não retornou tela de bloqueio/login
          if (!textoCompleto.includes('Access Denied') && !textoCompleto.includes('Verify you are human')) {
            textoPagina = textoCompleto.slice(0, 4000);
          }
        }
      } catch (e) {
        console.warn('Aviso ao ler via Jina:', e);
      }
    }

    // Se o Airbnb bloqueou totalmente a leitura e não veio texto manual
    if (!tituloOriginal && !textoPagina && !descricaoOriginal) {
      return NextResponse.json(
        {
          bloqueioAirbnb: true,
          error:
            'O Airbnb bloqueou a leitura automática deste link. Use a opção "Colar texto do anúncio" abaixo do link para importar os dados reais.',
        },
        { status: 422 }
      );
    }

    const contextoExtraido = `
      URL: ${url}
      Título Original: ${tituloOriginal}
      Resumo Original: ${descricaoOriginal}
      Conteúdo Completo da Página:
      ${textoPagina}
    `;

    // 3. Envia para o Qwen com proibição estrita de inventar dados
    const completion = await qwenClient.chat.completions.create({
      model: process.env.IA_MODEL || 'qwen2.5:3b',
      messages: [
        {
          role: 'system',
          content:
            'Você é um extrator de dados imobiliários. Leia APENAS as informações reais fornecidas pelo usuário. É PROIBIDO inventar cidades, bairros ou características que não estejam no texto. Devolva APENAS um objeto JSON válido com estas chaves exatas: "titulo" (título real do imóvel otimizado), "descricao" (descrição real em 2 parágrafos baseada apenas no texto fornecido), "localizacao" (cidade e estado reais encontrados no texto, ou "Não informada" se não achar) e "preco_noite" (número inteiro da diária encontrada no texto, ou 0 se não estiver visível). Não escreva nada fora do JSON.',
        },
        {
          role: 'user',
          content: contextoExtraido,
        },
      ],
    });

    const respostaBruta = completion.choices[0]?.message?.content || '{}';
    const jsonLimpo = respostaBruta.replace(/```json/g, '').replace(/```/g, '').trim();
    const dadosImovel = JSON.parse(jsonLimpo);

    // 4. Salva o imóvel real no Supabase
    const { data: novoImovel, error: insertError } = await supabaseAutenticado
      .from('properties')
      .insert([
        {
          owner_id: user.id,
          title: dadosImovel.titulo || tituloOriginal || 'Imóvel Importado',
          description: dadosImovel.descricao || descricaoOriginal || 'Descrição importada.',
          location: dadosImovel.localizacao || 'Brasil',
          price_per_night: dadosImovel.preco_noite || 350,
          airbnb_url: url,
          image_url: fotoCapa,
          is_paid_slot: !isPrimeiroGratuito,
          is_active: isPrimeiroGratuito,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      sucesso: true,
      imovel: novoImovel,
      precisaAtivar: !isPrimeiroGratuito,
    });
  } catch (error: unknown) {
    console.error('Erro na importação:', error);
    return NextResponse.json(
      { error: 'Erro ao processar importação. Verifique se o Ollama está aberto.' },
      { status: 500 }
    );
  }
}
