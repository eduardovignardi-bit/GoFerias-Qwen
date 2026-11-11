'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LogoGoFerias from '@/components/LogoGoFerias';

export default function TelaInicial() {
  const router = useRouter();
  const [modoCadastro, setModoCadastro] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<'guest' | 'host'>('guest');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleAutenticacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);

    try {
      if (modoCadastro) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').upsert([
            {
              id: data.user.id,
              email,
              role: tipoUsuario,
            },
          ]);
        }

        alert('Conta criada com sucesso!');
        router.push(tipoUsuario === 'host' ? '/anfitriao' : '/marketplace');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        if (error) throw error;

        if (data.user) {
          const { data: perfil } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          router.push(perfil?.role === 'host' ? '/anfitriao' : '/marketplace');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao acessar sua conta.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-[#222222]">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full p-8">
        <div className="flex justify-center mb-3">
          <LogoGoFerias />
        </div>

        <p className="text-center text-sm text-gray-500 mb-6">
          {modoCadastro
            ? 'Crie sua conta gratuita para viajar ou anunciar'
            : 'Entre na sua conta para continuar'}
        </p>

        {modoCadastro && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setTipoUsuario('guest')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                tipoUsuario === 'guest'
                  ? 'bg-white text-[#155E75] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Sou Viajante
            </button>
            <button
              type="button"
              onClick={() => setTipoUsuario('host')}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                tipoUsuario === 'host'
                  ? 'bg-white text-[#E87722] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Sou Anfitrião
            </button>
          </div>
        )}

        <form onSubmit={handleAutenticacao} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#155E75] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#155E75] transition"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-3.5 bg-[#E87722] hover:bg-[#d16617] text-white font-bold rounded-xl text-sm transition shadow-sm disabled:bg-gray-300"
          >
            {carregando
              ? 'Carregando...'
              : modoCadastro
              ? 'Criar conta gratuita'
              : 'Entrar na Plataforma'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => setModoCadastro(!modoCadastro)}
            className="text-sm font-semibold text-[#155E75] hover:underline"
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
