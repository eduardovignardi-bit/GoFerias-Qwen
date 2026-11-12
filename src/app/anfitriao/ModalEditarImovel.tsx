'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { PLATFORM_COMMISSION_RATE } from '@/lib/billing';
import GaleriaEditor from './GaleriaEditor';
import CamposEndereco from './CamposEndereco';

type Imovel = {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  cep?: string | null;
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  guests?: number | string | null;
  bedrooms?: number | string | null;
  beds?: number | string | null;
  bathrooms?: number | string | null;
  price_per_night?: number | string | null;
  cleaning_fee?: number | string | null;
  images?: unknown;
  image_url?: string | null;
  external_ical_url?: string | null;
  ical_last_synced_at?: string | null;
};

type FormularioImovel = {
  id: string;
  title: string;
  description: string;
  amenities: string;
  cep: string;
  street: string;
  street_number: string;
  neighborhood: string;
  city: string;
  state: string;
  guests: string;
  bedrooms: string;
  beds: string;
  bathrooms: string;
  price_per_night: string;
  cleaning_fee: string;
  images: string[];
};

type AbaFormulario = 'basicas' | 'localizacao' | 'fotos' | 'precos' | 'sincronizacao';
type AcaoAssistente = 'descricao' | 'proximidades';

const marcacaoComodidades = '\n\nComodidades informadas: ';

const formatarMoeda = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

function separarComodidades(descricao: string) {
  const indice = descricao.lastIndexOf(marcacaoComodidades);
  if (indice < 0) return { descricao, amenities: '' };
  return {
    descricao: descricao.slice(0, indice),
    amenities: descricao.slice(indice + marcacaoComodidades.length),
  };
}

function obterFotos(imovel: Imovel) {
  const imagens = Array.isArray(imovel.images)
    ? imovel.images.filter((imagem): imagem is string => typeof imagem === 'string' && !!imagem.trim())
    : [];
  if (imagens.length) return imagens;
  return imovel.image_url ? [imovel.image_url] : [];
}

