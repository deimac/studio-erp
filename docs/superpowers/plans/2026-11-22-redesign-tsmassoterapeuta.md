# Redesign tsmassoterapeuta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo site público luxuoso e rico em detalhes (home + página por protocolo), com protocolos, modalidades, pacotes e imagens editáveis no admin.

**Architecture:** Nova entidade `protocolos` no MySQL agrupa `servicos` (cada modalidade = um serviço, com preço/duração e pacotes como hoje). Novos routers tRPC (admin + público). Admin ganha página Protocolos e aba Site; o `frontend-public` ganha roteamento (`/`, `/protocolos/:slug`) e um sistema visual novo construído com a skill **impeccable**.

**Tech Stack:** Express 5 + tRPC 11 + drizzle-orm (mysql2) · React 19 + Vite 7 + Tailwind 4 · react-router-dom 7 · lucide-react · vitest (novo, só para lógica pura).

**Spec:** `docs/superpowers/specs/2026-11-22-redesign-tsmassoterapeuta-design.md`

## Global Constraints

- **`backend/.env` aponta para o banco remoto (`DB_HOST=31.97.249.115`, `studio_erp`) — provavelmente produção.** Nenhuma migração, seed ou escrita no banco sem confirmação explícita da usuária no chat; antes de migrar, pedir/fazer backup (`mysqldump`) ou usar um banco local.
- Vendas/financeiro do ERP não mudam: `vendas.id_servico`/`id_pacote` continuam válidos; nada de renomear/remover colunas existentes.
- WhatsApp: número `5543998468294` (já usado em `Hero.tsx`/`Servicos.tsx`).
- Textos, preços e avisos dos protocolos vêm literalmente do PDF "Protolo estetica Tayna.pdf" (dados no Task 4).
- Avisos legais aparecem na página de cada protocolo que os possui; o site nunca promete cura/perda de medidas.
- Direção visual: "abuse de detalhes, ícones, tons sobre tons, imagens, curvas" — paleta linho/areia/taupe/nude + sálvia, dourado do logo como acento.
- Imagens trocáveis pelo admin via upload existente `POST /api/upload` (campo `image`, até 5 MB, retorna `{ url: "/uploads/<arquivo>" }`).
- Tipos tRPC no front são `any` (`shared/types.ts`), então nomes de procedures precisam bater exatamente com este plano.
- Não há ferramenta de geração de imagem nesta sessão: entregar prompts + placeholders decorativos; a usuária gera e sobe as imagens.

## Review Focus

1. **Protocolo sem serviços/pacotes ativos** — card na home não pode mostrar "a partir de R$ NaN"; detalhe mostra só o que existe. Teste em Task 1 (`menorPreco([]) === null`) e Task 8.
2. **Slug inexistente ou protocolo inativo** em `/protocolos/:slug` — página "não encontrado" elegante com link para a home, não tela branca. Teste de procedure em Task 3 (retorna `null`).
3. **Recarregar `/protocolos/lipedema` em produção** — precisa de fallback SPA no servidor; senão 404. Checagem no Task 11.
4. **Listas JSON malformadas/nulas** (`inclui`, `beneficios`, `regioes`) vindas do banco — renderizar lista vazia. Teste em Task 1 (`parseLista`).
5. **Economia do pacote** quando o pacote não é mais barato que N avulsas — não exibir "economize R$ 0" nem valor negativo. Teste em Task 7 (`calcularEconomia`).

---

### Task 1: Lógica pura do backend + vitest

**Files:**
- Modify: `backend/package.json` (devDep `vitest`, script `"test": "vitest run"`)
- Create: `backend/src/lib/protocolos.ts`
- Test: `backend/src/lib/protocolos.test.ts`

**Interfaces:**
- Produces: `slugify(nome: string): string`; `parseLista(valor: unknown): string[]`; `menorPreco(servicos: Array<{ valor: string | number }>): number | null`.

