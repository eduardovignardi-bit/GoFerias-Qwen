'use client';
import { useState } from 'react';

export default function CamposEndereco({ form, setForm }: any) {
  const [buscandoCep, setBuscandoCep] = useState(false);

  const handleBuscaCep = async (valor: string) => {
    const cepLimpo = valor.replace(/\D/g, '').slice(0, 8);
    setForm((prev: any) => ({ ...prev, cep: cepLimpo }));

    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      try {
        const res = await fetch(`https://viacep.com.br{cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm((prev: any) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
            location: `${data.localidade}, ${data.uf}`,
          }));
        } else {
          alert('CEP não encontrado.');
        }
      } catch {
        alert('Erro ao consultar o CEP.');
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  return (
    <div className="border-t border-gray-200 pt-5 space-y-4">
      <h4 className="text-sm font-bold text-gray-900">2. Endereço Completo (Para o Mapa)</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">CEP (Obrigatório) *</label>
          <input
            type="text"
            required
            maxLength={8}
            value={form.cep}
            onChange={(e) => handleBuscaCep(e.target.value)}
            placeholder="00000000"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
          {buscandoCep && <span className="text-[11px] text-[#E87722]">Buscando CEP...</span>}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Rua / Logradouro *</label>
          <input
            type="text"
            required
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Número *</label>
          <input
            type="text"
            required
            value={form.street_number}
            onChange={(e) => setForm({ ...form, street_number: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Bairro *</label>
          <input
            type="text"
            required
            value={form.neighborhood}
            onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade *</label>
          <input
            type="text"
            required
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">UF *</label>
          <input
            type="text"
            required
            maxLength={2}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm"
          />
        </div>
      </div>
    </div>
  );
}
