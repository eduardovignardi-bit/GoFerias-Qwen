'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import GaleriaEditor from './GaleriaEditor';
import CamposEndereco from './CamposEndereco';

export default function ModalEditarImovel({ imovel, onClose, onSalvo }: any) {
  const fotosIniciais =
    Array.isArray(imovel.images) && imovel.images.length > 0
      ? imovel.images
      : imovel.image_url
      ? [imovel.image_url]
      : [];

  const [form, setForm] = useState({
    ...imovel,
    cep: imovel.cep || '',
    street: imovel.street || '',
    street_number: imovel.street_number || '',
    neighborhood: imovel.neighborhood || '',
    city: imovel.city || '',
    state: imovel.state || '',
    guests: imovel.guests || 2,
    bedrooms: imovel.bedrooms || 1,
    beds: imovel.beds || 1,
    bathrooms: imovel.bathrooms || 1,
    cleaning_fee: imovel.cleaning_fee || 0,
    images: fotosIniciais,
  });
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.cep.replace(/\D/g, '').length !== 8) {
      return alert('O CEP válido com 8 dígitos é obrigatório.');
    }

    setSalvando(true);
    const local = form.city && form.state ? `${form.city}, ${form.state}` : form.location;

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          title: form.title,
          cep: form.cep,
          street: form.street,
          street_number: form.street_number,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
          location: local,
          guests: Number(form.guests),
          bedrooms: Number(form.bedrooms),
          beds: Number(form.beds),
          bathrooms: Number(form.bathrooms),
          price_per_night: Number(form.price_per_night),
          cleaning_fee: Number(form.cleaning_fee),
          image_url: form.images || '',
          images: form.images,
          description: form.description,
        })
        .eq('id', form.id);

      if (error) throw error;
      onSalvo();
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-sm">✕</button>
          <h3 className="text-base font-bold">Dados completos do imóvel</h3>
          <div className="w-8" />
        </div>

        <form onSubmit={handleSalvar} className="p-6 overflow-y-auto space-y-6">
          <GaleriaEditor
            imovelId={imovel.id}
            imagens={form.images}
            onChange={(novas: string[]) => setForm({ ...form, images: novas })}
          />

          <div className="border-t border-gray-200 pt-5 space-y-4">
            <h4 className="text-sm font-bold">1. Identificação e Valores</h4>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título do anúncio *"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Diária (R$) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={form.price_per_night}
                  onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Taxa de limpeza (R$) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={form.cleaning_fee}
                  onChange={(e) => setForm({ ...form, cleaning_fee: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <CamposEndereco form={form} setForm={setForm} />

          <div className="border-t border-gray-200 pt-5 space-y-4">
            <h4 className="text-sm font-bold">3. Capacidade e Acomodações</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Hóspedes *</label>
                <input type="number" required min={1} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Quartos *</label>
                <input type="number" required min={0} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Camas *</label>
                <input type="number" required min={1} value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Banheiros *</label>
                <input type="number" required min={1} value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Descrição do espaço *</label>
            <textarea rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3.5 py-2.5 border rounded-xl text-sm" />
          </div>

          <div className="pt-4 border-t flex justify-between items-center">
            <button type="button" onClick={onClose} className="text-sm font-semibold underline text-gray-600">Cancelar</button>
            <button type="submit" disabled={salvando} className="px-6 py-3 bg-[#E87722] text-white text-sm font-bold rounded-xl">
              {salvando ? 'Salvando...' : 'Salvar imóvel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
