'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type ResultadoItem = {
  identificador: string;
  status: 'sucesso' | 'erro';
  titulo?: string;
  motivo?: string;
};

export default function PaginaAdminImportar() {
  const [aba, setAba] = useState<'links' | 'csv'>('links');
  const [linksTexto, setLinksTexto] = useState('');
  const [cidade, setCidade] = useState('Florianópolis');
  const [estado, setEstado] = useState('SC');
  const [diariaPadrao, setDiariaPadrao] = useState('350');
  const [processando, setProcessando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);

  const [meusImoveisAdmin, setMeusImoveisAdmin] = useState<{ id: string; title: string; location: string }[]>([]);
  const [imovelTransferindo, setImovelTransferindo] = useState<{ id: string; title: string } | null>(null);
  const [emailDestino, setEmailDestino] = useState('');
  const [transferindo, setTransferindo] = useState(false);

  const baixarModeloCsv = () => {
    const cabecalho = 'titulo;cidade;estado;diaria;limpeza;hospedes;quartos;imagem;ical_url;descricao';
    const exemplo =
      'Casa Pé na Areia Campeche;Florianópolis;SC;450;180;6;3;https://exemplo.com completa a 100m da praia com Wi-Fi e churrasqueira.';
    const conteudo = `\uFEFF${cabecalho}\n${exemplo}`;
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-goferias.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarPorLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroGeral('');
    setResultados([]);

    const urls = linksTexto
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha.startsWith('http'));

    if (urls.length === 0) {
      setErroGeral('Cole pelo menos uma URL válida começando com http:// ou https://.');
      return;
    }

    setProcessando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Você precisa estar logado como administrador.');

      const resp = await fetch('/api/admin/importar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          modo: 'urls',
          urls,
          cidade,
          estado,
          diariaPadrao: Number(diariaPadrao) || 350,
        }),
      });

      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.error || 'Falha na importação.');

      setResultados(dados.resultados || []);
      setLinksTexto('');
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setProcessando(false);
    }
  };

  const processarArquivoCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErroGeral('');
    setResultados([]);
    setProcessando(true);

    try {
      const texto = await arquivo.text();
      const linhas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (linhas.length < 2) {
        throw new Error('O arquivo CSV precisa ter o cabeçalho e pelo menos uma linha de imóvel.');
      }

      const separador = linhas[0].includes(';') ? ';' : ',';
      const itens = linhas.slice(1).map((linha) => {
        const colunas = linha.split(separador).map((c) => c.trim().replace(/^"|"$/g, ''));
        return {
          titulo: colunas[0] || '',
          cidade: colunas[1] || 'Florianópolis',
          estado: colunas[2] || 'SC',
          diaria: Number(colunas[3]) || 350,
          limpeza: Number(colunas[4]) || 150,
          hospedes: Number(colunas[5]) || 4,
          quartos: Number(colunas[6]) || 2,
          imagem: colunas[7] || '',
          icalUrl: colunas[8] || '',
          descricao: colunas[9] || '',
        };
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Você precisa estar logado como administrador.');

      const resp = await fetch('/api/admin/importar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ modo: 'csv', itens }),
      });

      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.error || 'Falha ao importar planilha.');

      setResultados(dados.resultados || []);
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Erro ao ler o arquivo CSV.');
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  };

  const carregarImoveisAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('properties')
      .select('id, title, location')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setMeusImoveisAdmin(data);
  };

  const confirmarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imovelTransferindo || !emailDestino.trim()) return;
    setTransferindo(true);
    setErroGeral('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada.');

      const resp = await fetch('/api/admin/transferir-imovel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          propertyId: imovelTransferindo.id,
          emailProprietario: emailDestino.trim(),
        }),
      });

      const dados = await resp.json();
      if (!resp.ok) throw new Error(dados.error || 'Erro ao transferir.');

      alert(dados.mensagem);
      setImovelTransferindo(null);
      setEmailDestino('');
      await carregarImoveisAdmin();
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Falha na transferência.');
    } finally {
      setTransferindo(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E87722]">
          Painel Administrativo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Importação em Lote de Anúncios
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Importe imóveis por link direto ou via planilha CSV/Excel.
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => { setAba('links'); setErroGeral(''); setResultados([]); }}
          className={`border-b-2 px-4 py-2.5 text-sm font-bold transition ${
            aba === 'links'
              ? 'border-[#155E75] text-[#155E75]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          1. Importar por Links
        </button>
        <button
          type="button"
          onClick={() => { setAba('csv'); setErroGeral(''); setResultados([]); }}
          className={`border-b-2 px-4 py-2.5 text-sm font-bold transition ${
            aba === 'csv'
              ? 'border-[#155E75] text-[#155E75]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          2. Importar Planilha CSV / Excel
        </button>
      </div>
      {erroGeral && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {erroGeral}
        </div>
      )}

      {aba === 'links' ? (
        <form onSubmit={importarPorLinks} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Cidade padrão</span>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#155E75]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Estado (UF)</span>
              <input
                type="text"
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#155E75]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Diária base (R$)</span>
              <input
                type="number"
                value={diariaPadrao}
                onChange={(e) => setDiariaPadrao(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#155E75]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Links dos anúncios (um link por linha, máximo 15 por vez)
            </span>
            <textarea
              rows={6}
              value={linksTexto}
              onChange={(e) => setLinksTexto(e.target.value)}
              placeholder={'https://airbnb.com.br\nhttps://temporadalivre.com...'}
              className="w-full rounded-xl border border-slate-300 p-4 font-mono text-xs leading-relaxed outline-none focus:border-[#155E75]"
            />
          </label>

          <button
            type="submit"
            disabled={processando}
            className="rounded-xl bg-[#155E75] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#104b5e] disabled:opacity-60"
          >
            {processando ? 'Importando anúncios...' : 'Importar para o Marketplace'}
          </button>
        </form>
      ) : (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">1. Baixe a planilha modelo</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Preencha no Excel com os dados dos imóveis e salve como CSV.
              </p>
            </div>
            <button
              type="button"
              onClick={baixarModeloCsv}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
            >
              Baixar modelo CSV
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-900">2. Envie o arquivo CSV preenchido</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition hover:border-[#155E75] hover:bg-cyan-50/30">
              <span className="text-sm font-semibold text-slate-800">
                {processando ? 'Processando planilha...' : 'Clique para selecionar o arquivo .csv'}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Máximo de 50 imóveis por envio
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={processando}
                onChange={processarArquivoCsv}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Resultado da importação</h2>
          {resultados.map((res, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
                res.status === 'sucesso'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="truncate pr-4">
                <p className="font-bold">{res.status === 'sucesso' ? res.titulo : 'Falha na importação'}</p>
                <p className="truncate text-xs opacity-75">{res.identificador}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold">
                {res.status === 'sucesso' ? '✓ Publicado' : res.motivo}
              </span>
            </div>
          ))}
        </div>
      )}

      <section className="mt-12 border-t border-slate-200 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Transferir Anúncios para Proprietários</h2>
            <p className="text-xs text-slate-600">
              Passe a titularidade de um anúncio importado para a conta do anfitrião real.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregarImoveisAdmin()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Carregar meus anúncios
          </button>
        </div>

        {meusImoveisAdmin.length > 0 && (
          <div className="space-y-2.5">
            {meusImoveisAdmin.map((imv) => (
              <div key={imv.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{imv.title}</p>
                  <p className="text-xs text-slate-500">{imv.location}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setImovelTransferindo(imv); setEmailDestino(''); }}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Transferir dono
                </button>
              </div>
            ))}
          </div>
        )}

        {imovelTransferindo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <form onSubmit={confirmarTransferencia} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">Transferir Anúncio</h3>
              <p className="mt-1 text-xs text-slate-600">
                Você está transferindo <strong>{imovelTransferindo.title}</strong>. O novo proprietário já deve ter criado uma conta no GoFérias.
              </p>

              <label className="mt-4 block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">E-mail da conta do proprietário</span>
                <input
                  type="email"
                  required
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                  placeholder="proprietario@email.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#155E75]"
                />
              </label>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImovelTransferindo(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferindo}
                  className="rounded-xl bg-[#E87722] px-4 py-2 text-xs font-bold text-white hover:bg-[#d16617] disabled:opacity-60"
                >
                  {transferindo ? 'Transferindo...' : 'Confirmar transferência'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
