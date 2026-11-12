'use client';

import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

type Props = {
  imovelId: string;
  imagens: string[];
  onChange: (imagens: string[]) => void;
};

type UploadProgress = {
  completed: number;
  total: number;
  currentName: string;
};

const TIPOS_IMAGEM_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export default function GaleriaEditor({ imovelId, imagens, onChange }: Props) {
  const [novaUrl, setNovaUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState<UploadProgress | null>(null);
  const [erro, setErro] = useState('');

  const handleUpload = async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivos = evento.target.files;
    if (!arquivos || arquivos.length === 0) return;

    setErro('');
    const selecionados = Array.from(arquivos);
    const arquivoInvalido = selecionados.find(
      (arquivo) => !TIPOS_IMAGEM_ACEITOS.includes(arquivo.type) || arquivo.size > 10 * 1024 * 1024
    );
    if (arquivoInvalido) {
      setErro(
        arquivoInvalido.size > 10 * 1024 * 1024
          ? `A foto "${arquivoInvalido.name}" excede o limite de 10 MB.`
          : `O arquivo "${arquivoInvalido.name}" não é uma imagem.`
      );
      evento.target.value = '';
      return;
    }

    setEnviando(true);
    const lista = [...imagens];
    const previews = selecionados.map((arquivo) => URL.createObjectURL(arquivo));
    lista.push(...previews);
    onChange([...lista]);
    const errosUpload: string[] = [];

    for (let indice = 0; indice < selecionados.length; indice++) {
      const arquivo = selecionados[indice];
      const preview = previews[indice];
      setProgressoUpload({ completed: indice, total: selecionados.length, currentName: arquivo.name });
      try {
        const extensao = arquivo.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        const caminho = `${imovelId}/${crypto.randomUUID()}.${extensao}`;
        const { error } = await supabase.storage
          .from('imoveis-fotos')
          .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type, cacheControl: '3600' });
        if (error) throw error;

        const { data } = supabase.storage.from('imoveis-fotos').getPublicUrl(caminho);
        if (!data.publicUrl) throw new Error('O Storage não retornou o endereço público da foto.');
        const indicePreview = lista.indexOf(preview);
        if (indicePreview >= 0) lista[indicePreview] = data.publicUrl;
        onChange([...lista]);
      } catch (error) {
        console.error('Erro ao enviar foto:', error);
        const indicePreview = lista.indexOf(preview);
        if (indicePreview >= 0) lista.splice(indicePreview, 1);
        onChange([...lista]);
        errosUpload.push(
          error instanceof Error ? `${arquivo.name}: ${error.message}` : `Não foi possível enviar "${arquivo.name}".`
        );
      } finally {
        URL.revokeObjectURL(preview);
      }
    }
    setProgressoUpload({ completed: selecionados.length, total: selecionados.length, currentName: '' });
    setErro(errosUpload.join(' '));
    setEnviando(false);
    evento.target.value = '';
  };

  const adicionarLink = () => {
    setErro('');
    try {
      const url = new URL(novaUrl.trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Use um endereço de imagem HTTP ou HTTPS.');
      }
      onChange([...imagens, url.toString()]);
      setNovaUrl('');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Informe uma URL de imagem válida.');
    }
  };

  const handleTeclaUrl = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      adicionarLink();
    }
  };

  const remover = (indice: number) => {
    onChange(imagens.filter((_, itemIndice) => itemIndice !== indice));
  };

  const definirComoCapa = (indice: number) => {
    if (indice === 0) return;
    const copia = [...imagens];
    const [escolhida] = copia.splice(indice, 1);
    copia.unshift(escolhida);
    onChange(copia);
  };

  const mover = (indice: number, deslocamento: -1 | 1) => {
    const destino = indice + deslocamento;
    if (destino < 0 || destino >= imagens.length) return;
    const copia = [...imagens];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onChange(copia);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Galeria de fotos ({imagens.length})</h4>
          <p className="mt-1 text-xs text-slate-500">A primeira foto da lista será a capa do anúncio.</p>
        </div>
        <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#155E75] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#104b5e] ${enviando ? 'pointer-events-none opacity-60' : ''}`}>
          {enviando ? 'Enviando fotos...' : '+ Enviar fotos'}
          <input
            type="file"
            multiple
            accept={TIPOS_IMAGEM_ACEITOS.join(',')}
            onChange={(evento) => void handleUpload(evento)}
            disabled={enviando}
            className="sr-only"
          />
        </label>
      </div>

      {progressoUpload && (
        <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3" role="status" aria-live="polite">
          <div className="mb-2 flex justify-between gap-3 text-xs font-medium text-cyan-900">
            <span>
              {progressoUpload.completed === progressoUpload.total
                ? 'Upload concluído'
                : `Enviando ${progressoUpload.currentName}`}
            </span>
            <span>{progressoUpload.completed}/{progressoUpload.total}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progressoUpload.total}
            aria-valuenow={progressoUpload.completed}
            aria-label="Progresso do envio das fotos"
          >
            <div
              className="h-full rounded-full bg-cyan-700 transition-all"
              style={{ width: `${(progressoUpload.completed / progressoUpload.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={novaUrl}
          onChange={(evento) => setNovaUrl(evento.target.value)}
          onKeyDown={handleTeclaUrl}
          disabled={enviando}
          placeholder="Ou cole o endereço (URL) de uma imagem"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#155E75] focus:ring-4 focus:ring-[#155E75]/10"
        />
        <button
          type="button"
          onClick={adicionarLink}
          disabled={enviando}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Adicionar URL
        </button>
      </div>

      {erro && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {imagens.length > 0 ? (
        <div className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
          {imagens.map((url, indice) => (
            <div key={`${url}-${indice}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image
                  src={url}
                  alt={`Foto ${indice + 1} do imóvel`}
                  fill
                  sizes="(min-width: 640px) 33vw, 50vw"
                  unoptimized
                  className="object-cover"
                />
                {indice === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-900 shadow-sm">
                    Capa
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => definirComoCapa(indice)}
                    disabled={enviando}
                    className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-800 shadow-sm transition hover:bg-white"
                  >
                    Definir capa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remover(indice)}
                  disabled={enviando}
                  aria-label={`Remover foto ${indice + 1}`}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-rose-600 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="text-xs font-medium text-slate-500">Foto {indice + 1}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={enviando || indice === 0}
                    onClick={() => mover(indice, -1)}
                    aria-label={`Mover foto ${indice + 1} para a esquerda`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={enviando || indice === imagens.length - 1}
                    onClick={() => mover(indice, 1)}
                    aria-label={`Mover foto ${indice + 1} para a direita`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
          <p className="font-semibold text-slate-700">Sua galeria está vazia</p>
          <p className="mt-1 text-sm text-slate-500">Envie uma foto ou adicione uma imagem por URL.</p>
        </div>
      )}
    </div>
  );
}