export default function ModalEditarImovel({
  imovel,
  onClose,
  onSalvo,
  onIcalSincronizado,
}: {
  imovel: Imovel;
  onClose: () => void;
  onSalvo: () => void;
  onIcalSincronizado?: () => void;
}) {
  const descricaoSalva = separarComodidades(imovel.description || '');
  const [form, setForm] = useState<FormularioImovel>({
    id: imovel.id,
    title: imovel.title || '',
    description: descricaoSalva.descricao,
    amenities: descricaoSalva.amenities,
    cep: imovel.cep || '',
    street: imovel.street || '',
    street_number: imovel.street_number || '',
    neighborhood: imovel.neighborhood || '',
    city: imovel.city || '',
    state: imovel.state || '',
    guests: String(imovel.guests ?? 2),
    bedrooms: String(imovel.bedrooms ?? 1),
    beds: String(imovel.beds ?? 1),
    bathrooms: String(imovel.bathrooms ?? 1),
    price_per_night: String(imovel.price_per_night ?? ''),
    cleaning_fee: String(imovel.cleaning_fee ?? 0),
    images: obterFotos(imovel),
  });
  const [abaAtiva, setAbaAtiva] = useState<AbaFormulario>('basicas');
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [acaoIA, setAcaoIA] = useState<AcaoAssistente | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [icalUrl, setIcalUrl] = useState(imovel.external_ical_url || '');
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(imovel.ical_last_synced_at || '');
  const [sincronizandoIcal, setSincronizandoIcal] = useState(false);
  const [statusIcal, setStatusIcal] = useState('');
  const [erro, setErro] = useState('');

  const valores = useMemo(() => {
    const diaria = Number(form.price_per_night);
    const limpeza = Number(form.cleaning_fee);
    const diariaCentavos = Number.isFinite(diaria) ? Math.round(diaria * 100) : 0;
    const limpezaCentavos = Number.isFinite(limpeza) ? Math.max(0, Math.round(limpeza * 100)) : 0;
    const comissaoCentavos = Math.round(diariaCentavos * PLATFORM_COMMISSION_RATE);
    return {
      diariaCentavos,
      limpezaCentavos,
      comissaoCentavos,
      totalHospedeCentavos: diariaCentavos + limpezaCentavos,
      liquidoAnfitriaoCentavos: diariaCentavos - comissaoCentavos + limpezaCentavos,
    };
  }, [form.price_per_night, form.cleaning_fee]);

  const atualizarCampo = <K extends keyof FormularioImovel>(campo: K, valor: FormularioImovel[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const executarAssistente = async (acao: AcaoAssistente) => {
    if (!form.title.trim() || !form.city.trim()) {
      setErro('Preencha o título e a cidade antes de usar o assistente.');
      setAbaAtiva(!form.title.trim() ? 'basicas' : 'localizacao');
      return;
    }

    setErro('');
    setAcaoIA(acao);
    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para usar o assistente.');

      const resposta = await fetch('/api/assistente-imovel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(session.access_token),
        },
        body: JSON.stringify({
          acao,
          titulo: form.title,
          cidade: form.city,
          estado: form.state,
          bairro: form.neighborhood,
          comodidades: form.amenities,
          descricao: form.description,
        }),
      });
      const dados: unknown = await resposta.json();
      if (!resposta.ok) {
        const mensagem =
          typeof dados === 'object' && dados !== null && 'error' in dados && typeof dados.error === 'string'
            ? dados.error
            : 'Não foi possível concluir a sugestão de IA.';
        throw new Error(mensagem);
      }

      if (acao === 'descricao') {
        const descricao =
          typeof dados === 'object' && dados !== null && 'descricao' in dados && typeof dados.descricao === 'string'
            ? dados.descricao.trim()
            : '';
        if (!descricao) throw new Error('A IA não retornou uma descrição válida. Tente novamente.');
        atualizarCampo('description', descricao);
      } else {
        const lista =
          typeof dados === 'object' && dados !== null && 'sugestoes' in dados && Array.isArray(dados.sugestoes)
            ? dados.sugestoes.filter((item): item is string => typeof item === 'string' && !!item.trim())
            : [];
        if (!lista.length) throw new Error('A IA não retornou sugestões. Tente novamente.');
        setSugestoes(lista);
      }
    } catch (error) {
      console.error('Erro ao usar assistente de anúncio:', error);
      setErro(error instanceof Error ? error.message : 'Erro de conexão ao usar o assistente.');
    } finally {
      setAcaoIA(null);
    }
  };

  const adicionarSugestoesNaDescricao = () => {
    const bloco = `Pontos de interesse para conferir nas proximidades:\n${sugestoes.map((item) => `• ${item}`).join('\n')}`;
    atualizarCampo('description', [form.description.trim(), bloco].filter(Boolean).join('\n\n'));
    setSugestoes([]);
    setAbaAtiva('basicas');
  };

  const sincronizarIcal = async () => {
    setErro('');
    setStatusIcal('');
    let url: URL;
    try {
      url = new URL(icalUrl.trim());
    } catch {
      setErro('Informe um link iCal válido.');
      return;
    }
    if (url.protocol !== 'https:') {
      setErro('Por segurança, o link iCal deve começar com HTTPS.');
      return;
    }

    setSincronizandoIcal(true);
    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para sincronizar o calendário.');

      const resposta = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer '.concat(session.access_token),
        },
        body: JSON.stringify({ propertyId: imovel.id, icalUrl: url.toString() }),
      });
      const dados: unknown = await resposta.json();
      if (!resposta.ok) {
        const mensagem =
          typeof dados === 'object' && dados !== null && 'error' in dados && typeof dados.error === 'string'
            ? dados.error
            : 'Não foi possível sincronizar o calendário.';
        throw new Error(mensagem);
      }

      const sincronizadoEm =
        typeof dados === 'object' && dados !== null && 'sincronizadoEm' in dados &&
        typeof dados.sincronizadoEm === 'string'
          ? dados.sincronizadoEm
          : '';
      const importados =
        typeof dados === 'object' && dados !== null && 'importados' in dados &&
        typeof dados.importados === 'number'
          ? dados.importados
          : 0;
      setIcalUrl(url.toString());
      setUltimaSincronizacao(sincronizadoEm);
      setStatusIcal(`Sincronização concluída. ${importados} bloqueio(s) importado(s).`);
      onIcalSincronizado?.();
    } catch (error) {
      console.error('Erro ao sincronizar calendário iCal:', error);
      setErro(error instanceof Error ? error.message : 'Não foi possível sincronizar o calendário.');
    } finally {
      setSincronizandoIcal(false);
    }
  };

  const handleSalvar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErro('');

    const diaria = Number(form.price_per_night);
    if (!form.title.trim()) {
      setErro('Informe o título do anúncio.');
      setAbaAtiva('basicas');
      return;
    }
    if (!form.city.trim()) {
      setErro('Informe a cidade do imóvel.');
      setAbaAtiva('localizacao');
      return;
    }
    if (!form.price_per_night.trim() || !Number.isFinite(diaria) || diaria <= 0) {
      setErro('Informe um valor válido para a diária.');
      setAbaAtiva('precos');
      return;
    }
    const limpeza = Number(form.cleaning_fee);
    if (!Number.isFinite(limpeza) || limpeza < 0) {
      setErro('Informe uma taxa de limpeza válida ou deixe o valor em zero.');
      setAbaAtiva('precos');
      return;
    }

    setSalvando(true);
    setSalvoComSucesso(false);
    const descricao = [
      form.description.trim(),
      form.amenities.trim() ? `Comodidades informadas: ${form.amenities.trim()}` : '',
    ].filter(Boolean).join('\n\n');
    const fotos = form.images.filter((imagem) => !!imagem.trim());

    try {
      const { data: { session }, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!session) throw new Error('Sua sessão expirou. Entre novamente para salvar o imóvel.');

      const { data, error: erroSalvar } = await supabase
        .from('properties')
        .update({
          title: form.title.trim(),
          cep: form.cep,
          street: form.street,
          street_number: form.street_number,
          neighborhood: form.neighborhood,
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          location: form.city.trim() && form.state.trim()
            ? `${form.city.trim()}, ${form.state.trim().toUpperCase()}`
            : form.city.trim(),
          guests: Number(form.guests) || 1,
          bedrooms: Number(form.bedrooms) || 0,
          beds: Number(form.beds) || 1,
          bathrooms: Number(form.bathrooms) || 1,
          price_per_night: diaria,
          cleaning_fee: Math.max(0, Number(form.cleaning_fee) || 0),
          image_url: fotos[0] || '',
          images: fotos,
          description: descricao,
        })
        .eq('id', form.id)
        .eq('owner_id', session.user.id)
        .select('id')
        .maybeSingle();

      if (erroSalvar) throw erroSalvar;
      if (!data) throw new Error('Imóvel não encontrado ou você não tem permissão para editá-lo.');
      onSalvo();
      setSalvoComSucesso(true);
      window.setTimeout(onClose, 900);
    } catch (error) {
      console.error('Erro ao salvar imóvel:', error);
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar o imóvel.');
    } finally {
      setSalvando(false);
    }
  };

  const abas: { id: AbaFormulario; titulo: string; passo: string }[] = [
    { id: 'basicas', titulo: 'Informações básicas', passo: '01' },
    { id: 'localizacao', titulo: 'Localização', passo: '02' },
    { id: 'fotos', titulo: 'Fotos', passo: '03' },
    { id: 'precos', titulo: 'Preços & regras', passo: '04' },
    { id: 'sincronizacao', titulo: 'Sincronização iCal', passo: '05' },
  ];
  const indiceAbaAtiva = abas.findIndex((aba) => aba.id === abaAtiva);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-imovel-titulo"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-8 sm:py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#155E75]">Seu espaço, do seu jeito</p>
            <h2 id="editar-imovel-titulo" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Editar anúncio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição"
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            ×
          </button>
        </header>

        <nav aria-label="Etapas do cadastro" className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
          {abas.map((aba) => {
            const ativa = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAbaAtiva(aba.id)}
                className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold transition sm:text-sm ${
                  ativa ? 'bg-[#155E75] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`text-[10px] ${ativa ? 'text-white/70' : 'text-slate-400'}`}>{aba.passo}</span>
                <span>{aba.titulo}</span>
              </button>
            );
          })}
        </nav>

        <form onSubmit={handleSalvar} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {erro && (
              <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {erro}
              </div>
            )}

            {abaAtiva === 'basicas' && (
              <section aria-labelledby="informacoes-basicas">
                <div className="mb-5">
                  <h3 id="informacoes-basicas" className="text-lg font-bold text-slate-900">Apresente seu espaço</h3>
                  <p className="mt-1 text-sm text-slate-500">Conte o que torna sua hospedagem especial.</p>
                </div>
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Título do anúncio <span className="text-rose-600">*</span></span>
                    <input
                      type="text"
                      maxLength={120}
                      value={form.title}
                      onChange={(evento) => atualizarCampo('title', evento.target.value)}
                      placeholder="Ex.: Refúgio charmoso perto da praia"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                      ['guests', 'Hóspedes'],
                      ['bedrooms', 'Quartos'],
                      ['beds', 'Camas'],
                      ['bathrooms', 'Banheiros'],
                    ] as const).map(([campo, titulo]) => (
                      <label key={campo} className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">{titulo}</span>
                        <input
                          type="number"
                          min={campo === 'bedrooms' ? 0 : 1}
                          value={form[campo]}
                          onChange={(evento) => atualizarCampo(campo, evento.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
                        />
                      </label>
                    ))}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Comodidades e diferenciais</span>
                    <input
                      type="text"
                      value={form.amenities}
                      onChange={(evento) => atualizarCampo('amenities', evento.target.value)}
                      placeholder="Ex.: piscina, Wi-Fi, varanda, ar-condicionado"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Será incluído na descrição do anúncio.</span>
                  </label>

                  <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Deixe a IA ajudar no texto</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">A sugestão usa os dados já preenchidos e pode ser editada antes de salvar.</p>
                    </div>
                    <button
                      type="button"
                      disabled={!!acaoIA}
                      onClick={() => void executarAssistente('descricao')}
                      className="shrink-0 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      {acaoIA === 'descricao' ? 'Gerando...' : '✦ Gerar descrição atrativa com IA'}
                    </button>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Descrição do espaço</span>
                    <textarea
                      rows={6}
                      maxLength={4000}
                      value={form.description}
                      onChange={(evento) => atualizarCampo('description', evento.target.value)}
                      placeholder="Descreva o espaço, a experiência e os detalhes importantes para seus hóspedes."
                      className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
                    />
                  </label>
                </div>
              </section>
            )}

            {abaAtiva === 'localizacao' && (
              <section aria-labelledby="localizacao-imovel">
                <div className="mb-5">
                  <h3 id="localizacao-imovel" className="text-lg font-bold text-slate-900">Onde fica o imóvel?</h3>
                  <p className="mt-1 text-sm text-slate-500">A cidade é obrigatória. Os demais dados ajudam o hóspede a se localizar.</p>
                </div>
                <CamposEndereco
                  form={form}
                  onChange={(alteracoes) => setForm((atual) => ({ ...atual, ...alteracoes }))}
                />
                <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Enriqueça o anúncio</h4>
                      <p className="mt-1 text-xs text-slate-600">A IA sugere tipos de comércios e atrações para você conferir na região.</p>
                    </div>
                    <button
                      type="button"
                      disabled={!!acaoIA}
                      onClick={() => void executarAssistente('proximidades')}
                      className="shrink-0 rounded-xl border border-cyan-800 bg-white px-4 py-2.5 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      {acaoIA === 'proximidades' ? 'Buscando ideias...' : 'Sugerir locais próximos'}
                    </button>
                  </div>
                  {sugestoes.length > 0 && (
                    <div className="mt-4 border-t border-cyan-200 pt-4">
                      <ul className="space-y-2 text-sm text-slate-700">
                        {sugestoes.map((sugestao, indice) => <li key={`${indice}-${sugestao}`}>• {sugestao}</li>)}
                      </ul>
                      <p className="mt-3 text-xs text-slate-500">Confira nomes e distâncias antes de publicar; sugestões de IA podem conter imprecisões.</p>
                      <button
                        type="button"
                        onClick={adicionarSugestoesNaDescricao}
                        className="mt-3 rounded-lg bg-cyan-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-950"
                      >
                        Adicionar à descrição
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {abaAtiva === 'fotos' && (
              <section aria-labelledby="fotos-imovel">
                <div className="mb-5">
                  <h3 id="fotos-imovel" className="text-lg font-bold text-slate-900">Fotos que dão vontade de viajar</h3>
                  <p className="mt-1 text-sm text-slate-500">Escolha a capa e organize a galeria na ordem que seus hóspedes verão.</p>
                </div>
                <GaleriaEditor
                  imovelId={imovel.id}
                  imagens={form.images}
                  onChange={(imagens: string[]) => atualizarCampo('images', imagens)}
                />
              </section>
            )}

            {abaAtiva === 'precos' && (
              <section aria-labelledby="precos-imovel">
                <div className="mb-5">
                  <h3 id="precos-imovel" className="text-lg font-bold text-slate-900">Defina seus valores</h3>
                  <p className="mt-1 text-sm text-slate-500">Veja com clareza quanto o hóspede paga e quanto você recebe.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Valor da diária <span className="text-rose-600">*</span></span>
                    <div className="flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-[#155E75] focus-within:ring-4 focus-within:ring-[#155E75]/10">
                      <span className="text-sm text-slate-500">R$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={form.price_per_night}
                        onChange={(evento) => atualizarCampo('price_per_night', evento.target.value)}
                        placeholder="0,00"
                        className="w-full border-0 px-2 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Taxa de limpeza</span>
                    <div className="flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-[#155E75] focus-within:ring-4 focus-within:ring-[#155E75]/10">
                      <span className="text-sm text-slate-500">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={form.cleaning_fee}
                        onChange={(evento) => atualizarCampo('cleaning_fee', evento.target.value)}
                        placeholder="0,00"
                        className="w-full border-0 px-2 py-3 text-sm outline-none"
                      />
                    </div>
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="font-bold text-slate-900">Prévia de 1 diária</h4>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 text-slate-600"><span>Diária</span><span>{formatarMoeda(valores.diariaCentavos)}</span></div>
                    <div className="flex justify-between gap-4 text-slate-600"><span>Taxa de limpeza (100% para você)</span><span>{formatarMoeda(valores.limpezaCentavos)}</span></div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 font-semibold text-slate-900"><span>Total para o hóspede</span><span>{formatarMoeda(valores.totalHospedeCentavos)}</span></div>
                    <div className="flex justify-between gap-4 text-rose-700"><span>Comissão GoFérias (10% somente da diária)</span><span>− {formatarMoeda(valores.comissaoCentavos)}</span></div>
                    <div className="flex justify-between gap-4 rounded-xl bg-emerald-50 px-3 py-3 font-bold text-emerald-800"><span>Você recebe</span><span>{formatarMoeda(valores.liquidoAnfitriaoCentavos)}</span></div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">A comissão de 10% incide apenas sobre a diária; a taxa de limpeza é repassada integralmente ao anfitrião.</p>
                </div>
              </section>
            )}

            {abaAtiva === 'sincronizacao' && (
              <section aria-labelledby="sincronizacao-imovel">
                <div className="mb-5">
                  <h3 id="sincronizacao-imovel" className="text-lg font-bold text-slate-900">Sincronize seus calendários</h3>
                  <p className="mt-1 text-sm text-slate-500">Importe bloqueios de disponibilidade do Airbnb ou Booking por um link iCal HTTPS.</p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Link do calendário externo (.ics)</span>
                  <input
                    type="url"
                    value={icalUrl}
                    onChange={(evento) => {
                      setIcalUrl(evento.target.value);
                      setStatusIcal('');
                      setErro('');
                    }}
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    autoComplete="url"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
                  />
                </label>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => void sincronizarIcal()}
                    disabled={sincronizandoIcal || !icalUrl.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155E75] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#104b5e] disabled:cursor-wait disabled:opacity-60"
                  >
                    {sincronizandoIcal && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                    {sincronizandoIcal ? 'Sincronizando...' : 'Sincronizar Agora'}
                  </button>
                  <p className="text-xs text-slate-500">Os períodos importados serão adicionados como bloqueios de disponibilidade.</p>
                </div>
                {statusIcal && (
                  <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {statusIcal}
                  </p>
                )}
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <span className="font-semibold text-slate-700">Última sincronização: </span>
                  <span className="text-slate-600">
                    {ultimaSincronizacao
                      ? new Date(ultimaSincronizacao).toLocaleString('pt-BR')
                      : 'Ainda não sincronizado'}
                  </span>
                </div>
              </section>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              Cancelar
            </button>
            <div className="flex gap-2">
              {indiceAbaAtiva > 0 && (
                <button
                  type="button"
                  onClick={() => setAbaAtiva(abas[indiceAbaAtiva - 1].id)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Voltar
                </button>
              )}
              {indiceAbaAtiva < abas.length - 1 && (
                <button
                  type="button"
                  onClick={() => setAbaAtiva(abas[indiceAbaAtiva + 1].id)}
                  className="rounded-xl border border-[#155E75] px-4 py-2.5 text-sm font-bold text-[#155E75] transition hover:bg-cyan-50"
                >
                  Continuar
                </button>
              )}
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-[#E87722] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d16617] disabled:cursor-wait disabled:opacity-60"
              >
                {salvando && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {salvando ? 'Salvando...' : salvoComSucesso ? 'Salvo com sucesso' : 'Salvar imóvel'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
