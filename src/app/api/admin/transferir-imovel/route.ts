import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'seu-email-admin@goferias.com.br';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configure SUPABASE_SERVICE_ROLE_KEY no servidor para transferir imóveis.' },
        { status: 500 }
      );
    }

    // Valida quem está fazendo a requisição
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Apenas o administrador pode transferir anúncios.' }, { status: 403 });
    }

    const body = await request.json();
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    const novoEmail = typeof body?.emailProprietario === 'string' ? body.emailProprietario.trim().toLowerCase() : '';

    if (!propertyId || !novoEmail || !novoEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Informe o imóvel e um e-mail válido do proprietário.' },
        { status: 400 }
      );
    }

    // Cliente administrativo para buscar o ID do usuário pelo e-mail e transferir
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: listaUsuarios, error: erroBuscaUser } = await supabaseAdmin.auth.admin.listUsers();
    if (erroBuscaUser) {
      throw new Error(erroBuscaUser.message);
    }

    const destinatario = listaUsuarios.users.find(
      (u) => u.email?.toLowerCase() === novoEmail
    );

    if (!destinatario) {
      return NextResponse.json(
        { error: 'Nenhuma conta encontrada com este e-mail. Peça para o proprietário criar a conta gratuita no GoFérias primeiro.' },
        { status: 404 }
      );
    }

    const { error: erroUpdate } = await supabaseAdmin
      .from('properties')
      .update({ owner_id: destinatario.id })
      .eq('id', propertyId);

    if (erroUpdate) {
      throw new Error(erroUpdate.message);
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `Anúncio transferido com sucesso para ${novoEmail}!`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao transferir anúncio.' },
      { status: 500 }
    );
  }
}
