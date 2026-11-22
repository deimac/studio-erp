# Remodelação do site tsmassoterapeuta — Design + Plano

## Contexto
O site público (`frontend-public`, React 19 + Vite + Tailwind 4) tem hoje um tema marinho escuro + dourado, página única, com serviços vindos do ERP via `public.listServicosComPacotes`. A Tayna quer um site **exclusivo, elegante, luxuoso, de cores suaves**, inspirado no modelo PureFlow (hero com foto grande, cards de serviço com imagem, seção "Por que escolher", depoimento), mostrando os **6 protocolos** do PDF (Lipedema, Toque Sereno, Drenagem Linfática Corporal, Método TS, Alívio Terapêutico, Ritual de Pausa) de forma resumida na home, cada um levando a uma **página de detalhe**. Todo o conteúdo deve ser **editável no admin**. Imagens geradas por IA, trocáveis depois pelo admin.

## Objetivos / não-objetivos
- **Objetivos:** nova identidade visual clara e luxuosa; home + página por protocolo; conteúdo e imagens editáveis no admin; agendamento via WhatsApp com mensagem pré-preenchida por protocolo/modalidade/pacote; mobile impecável.
- **Não-objetivos:** agendamento online/pagamento no site; mudar fluxo de vendas/financeiro do ERP; redesenhar o admin (só adicionar telas/campos).
- **Anti-objetivos:** parecer template genérico de spa; prometer resultados clínicos (os avisos legais do PDF devem aparecer em cada protocolo que os tem).

## Abordagens consideradas
1. **Protocolo agrupa Serviços (escolhida)** — nova entidade `protocolos`; cada modalidade continua um `servico` (preço/duração) com seus `pacotes`. Vendas/financeiro intactos.
2. Tudo dentro do Serviço (modalidades em JSON) — menos telas, mas quebra o vínculo de venda com preço/duração da modalidade. Descartada.
3. Conteúdo fixo no site — descartada pela usuária (precisa ser editável).

## Modelo de dados (backend)
- Nova tabela `protocolos`: `id, nome, slug (único), subtitulo, descricao (texto), inclui (JSON string[]), beneficios (JSON string[]), aviso (texto), frase_final, imagem_url, imagem_hero_url?, ordem, permite_vale_presente (bool), ativo, timestamps`.
- `servicos`: + `id_protocolo` (FK nullable, on delete set null) + `nome_modalidade` (ex.: "Pernas", "Foco Regional") + `regioes` (JSON string[], ex.: "Pescoço e cervical").
- Nova tabela `site_config` (chave/valor) para imagens/textos globais trocáveis: imagem do hero, imagem do Sobre, frase do hero.
- Migração SQL manual (o projeto usa drizzle-orm sem drizzle-kit configurado — confirmar em `backend/src/config/db.ts` na execução) + atualizar `backend/src/drizzle/schema.ts` e `shared/types.ts`.
- Seed opcional `seed-protocolos.ts` com os 6 protocolos do PDF (textos, modalidades e pacotes 4/8 sessões), para não digitar tudo à mão. Rodar só após confirmação, pois toca o banco de produção.

## API (tRPC)
- `protocolos` router (admin): list, getById, create, update, delete, reorder.
- `siteConfig` router (admin): get/set.
- `public` router: `listProtocolos` (resumo para a home: nome, slug, subtítulo, imagem, "a partir de R$", durações) e `getProtocoloBySlug` (tudo + modalidades + pacotes), `getSiteConfig`.
- Manter `listServicosComPacotes` por compatibilidade.
- Reaproveitar upload existente `POST /api/upload` (`backend/src/app.ts:55`).

## Admin (`frontend`)
- Nova página **Protocolos** (lista ordenável + formulário): campos de texto, listas editáveis (inclui/benefícios), upload de imagem, vínculo de serviços/modalidades. Reutilizar padrões de `ServicoForm.tsx`, `PacoteForm.tsx` e `components/ui/*`.
- `ServicoForm`: novos campos protocolo, nome da modalidade, regiões.
- Seção **Site** em `Configuracoes.tsx`: troca de imagem do hero/Sobre.