- [ ] **Step 1: Testes que falham**
```ts
expect(slugify('Método TS')).toBe('metodo-ts');
expect(slugify('  Alívio Terapêutico ')).toBe('alivio-terapeutico');
expect(parseLista('["a","b"]')).toEqual(['a','b']);
expect(parseLista(['a'])).toEqual(['a']);
expect(parseLista(null)).toEqual([]);
expect(parseLista('não é json')).toEqual([]);
expect(parseLista('[1,"x",""]')).toEqual(['x']); // só strings não vazias
expect(menorPreco([{ valor: '200.00' }, { valor: '150.00' }])).toBe(150);
expect(menorPreco([])).toBeNull();
```
- [ ] **Step 2:** `cd backend && npm i -D vitest && npm test` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar em `backend/src/lib/protocolos.ts` (slugify: `normalize('NFD')`, remove diacríticos, minúsculas, não-alfanumérico → `-`, trim de `-`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(backend): helpers de protocolos com testes`.

### Task 2: Schema e migração

**Files:**
- Modify: `backend/src/drizzle/schema.ts` (após `servicos`, ~linha 93; relations ~linha 321)
- Create: `backend/migrations/001_protocolos.sql`
- Create: `backend/src/migrate.ts` (script `"migrate": "tsx src/migrate.ts"`)

**Interfaces:**
- Produces (drizzle): `protocolos` { id, nome varchar(150), slug varchar(160) unique, subtitulo varchar(255), descricao text, inclui text(JSON), beneficios text(JSON), aviso text, frase_final varchar(255), icone varchar(50), imagem_url varchar(500), ordem int default 0, permite_vale_presente bool default false, ativo bool default true, created_at, updated_at }.
- `servicos` + `id_protocolo int null FK→protocolos.id ON DELETE SET NULL`, `nome_modalidade varchar(150) null`, `regioes text null (JSON)`, `ordem_modalidade int default 0`.
- `site_config` { chave varchar(100) PK, valor text }.
- Chaves de `site_config` usadas: `hero_imagem_url`, `sobre_imagem_url`, `hero_titulo`, `hero_subtitulo`.

- [ ] **Step 1:** Escrever o SQL (`CREATE TABLE IF NOT EXISTS`; `ALTER TABLE servicos ADD COLUMN` envolvido em checagem via `information_schema.COLUMNS` dentro de `migrate.ts`, pois MySQL 8 não tem `ADD COLUMN IF NOT EXISTS`).
- [ ] **Step 2:** `migrate.ts`: lê os `.sql` de `backend/migrations/`, registra aplicados em tabela `_migrations(nome, aplicado_em)`, idempotente; imprime `DB_HOST/DB_NAME` e exige `--yes` para executar.
- [ ] **Step 3:** `npx tsc --noEmit` no backend → sem erros.
- [ ] **Step 4:** **PARAR e pedir confirmação** (mostrar host/banco + recomendar backup). Só então `npm run migrate -- --yes`; rodar de novo → "nada a aplicar".
- [ ] **Step 5:** Commit `feat(db): tabela protocolos, site_config e modalidades em servicos`.

### Task 3: Routers tRPC

**Files:**
- Create: `backend/src/trpc/routers/protocolos.ts`, `backend/src/trpc/routers/siteConfig.ts`
- Modify: `backend/src/trpc/routers/publicCatalogo.ts`, `backend/src/trpc/routers/servicos.ts` (create/update/list aceitam e retornam `id_protocolo`, `nome_modalidade`, `regioes: string[]`, `ordem_modalidade`), `backend/src/app.ts:70-83` (registrar `protocolos`, `siteConfig`)
- Modify: `backend/curl-tests.md` (exemplos novos)

**Interfaces (nomes exatos usados pelos fronts):**
- `protocolos.list()` (protected) → `Protocolo[]` ordenado por `ordem`, com `servicos: {id,nome,nome_modalidade}[]`.
- `protocolos.getById({id})`, `protocolos.create(input)`, `protocolos.update({id,...input})`, `protocolos.delete({id})`, `protocolos.reorder({ids:number[]})` — admin. `input` = campos da tabela com `inclui/beneficios: string[]`; `slug` opcional (gera via `slugify(nome)`; conflito → `TRPCError CONFLICT`).
- `siteConfig.getAll()` (protected) → `Record<string,string>`; `siteConfig.set({chave, valor})` (admin; `chave` ∈ lista do Task 2).
- `public.listProtocolos()` → `{ id, nome, slug, subtitulo, icone, imagem_url, permite_vale_presente, a_partir_de: number|null, duracoes: number[] }[]` (só ativos, por `ordem`).
- `public.getProtocoloBySlug({slug})` → protocolo completo + `modalidades: { id, nome, nome_modalidade, duracao_minutos, valor, regioes: string[], pacotes: {id,nome,quantidade_sessoes,valor_total}[] }[]` ou `null`.
- `public.getSiteConfig()` → `Record<string,string>`.

- [ ] **Step 1:** Implementar routers usando `parseLista`/`menorPreco`/`slugify` do Task 1; JSON gravado com `JSON.stringify`.
- [ ] **Step 2:** `npx tsc --noEmit` → OK.
- [ ] **Step 3:** `npm run dev` e, via curl: `GET /trpc/public.listProtocolos` → `[]` ou lista; `GET /trpc/public.getProtocoloBySlug?input={"slug":"nao-existe"}` → `null`.
- [ ] **Step 4:** Commit `feat(api): routers de protocolos, site config e catálogo público`.

### Task 4: Seed dos 6 protocolos do PDF

**Files:** Create `backend/src/seed-protocolos.ts` (script `"seed:protocolos"`), idempotente por `slug` (atualiza textos; cria serviços/pacotes que faltarem, casando por `id_protocolo + nome_modalidade` e por `id_servico + quantidade_sessoes`).

Dados (copiar literalmente do PDF; ícone lucide sugerido):

| ordem | protocolo (slug) | modalidades (min – R$) | pacotes 4/8 | vale-presente | ícone |
|---|---|---|---|---|---|
| 1 | Método TS (`metodo-ts`) | Foco Regional 60–150 (regiões: Abdômen, cintura e costas; Pernas) · Corpo Integral 90–200 (Abdômen e cintura; Costas; Braços; Coxas; Glúteos) | 560/1.040 · 760/1.440 | não | `Sparkles` |
| 2 | Cuidado para Lipedema (`lipedema`) | Pernas 60–150 · Braços 60–150 · Corpo Integral 90–200 | Pernas e Braços: 560/1.040 cada · Corpo integral: 760/1.440 | não | `Feather` |
| 3 | Alívio Terapêutico (`alivio-terapeutico`) | Foco Regional 60–150 (Pescoço e cervical; Ombros e trapézio; Costas e lombar; Mandíbula…bruxismo) · Múltiplas Regiões 90–200 | 560/1.040 · 760/1.440 | não | `HandHeart` |
| 4 | Drenagem Linfática Corporal (`drenagem-linfatica`) | Corpo todo 90–190 | — (avulso) | não | `Droplets` |
| 5 | Toque Sereno (`toque-sereno`) | Relaxante 60–160 | — (avulso) | não | `Flower2` |
| 6 | Ritual de Pausa (`ritual-de-pausa`) | Da cabeça aos pés 80–190 | — (avulso) | **sim** | `Leaf` |

Subtítulo, descrição, "O que inclui", "Benefícios", aviso e frase final de cada um = textos do PDF (Método TS não tem lista de benefícios: deixar vazia).

- [ ] **Step 1:** Escrever o script com os dados acima.
- [ ] **Step 2:** `npx tsc --noEmit` → OK.
- [ ] **Step 3:** **Pedir confirmação** e então `npm run seed:protocolos`; rodar 2ª vez → não duplica (contar linhas de `protocolos`=6).
- [ ] **Step 4:** Commit `feat(db): seed dos protocolos do PDF`.

### Task 5: Admin — Protocolos, campos de modalidade, aba Site

**Files:**
- Create: `frontend/src/pages/Protocolos.tsx`, `frontend/src/components/ProtocoloForm.tsx`, `frontend/src/components/ui/list-editor.tsx` (lista de strings editável: adicionar, remover, reordenar ↑↓), `frontend/src/components/ImageUpload.tsx` (extraído da lógica de upload de `ServicoForm.tsx:25,53,190-240`, reaproveitado nos dois forms e na aba Site)
- Modify: `frontend/src/App.tsx` (rota `protocolos` dentro de `AdminRoute`), `frontend/src/components/Sidebar.tsx` (link "Protocolos", ícone `Sparkles`, `adminOnly`), `frontend/src/components/ServicoForm.tsx` (select Protocolo, Nome da modalidade, Regiões via `ListEditor`, Ordem), `frontend/src/pages/Configuracoes.tsx` (aba "Site": imagem do hero, imagem do Sobre, título/subtítulo do hero → `siteConfig.set`)

**Interfaces:** Consumes procedures do Task 3. Produces `<ListEditor value: string[] onChange(v: string[]) placeholder? />`, `<ImageUpload value?: string onChange(url: string) />`.

- [ ] **Step 1:** Implementar seguindo o padrão visual de `pages/Servicos.tsx` e `components/ui/*`.
- [ ] **Step 2:** `cd frontend && npm run build` → sem erros.
- [ ] **Step 3:** No navegador embutido (admin em dev): criar protocolo de teste, subir imagem, vincular serviço, reordenar; editar e excluir. Conferir que Vendas ainda lista serviços normalmente.
- [ ] **Step 4:** Commit `feat(admin): gestão de protocolos, modalidades e imagens do site`.

### Task 6: Monograma TS + sistema visual (impeccable)

**Files:**
- Create: `frontend-public/public/brand/ts-monograma.svg` (dourado `#C08332`-ish amostrado do PNG), `ts-monograma-escuro.svg`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`
- Rewrite: `frontend-public/src/styles/globals.css` (tokens `@theme`: camadas `linen/sand/taupe/nude/sage` em 3–4 tons cada + `gold`; tipografia; utilitários de curvas/arcos/ondas)
- Create: `frontend-public/src/components/decor/` — `Ornament.tsx` (fio dourado + ramo), `WaveDivider.tsx` (prop `from`, `to` tons), `ArchImage.tsx` (imagem em arco/pílula com fallback decorativo tom-sobre-tom quando `src` vazio), `IconCircle.tsx`, `Seal.tsx` (selo "Exclusivo" etc.), `Blob.tsx`, `Monogram.tsx` (marca d'água)
- Create: `frontend-public/src/lib/icons.ts` → `iconeProtocolo(nome?: string | null): LucideIcon` (fallback `Sparkles`)
- Modify: `frontend-public/index.html` (fontes escolhidas, favicon, meta)

- [ ] **Step 1:** Invocar a skill `impeccable` com: modelo PureFlow (imagem da usuária), logo, spec, e a direção "abuse de detalhes, ícones, tons sobre tons, imagens, curvas". Fixar paleta e fontes.
- [ ] **Step 2:** Logo: venv em scratchpad com `Pillow` + `potracer`; isolar pixels dourados do `logo_azul.png`, recortar só o monograma (sem elipses e sem texto), vetorizar → SVG; gerar PNGs do favicon. Verificar visualmente (Read da imagem gerada) em fundo claro e escuro.
- [ ] **Step 3:** Criar tokens e componentes decorativos; montar uma página `/_kit` temporária só em dev para conferir no navegador embutido; removê-la ao final do Task 9.
- [ ] **Step 4:** `npm run build` → OK. Commit `feat(site): monograma TS e sistema visual`.

### Task 7: Roteamento e camada de dados do site

**Files:**
- Modify: `frontend-public/package.json` (deps `react-router-dom@^7.13.1`; devDep `vitest`; script `test`), `frontend-public/src/main.tsx`, `frontend-public/src/App.tsx` (rotas `/`, `/protocolos/:slug`, `*`→ NotFound; `ScrollToTop`; âncoras `#secao` funcionam vindo de outra rota)
- Create: `frontend-public/src/lib/format.ts`, `frontend-public/src/lib/format.test.ts`, `frontend-public/src/lib/whatsapp.ts`, `frontend-public/src/lib/media.ts` (move `resolveImageUrl` de `Servicos.tsx:6-11`), `frontend-public/src/pages/Home.tsx`, `frontend-public/src/pages/ProtocoloPage.tsx`, `frontend-public/src/pages/NotFound.tsx`

**Interfaces:**
- `formatBRL(v: number | string): string`; `calcularEconomia(valorAvulso: number, sessoes: number, valorPacote: number): number | null` (null se ≤ 0); `formatDuracoes(min: number[]): string` (`[60,90]` → `"60 – 90 min"`, `[80]` → `"80 min"`).
- `whatsappUrl(opts: { protocolo?: string; modalidade?: string; pacote?: { sessoes: number }; valePresente?: boolean }): string`.

- [ ] **Step 1: Testes que falham**
```ts
expect(formatBRL(1040)).toBe('R$ 1.040,00');            // normalizar NBSP para comparar
expect(calcularEconomia(150, 4, 560)).toBe(40);
expect(calcularEconomia(150, 8, 1040)).toBe(160);
expect(calcularEconomia(150, 4, 600)).toBeNull();
expect(formatDuracoes([90, 60, 60])).toBe('60 – 90 min');
expect(decodeURIComponent(whatsappUrl({ protocolo: 'Lipedema', modalidade: 'Pernas', pacote: { sessoes: 8 } })))
  .toContain('pacote de 8 sessões de Lipedema – Pernas');
expect(whatsappUrl({})).toMatch(/^https:\/\/wa\.me\/5543998468294\?text=/);
```
- [ ] **Step 2:** `npm i react-router-dom@^7.13.1 && npm i -D vitest && npm test` → FAIL.
- [ ] **Step 3:** Implementar; `npm test` → PASS; `npm run build` → OK.
- [ ] **Step 4:** Commit `feat(site): rotas e utilitários de preço/WhatsApp`.

### Task 8: Home

**Files:** Rewrite `frontend-public/src/sections/*` conforme a ordem da spec; Create `sections/PorQueEscolher.tsx` (substitui `Resultados.tsx`, remover este), `sections/Protocolos.tsx` (substitui `Servicos.tsx`, remover este), `sections/ValePresente.tsx`; reintegrar `Localizacao.tsx`.

Conteúdo-chave: Header claro com `Monogram` + nav (Início, Protocolos, Sobre, Vale-presente, Depoimentos, FAQ, Contato) + CTA; Hero com colagem de imagens em arco (`site_config.hero_imagem_url` + imagens dos protocolos), lista curta de 3 protocolos com seta, avatares/contador; "Por que escolher" com 4 diferenciais ao redor de círculo com monograma; grade bento de protocolos (numeração 01–06 em serif, `IconCircle`, "a partir de", durações, selo "Mais procurado" no Método TS / "Vale-presente" no Ritual); Sobre com `ArchImage`; ValePresente aparece se algum protocolo `permite_vale_presente`.

- [ ] **Step 1:** Construir com impeccable usando `public.listProtocolos` e `public.getSiteConfig`.
- [ ] **Step 2:** Estados: carregando (skeleton tom-sobre-tom), lista vazia, protocolo sem preço (oculta "a partir de").
- [ ] **Step 3:** Navegador embutido: desktop 1440, tablet 768, mobile 375 — screenshots; sem scroll horizontal.
- [ ] **Step 4:** Commit `feat(site): nova home`.

### Task 9: Página do protocolo

**Files:** `frontend-public/src/pages/ProtocoloPage.tsx` + `src/components/protocolo/` (`ProtocoloHero`, `ListaIcones` (inclui/benefícios, ícone por item), `ModalidadeCard`, `PacotesTabela`, `AvisoLegal`, `OutrosProtocolos`).

- [ ] **Step 1:** Construir com `public.getProtocoloBySlug`; `document.title = "<nome> — Tayna Santos"`.
- [ ] **Step 2:** Casos: `null` → `NotFound`; sem pacotes → oculta seção; benefícios vazios (Método TS) → oculta bloco; vale-presente → CTA específico.
- [ ] **Step 3:** Navegador: os 6 slugs em desktop e mobile; links de WhatsApp com mensagem correta.
- [ ] **Step 4:** Remover `/_kit`. Commit `feat(site): página de detalhe do protocolo`.

### Task 10: Imagens (prompts + placeholders)

**Files:** Create `docs/superpowers/specs/2026-11-22-prompts-imagens.md` — 1 prompt de hero + 1 por protocolo + 1 textura, todos com o mesmo bloco de estilo (luz natural, linho/areia/sálvia, sem rostos frontais identificáveis, proporções 4:5 e 16:9).

- [ ] **Step 1:** Escrever os prompts.
- [ ] **Step 2:** Confirmar que todo `ArchImage`/card sem imagem mostra o fallback decorativo (já do Task 6) e que subir imagem no admin reflete no site.
- [ ] **Step 3:** Commit `docs: prompts para imagens do site`.

### Task 11: Revisão final e preparação do deploy

- [ ] **Step 1:** Agente `impeccable-finish-reviewer` contra a spec e o modelo; aplicar correções materiais.
- [ ] **Step 2:** Agente `impeccable-documenter` → `frontend-public/DESIGN.md`.
- [ ] **Step 3:** `npm test` (backend e site) e `npm run build` (frontend, frontend-public, `tsc` backend) → tudo verde.
- [ ] **Step 4:** Coolify (somente leitura via MCP): identificar como o `frontend-public` é servido e o que falta para fallback SPA (`/protocolos/*` → `index.html`). Relatar e **pedir confirmação** antes de alterar config, rodar migração/seed em produção ou fazer deploy.
- [ ] **Step 5:** Commit `chore: design doc e ajustes finais`.
