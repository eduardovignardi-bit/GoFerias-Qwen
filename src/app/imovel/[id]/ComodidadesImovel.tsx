'use client';

import { useState } from 'react';
import { LISTA_COMODIDADES } from '@/lib/comodidades';

const MARCADOR = 'Comodidades informadas: ';

export function extrairComodidadesDaDescricao(descricaoCompleta?: string | null) {
  const texto = descricaoCompleta || '';
  const indice = texto.lastIndexOf(MARCADOR);
  if (indice < 0) {
    return { textoLimpo: texto, comodidadesAtivas: [] as string[] };
  }
  const textoLimpo = texto.slice(0, indice).trim();
  const listaBruta = texto.slice(indice + MARCADOR.length);
  const comodidadesAtivas = listaBruta
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return { textoLimpo, comodidadesAtivas };
}

export default function ComodidadesImovel({
  comodidadesAtivas,
}: {
  comodidadesAtivas: string[];
}) {
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const ativasNormalizadas = new Set(
    comodidadesAtivas.map((item) => item.toLowerCase())
  );

  // Separa os itens disponíveis e os detectores de segurança indisponíveis (estilo Airbnb)
  const itensDisponiveis = LISTA_COMODIDADES.filter((item) =>
    ativasNormalizadas.has(item.nome.toLowerCase())
  ).map((item) => ({
    id: item.id,
    nome: item.nome,
    disponivel: true,
  }));

  // Adiciona também comodidades personalizadas antigas que não estejam na lista padrão
  const nomesPadrao = new Set(
    LISTA_COMODIDADES.map((item) => item.nome.toLowerCase())
  );
  const itensExtras = comodidadesAtivas
    .filter((nome) => !nomesPadrao.has(nome.toLowerCase()))
    .map((nome, idx) => ({
      id: `extra-${idx}`,
      nome,
      disponivel: true,
    }));

  const segurancaIndisponivel = LISTA_COMODIDADES.filter(
    (item) =>
      item.categoria === 'Segurança doméstica' &&
      !ativasNormalizadas.has(item.nome.toLowerCase())
  ).map((item) => ({
    id: item.id,
    nome: item.nome,
    disponivel: false,
  }));

  const listaCompleta = [
    ...itensDisponiveis,
    ...itensExtras,
    ...segurancaIndisponivel,
  ];

  if (listaCompleta.length === 0) return null;

  const itensVisiveis = mostrarTodas ? listaCompleta : listaCompleta.slice(0, 8);

  return (
    <section className="border-t border-slate-200 py-8">
      <h2 className="text-xl font-bold text-slate-900">
        O que esse lugar oferece
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {itensVisiveis.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 text-sm ${
              item.disponivel ? 'text-slate-800' : 'text-slate-400 line-through'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.disponivel
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {item.disponivel ? '✓' : '✕'}
            </span>
            <span>
              {item.disponivel ? item.nome : `Indisponível: ${item.nome}`}
            </span>
          </div>
        ))}
      </div>

      {listaCompleta.length > 8 && (
        <button
          type="button"
          onClick={() => setMostrarTodas((atual) => !atual)}
          className="mt-6 rounded-xl border border-slate-900 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          {mostrarTodas
            ? 'Mostrar menos'
            : `Mostrar todas as ${listaCompleta.length} comodidades`}
        </button>
      )}
    </section>
  );
}