## Site público (`frontend-public`)
- Roteamento simples (adicionar `react-router-dom`): `/` home, `/protocolos/:slug` detalhe. Configurar fallback SPA no Coolify/nginx para rotas profundas.
- **Home:** Header claro com monograma TS → Hero (imagem IA grande, título serif, CTA WhatsApp, lista curta de protocolos como no modelo) → "Por que escolher" (4 diferenciais em torno de um círculo, como o modelo, com o monograma no centro) → Grade de protocolos (bento de cards com imagem, nome, subtítulo, "a partir de", seta → detalhe) → Sobre a Tayna → Vale-presente (Ritual de Pausa) → Depoimentos → FAQ → Localização → Footer.
- **Detalhe do protocolo:** hero com imagem e subtítulo; descrição; "O que inclui" e "Benefícios"; cards de modalidades (duração, preço, regiões) com CTA WhatsApp por modalidade; pacotes 4/8 sessões com economia calculada; aviso legal em destaque discreto; frase final; outros protocolos.
- **Direção visual — rica em detalhes (pedido explícito da usuária: "abuse de detalhes, ícones, tons sobre tons, imagens, curvas"):**
  - **Tons sobre tons:** paleta em camadas de linho → areia → taupe → nude/rosé suave, com sálvia como secundário; cada seção em um tom vizinho, cards em tom levemente acima/abaixo do fundo, textos e ícones em tons da mesma família; **dourado do logo como acento** (fios, ícones, preços, detalhes).
  - **Curvas:** formas orgânicas e arcos (eco das elipses da logo) — imagens recortadas em arco/pílula, divisores ondulados entre seções, blobs/manchas suaves de fundo, cantos muito arredondados, círculo central na seção "Por que escolher", linhas curvas finas douradas ligando elementos.
  - **Ícones:** ícone próprio por protocolo e por item de "inclui"/benefício (traço fino, dourado/taupe, dentro de círculos tom-sobre-tom); ícones nos diferenciais, nas modalidades (relógio, região do corpo), no vale-presente.
  - **Imagens em abundância:** hero grande + imagens menores sobrepostas (colagem em camadas), imagem em cada card de protocolo, galeria/faixa de imagens no detalhe, foto da Tayna em moldura em arco, texturas sutis (folhas, linho, pedras, óleos) como elementos decorativos.
  - **Detalhes:** ornamentos finos (fios dourados, pequenos ramos/folhas, numeração 01–06 em serif), selos ("Exclusivo", "Mais procurado", "Vale-presente"), chips de duração/preço, avatares + contador de clientes no hero (como o modelo), aspas decorativas grandes nos depoimentos, monograma TS como marca d'água em seções.
  - Tipografia: serif refinada e expressiva nos títulos (com itálicos em palavras-chave) + sans leve; micro-animações de entrada, hover com leve zoom nas imagens e deslocamento das setas.
  - Equilíbrio: tudo isso sem poluir — hierarquia clara e respiro suficiente para continuar luxuoso.
- **Logo:** extrair o monograma TS do `logo_azul.png` (sem fundo, sem texto), vetorizar em SVG, versões dourada e escura; gerar favicon. Salvar em `frontend-public/public/brand/`.
- **Imagens IA:** gerar 1 hero (studio de massagem, luz natural, tons suaves) + 1 por protocolo, no mesmo tratamento de cor; servir como padrão e permitir troca pelo admin. Se a geração de imagem não estiver disponível nas ferramentas, entregar prompts prontos + placeholders elegantes e avisar.

## Execução
- Usar a skill **impeccable** para direção visual, construção e revisão final (`impeccable-finish-reviewer`) e `impeccable-documenter` para gerar `DESIGN.md`.
- Salvar este design em `docs/superpowers/specs/2026-11-22-redesign-tsmassoterapeuta-design.md` e seguir com `superpowers:writing-plans` para quebrar em tarefas.
- Ordem: (1) backend schema/migração/routers → (2) admin telas → (3) logo + tokens visuais → (4) site home → (5) página de detalhe → (6) imagens IA → (7) revisão.

## Verificação
- `npm run dev` no backend + `frontend-public` (porta 5174) + `frontend`; cadastrar um protocolo no admin e ver na home e em `/protocolos/<slug>`.
- Checar no navegador embutido: desktop e mobile (375px), links do WhatsApp com mensagem correta, troca de imagem pelo admin refletindo no site, rota profunda recarregando sem 404.
- `npm run build` nos dois frontends sem erros de tipo.
- Antes do deploy no Coolify: rodar a migração no banco de produção (com confirmação) e configurar fallback SPA.

## Em aberto (decido na execução, salvo objeção)
- Seções atuais "Resultados" e "Localização": mantenho Localização (já existe, mas não está no `App.tsx`) e transformo Resultados em "Por que escolher".
- Vídeos `massagem0X.mp4`: uso um como fundo sutil no Sobre ou no detalhe, se combinar com a nova paleta.
