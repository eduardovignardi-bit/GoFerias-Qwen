<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Arquitetura GoFerias

### Organização da aplicação

- `src/app/` é a camada de aplicação Next.js: páginas e componentes de cada fluxo ficam junto à rota correspondente; endpoints HTTP ficam em `src/app/api/**/route.ts`.
- `src/components/` contém componentes compartilhados de interface. `src/lib/` concentra integrações e utilitários compartilhados; mantenha cada integração externa encapsulada ali quando for reutilizada.
- Componentes com `'use client'` cuidam da interação no navegador. Segredos, acesso privilegiado e operações que dependem de validação confiável devem permanecer em Route Handlers ou em módulos exclusivamente de servidor.
- Preserve os fluxos existentes de marketplace, anfitrião, imóvel, viagens, importação, calendário/iCal e ativação paga ao alterar uma integração ou mover responsabilidades.

### Supabase

- Supabase é a fonte de verdade para autenticação, dados da aplicação e arquivos. Reutilize o cliente compartilhado em `src/lib/supabase.ts`; não crie clientes paralelos sem necessidade.
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` podem ser usados no cliente. A chave `anon` não substitui autorização: habilite e mantenha políticas RLS adequadas para todas as tabelas e buckets acessíveis pelo navegador.
- Nunca exponha `service_role` ou outra credencial privilegiada em código cliente, variáveis `NEXT_PUBLIC_*`, respostas HTTP ou logs. Se uma operação exigir acesso privilegiado, implemente-a no servidor, valide a sessão e a autorização do recurso e use uma credencial exclusivamente server-side.
- Não confie em `userId`, proprietário, preço, status ou permissões enviados pelo navegador. Derive a identidade da sessão autenticada e confira a propriedade/autorização antes de ler ou alterar dados.
- Trate erros retornados pelo Supabase explicitamente; não reporte sucesso quando uma gravação ou consulta falhar. Alterações de esquema e políticas devem ser coordenadas e documentadas junto à mudança que delas depende.

### Mercado Pago

- A integração de pagamentos é server-side, por Route Handlers em `src/app/api/checkout/` e `src/app/api/webhook/mercadopago/`. O navegador pode iniciar o checkout e exibir o resultado, mas não pode decidir que um pagamento foi aprovado nem ativar um imóvel.
- Mantenha `MP_ACCESS_TOKEN` somente no ambiente do servidor. Não use prefixo `NEXT_PUBLIC_`, não inclua o token no bundle, em respostas ou em logs.
- O servidor deve validar a sessão e o imóvel antes de criar a preferência, e calcular no servidor o valor, moeda, referência externa e URLs de retorno a partir de dados confiáveis.
- O webhook é a confirmação do pagamento: valide a autenticidade da notificação conforme o mecanismo suportado pelo Mercado Pago e consulte o pagamento na API antes de atualizar o Supabase. Confira status, valor, moeda e referência associados à operação; processe notificações repetidas de forma idempotente.
- URLs de retorno são experiência de navegação, não prova de pagamento. Separe credenciais e configurações de sandbox e produção por ambiente; não fixe o modo de pagamento em código.
- Responda aos webhooks conforme o contrato do Mercado Pago e registre falhas de processamento sem expor tokens, dados de cartão ou dados pessoais desnecessários.

### Vercel e configuração

- A aplicação é implantada na Vercel. Trate Route Handlers como funções serverless: não dependa de estado em memória entre invocações, processos persistentes ou arquivos locais graváveis para armazenar dados duráveis.
- Configure variáveis e segredos no ambiente correto da Vercel (Development, Preview e Production). Para desenvolvimento local, use o mecanismo local de variáveis do projeto; nunca versione arquivos com segredos.
- Use `NEXT_PUBLIC_*` apenas para valores que podem ser divulgados ao navegador. Integrações e segredos server-side devem ser lidos exclusivamente no servidor.
- Gere URLs de retorno e de webhook a partir de configuração confiável do ambiente/deployment, não de um `Origin` arbitrário fornecido pelo cliente. Mantenha as URLs públicas HTTPS corretas em produção.
- Considere limites de tempo e execução das funções ao implementar importações, sincronizações ou chamadas a serviços externos. Para trabalho durável ou recorrente, use armazenamento/filas ou agendamento apropriados em vez de depender de uma execução longa.
- Não registre segredos nem conteúdo sensível em logs; inclua contexto suficiente para diagnosticar falhas sem expor credenciais ou dados de usuários.

### Validação de mudanças

- Ao alterar fluxos de dados ou integrações, valide tanto sucesso quanto falhas de autenticação/autorização, erros do provedor e notificações repetidas quando aplicável.
- Use os scripts existentes do projeto (`npm run lint` e `npm run build`) para validar mudanças relevantes e atualize esta documentação quando as fronteiras de responsabilidade mudarem.
