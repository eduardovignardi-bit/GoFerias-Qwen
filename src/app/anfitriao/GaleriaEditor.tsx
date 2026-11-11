'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GaleriaEditor({ imovelId, imagens, onChange }: any) {
  const [novaUrl, setNovaUrl] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = e.target.files;
    if (!arquivos || arquivos.length === 0) return;

    setEnviando(true);
    const lista = [...imagens];

    try {
      for (let i = 0; i < arquivos.length; i++) {
        const file = arquivos[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const caminho = `${imovelId}/${Date.now()}-${i}.${ext}`;

        const { error } = await supabase.storage
          .from('imoveis-fotos')
          .upload(caminho, file, { upsert: true });

        if (error) throw error;

        const { data } = supabase.storage.from('imoveis-fotos').getPublicUrl(caminho);
        if (data?.publicUrl) lista.push(data.publicUrl);
      }
      onChange(lista);
    } catch (err: any) {
      alert('Erro ao enviar foto: ' + err.message);
    } finally {
      setEnviando(false);
      e.target.value = '';
    }
  };

  const adicionarLink = () => {
    if (!novaUrl.trim()) return;
    onChange([...imagens, novaUrl.trim()]);
    setNovaUrl('');
  };

  const remover = (idx: number) => {
    onChange(imagens.filter((_: any, i: number) => i !== idx));
  };

  const definirComoCapa = (idx: number) => {
    if (idx === 0) return;
    const copia = [...imagens];
    const [escolhida] = copia.splice(idx, 1);
    copia.unshift(escolhida);
    onChange(copia);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#222222]">Galeria de fotos ({imagens.length})</h4>
          <p className="text-xs text-gray-500">Arraste ou selecione fotos em alta resolução. A primeira será a capa.</p>
        </div>
        <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-black text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
          {enviando ? 'Enviando...' : '+ Adicionar fotos'}
          <input type="file" multiple accept="image/*" onChange={handleUpload} disabled={enviando} className="hidden" />
        </label>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={novaUrl}
          onChange={(e) => setNovaUrl(e.target.value)}
          placeholder="Ou cole o endereço (URL) de uma imagem..."
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-black transition"
        />
        <button
          type="button"
          onClick={adicionarLink}
          className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
        >
          Inserir URL
        </button>
      </div>

      {imagens.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
          {imagens.map((url: string, idx: number) => (
            <div key={idx} className="relative group aspect-4/3 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 ? (
                <span className="absolute top-2 left-2 bg-white/95 text-[#222222] text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                  Foto de capa
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => definirComoCapa(idx)}
                  className="opacity-0 group-hover:opacity-100 absolute top-2 left-2 bg-white/95 hover:bg-white text-[#222222] text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs transition"
                >
                  Tornar capa
                </button>
              )}
              <button
                type="button"
                onClick={() => remover(idx)}
                title="Excluir foto"
                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 bg-white/95 hover:bg-red-600 hover:text-white text-gray-800 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shadow-xs transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
