import { Suspense } from 'react';
import ConteudoImovel from './ConteudoImovel';

type PaginaDetalhesImovelProps = {
  params: Promise<{ id: string }>;
};

function EsqueletoImovel() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando detalhes do imóvel"
      className="mx-auto min-h-screen max-w-6xl animate-pulse px-6 py-8"
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-gray-200" />
        <div className="h-5 w-40 rounded bg-gray-200" />
      </div>
      <div className="mb-4 h-9 w-2/3 rounded-lg bg-gray-200" />
      <div className="mb-8 h-5 w-1/3 rounded bg-gray-200" />
      <div className="mb-10 h-80 rounded-2xl bg-gray-200 sm:h-[420px]" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="h-24 rounded-xl bg-gray-200" />
          <div className="h-40 rounded-xl bg-gray-200" />
        </div>
        <div className="h-96 rounded-2xl bg-gray-200" />
      </div>
    </main>
  );
}

async function PaginaImovelDinamica({ params }: PaginaDetalhesImovelProps) {
  const { id } = await params;
  return <ConteudoImovel imovelId={id} />;
}

export default function PaginaDetalhesImovel({ params }: PaginaDetalhesImovelProps) {
  return (
    <Suspense fallback={<EsqueletoImovel />}>
      <PaginaImovelDinamica params={params} />
    </Suspense>
  );
}
