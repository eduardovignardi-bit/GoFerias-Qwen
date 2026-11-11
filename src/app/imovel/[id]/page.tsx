import ConteudoImovel from './ConteudoImovel';

export default async function PaginaDetalhesImovel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConteudoImovel imovelId={id} />;
}
