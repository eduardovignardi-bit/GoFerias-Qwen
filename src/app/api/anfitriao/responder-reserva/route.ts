import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Chave SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    // 1. Identifica o anfitrião logado
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const body = await request.json();
    const reservaId = typeof body?.reservaId === 'string' ? body.reservaId.trim() : '';
    const decisao = body?.decisao === 'approved' ? 'approved' : body?.decisao === 'cancelled' ? 'cancelled' : '';

    if (!reservaId || !decisao) {
      return NextResponse.json({ error: 'Dados da solicitação inválidos.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 2. Busca a reserva e confirma se o usuário logado é o dono do imóvel
    const { data: reserva } = await supabaseAdmin
      .from('bookings')
      .select('id, property_id')
      .eq('id', reservaId)
      .single();

    if (!reserva) {
      return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 });
    }

    const { data: imovel } = await supabaseAdmin
      .from('properties')
      .select('owner_id')
      .eq('id', reserva.property_id)
      .single();

    if (!imovel || imovel.owner_id !== user.id) {
      return NextResponse.json({ error: 'Você não tem permissão para alterar esta reserva.' }, { status: 403 });
    }

    // 3. Atualiza o status no banco com permissão administrativa
    const { error: erroUpdate } = await supabaseAdmin
      .from('bookings')
      .update({ status: decisao })
      .eq('id', reservaId);

    if (erroUpdate) {
      throw new Error(erroUpdate.message);
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar reserva.' },
      { status: 500 }
    );
  }
}
