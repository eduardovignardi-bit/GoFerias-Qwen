'use client';
import LogoGoFerias from '@/components/LogoGoFerias'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TelaAcesso() {
  const router = useRouter();
  const [modoCadastro, setModoCadastro] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<'hospede' | 'proprietario'>('proprietario');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleAutenticacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    try {
      if (modoCadastro) {
        // 1. Cria o usuário no Auth do Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: senha,
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Salva o tipo de perfil (Hóspede ou Proprietário) na tabela profiles
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: authData.user.id,
                email: email,
                role: perfil,
              },
            ]);

          if (profileError) throw profileError;

          // 3. Redireciona conforme o perfil escolhido
          if (perfil === 'hospede') {
            router.push('/marketplace');
          } else {
            router.push('/anfitriao');
          }
        }
      } else {
        // 1. Faz o Login do usuário existente
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Busca no banco qual é o perfil desse usuário
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();

          if (profileError) throw profileError;

          // 3. Redireciona automaticamente
          if (profileData?.role === 'hospede') {
            router.push('/marketplace');
          } else {
            router.push('/anfitriao');
          }
        }
      }
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">🏠 GoFerias</h1>
          <p className="text-sm text-gray-500 mt-1">
            {modoCadastro ? 'Crie sua conta gratuita' : 'Entre na sua conta para continuar'}
          </p>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            {erro}
          </div>
        )}

        <form onSubmit={handleAutenticacao} className="space-y-4">
          {modoCadastro && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Como você quer usar o GoFerias?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPerfil('hospede')}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    perfil === 'hospede'
                      ? 'border-rose-500 bg-rose-50 text-rose-900'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-bold text-sm">Sou Hóspede</span>
                  <span className="text-[11px] opacity-80">Buscar imóveis</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPerfil('proprietario')}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    perfil === 'proprietario'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-bold text-sm">Sou Proprietário</span>
                  <span className="text-[11px] opacity-80">1º imóvel grátis</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:bg-gray-400 text-sm"
          >
            {carregando
              ? 'Processando...'
              : modoCadastro
              ? 'Criar Conta e Entrar'
              : 'Entrar na Plataforma'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => {
              setModoCadastro(!modoCadastro);
              setErro('');
            }}
            className="text-sm text-blue-600 font-medium hover:underline"
          >
            {modoCadastro
              ? 'Já tem uma conta? Faça login aqui'
              : 'Ainda não tem conta? Cadastre-se grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}
