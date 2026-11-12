import { NextResponse } from 'next/server';
import { qwenClient } from '@/lib/openai';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase';

type AcaoAssistente = 'descricao' | 'proximidades';

type DadosAssistente = {
  acao: AcaoAssistente;
  titulo: string;
  cidade: string;
  estado: string;
  bairro: string;
  comodidades: string;
  descricao: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function limparJson(texto: string) {
  return texto.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function validarDados(value: unknown): DadosAssistente | null {
  if (!isRecord(value)) return null;
  const { acao, titulo, cidade, estado, bairro, comodidades, descricao } = value;
  if (
    (acao !== 'descricao' && acao !== 'proximidades') ||
    typeof titulo !== 'string' ||
    typeof cidade !== 'string' ||
    typeof estado !== 'string' ||
    typeof bairro !== 'string' ||
    typeof comodidades !== 'string' ||
    typeof descricao !== 'string' ||
    !titulo.trim() ||
    !cidade.trim() ||
    titulo.length > 160 ||
    cidade.length > 100 ||
    estado.length > 30 ||
    bairro.length > 120 ||
    comodidades.length > 1200 ||
    descricao.length > 4000
  ) {
    return null;
  }
  return { acao, titulo, cidade, estado, bairro, comodidades, descricao };
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: 'Entre na sua conta para usar o assistente.' }, { status: 401 });
  }

  const supabaseAutenticado = createAuthenticatedSupabaseClient(accessToken);
  const { data: { user }, error: erroUsuario } = await supabaseAutenticado.auth.getUser(accessToken);
  if (erroUsuario || !user) {
    return NextResponse.json({ error: 'Sessão inválida. Entre novamente.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Envie dados válidos para gerar a sugestão.' }, { status: 400 });
  }

  const dados = validarDados(payload);
  if (!dados) {
    return NextResponse.json({ error: 'Preencha título e cidade e revise os dados enviados.' }, { status: 400 });
  }

  const localizacao = [dados.bairro, dados.cidade, dados.estado].filter(Boolean).join(', ');
  const contexto = [
    `Título: ${dados.titulo.trim()}`,
    `Localização: ${localizacao}`,
    `Comodidades informadas: ${dados.comodidades.trim() || 'não informadas'}`,
    `Descrição atual: ${dados.descricao.trim() || 'não informada'}`,
  ].join('\n');

  try {
    if (dados.acao === 'descricao') {
      const completion = await qwenClient.chat.completions.create(
        {
          model: process.env.IA_MODEL || 'qwen2.5:3b',
          messages: [
            {
              role: 'system',
              content: 'Escreva em português brasileiro uma descrição acolhedora e profissional para um anúncio de hospedagem. Baseie-se exclusivamente nos dados fornecidos; não invente características, distâncias, serviços ou promessas. Retorne somente a descrição, em até três parágrafos.',
            },
            { role: 'user', content: contexto },
          ],
        },
        { timeout: 45000 }
      );
      const descricao = completion.choices[0]?.message?.content?.trim();
      if (!descricao) throw new Error('O modelo não retornou uma descrição.');
      return NextResponse.json({ descricao });
    }

    const completion = await qwenClient.chat.completions.create(
      {
        model: process.env.IA_MODEL || 'qwen2.5:3b',
        messages: [
          {
            role: 'system',
            content: 'Sugira até cinco tipos de comércios ou atrações que o anfitrião poderia mencionar após confirmar que existem na região indicada. Não invente nomes próprios, distâncias ou fatos locais; prefira categorias gerais adequadas ao destino. Responda somente um JSON válido no formato {"sugestoes":["..."]}, em português brasileiro.',
          },
          { role: 'user', content: contexto },
        ],
      },
      { timeout: 45000 }
    );
    const conteudo = completion.choices[0]?.message?.content;
    if (!conteudo) throw new Error('O modelo não retornou sugestões de proximidades.');
    const resultado: unknown = JSON.parse(limparJson(conteudo));
    if (!isRecord(resultado) || !Array.isArray(resultado.sugestoes)) {
      throw new Error('Formato inválido na resposta de proximidades.');
    }
    const sugestoes = resultado.sugestoes
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 5);
    if (!sugestoes.length) throw new Error('Nenhuma sugestão de proximidade foi retornada.');
    return NextResponse.json({ sugestoes });
  } catch (error) {
    console.error('Erro ao gerar conteúdo do anúncio:', error);
    return NextResponse.json(
      { error: 'Não foi possível gerar sugestões agora. Verifique se o serviço de IA está disponível e tente novamente.' },
      { status: 502 }
    );
  }
}
