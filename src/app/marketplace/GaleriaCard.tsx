'use client';
import { useState } from 'react';

export default function GaleriaCard({ imovel }: any) {
  const listaFotos =
    Array.isArray(imovel.images) && imovel.images.length > 0
      ? imovel.images
      : imovel.image_url
      ? [imovel.image_url]
      : [];

  const [indice, setIndice] = useState(0);

  if (listaFotos.length === 0) {
    return (
      <div className="h-full w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
        Sem fotos disponíveis
      </div>
    );
  }

  const anterior = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndice((prev) => (prev === 0 ? listaFotos.length - 1 : prev - 1));
  };

  const proxima = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndice((prev) => (prev === listaFotos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative h-full w-full bg-gray-100 group overflow-hidden">
      <img
        src={listaFotos[indice]}
        alt={imovel.title}
        className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
      />

      {listaFotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            className="opacity-0 group-hover:opacity-100 absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 w-7 h-7 rounded-full font-bold text-xs shadow-md flex items-center justify-center transition"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={proxima}
            className="opacity-0 group-hover:opacity-100 absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 w-7 h-7 rounded-full font-bold text-xs shadow-md flex items-center justify-center transition"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {listaFotos.map((_: any, i: number) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition ${
                  i === indice ? 'bg-white scale-110' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
