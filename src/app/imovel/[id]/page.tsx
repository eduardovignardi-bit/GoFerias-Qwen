import { Suspense } from 'react';
import ConteudoImovel from './ConteudoImovel';

export default function PaginaDetalhesImovel() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Carregando detalhes do espaço...
        </div>
      }
    >
      <ConteudoImovel />
    </Suspense>
  );
}
