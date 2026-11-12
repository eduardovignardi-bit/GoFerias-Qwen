'use client';

import { useState } from 'react';

type Endereco = {
  cep: string;
  street: string;
  street_number: string;
  neighborhood: string;
  city: string;
  state: string;
};

type Props = {
  form: Endereco;
  onChange: (alteracoes: Partial<Endereco>) => void;
};

type RespostaViaCep = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export default function CamposEndereco({ form, onChange }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);

  const handleBuscaCep = async (valor: string) => {
    const cepLimpo = valor.replace(/\D/g, '').slice(0, 8);
    onChange({ cep: cepLimpo });

    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        if (!resposta.ok) throw new Error('O serviço de CEP está indisponível.');
        const dados = (await resposta.json()) as RespostaViaCep;
        if (dados.erro) {
          window.alert('CEP não encontrado.');
          return;
        }
        onChange({
          street: dados.logradouro || form.street,
          neighborhood: dados.bairro || form.neighborhood,
          city: dados.localidade || form.city,
          state: dados.uf || form.state,
        });
      } catch (error) {
        console.error('Erro ao consultar CEP:', error);
        window.alert(error instanceof Error ? error.message : 'Erro ao consultar o CEP.');
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">CEP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={9}
            value={form.cep}
            onChange={(evento) => void handleBuscaCep(evento.target.value)}
            placeholder="00000-000"
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
          />
          {buscandoCep && <span className="text-[11px] text-[#E87722]">Buscando CEP...</span>}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-gray-700">Rua / Logradouro</label>
          <input
            type="text"
            value={form.street}
            onChange={(evento) => onChange({ street: evento.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Número</label>
          <input
            type="text"
            value={form.street_number}
            onChange={(evento) => onChange({ street_number: evento.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Bairro</label>
          <input
            type="text"
            value={form.neighborhood}
            onChange={(evento) => onChange({ neighborhood: evento.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Cidade *</label>
          <input
            type="text"
            value={form.city}
            onChange={(evento) => onChange({ city: evento.target.value })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">UF</label>
          <input
            type="text"
            maxLength={2}
            value={form.state}
            onChange={(evento) => onChange({ state: evento.target.value.toUpperCase() })}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
