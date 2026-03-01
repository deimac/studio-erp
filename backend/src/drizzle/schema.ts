import {
    boolean as dbBoolean,
    date,
    decimal,
    index,
    int,
    mysqlEnum,
    mysqlTable,
    primaryKey,
    serial,
    text,
    time,
    timestamp,
    varchar,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

/* =========================================================================
   Unidades
   ========================================================================= */
export const unidades = mysqlTable('unidades', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 150 }).notNull(),
    ativo: dbBoolean('ativo').default(true),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Usuários
   ========================================================================= */
export const usuarios = mysqlTable(
    'usuarios',
    {
        id: serial('id').primaryKey(),
        id_unidade: int('unidade_id').notNull().references(() => unidades.id),
        nome: varchar('nome', { length: 150 }).notNull(),
        email: varchar('email', { length: 150 }).notNull(),
        senha: varchar('senha', { length: 255 }).notNull(),
        perfil: mysqlEnum('perfil', ['ADMIN', 'PROFISSIONAL']).notNull(),
        ativo: dbBoolean('ativo').default(true),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
    },
    (t) => ({
        unidadeIdx: index('fk_usuario_unidade').on(t.id_unidade),
    }),
);

/* =========================================================================
   Pessoas  (substitui clientes — CLIENTE, FORNECEDOR ou AMBOS)
   ========================================================================= */
export const pessoas = mysqlTable(
    'pessoas',
    {
        id: serial('id').primaryKey(),
        id_unidade: int('id_unidade').notNull().references(() => unidades.id),
        tipo: mysqlEnum('tipo', ['CLIENTE', 'FORNECEDOR', 'AMBOS']).notNull(),
        nome: varchar('nome', { length: 150 }).notNull(),
        cpf_cnpj: varchar('cpf_cnpj', { length: 18 }),
        telefone: varchar('telefone', { length: 20 }),
        email: varchar('email', { length: 150 }),
        data_nascimento: date('data_nascimento'),
        observacao: text('observacao'),
        status: mysqlEnum('status', ['ATIVO', 'INATIVO']).notNull().default('ATIVO'),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
        deleted_at: timestamp('deleted_at'),
    },
    (t) => ({
        unidadeIdx: index('idx_pessoas_unidade').on(t.id_unidade),
        nomeIdx: index('idx_pessoas_nome').on(t.nome),
        tipoIdx: index('idx_pessoas_tipo').on(t.tipo),
        statusIdx: index('idx_pessoas_status').on(t.status),
    }),
);

/* =========================================================================
   Serviços
   ========================================================================= */
export const servicos = mysqlTable('servicos', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 150 }).notNull(),
    descricao: text('descricao'),
    imagem_url: varchar('imagem_url', { length: 500 }),
    duracao_minutos: int('duracao_minutos').notNull(),
    valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
    gera_credito: dbBoolean('gera_credito').default(true),
    ativo: dbBoolean('ativo').default(true),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Técnicas  +  servico_tecnica (N:N)
   ========================================================================= */
export const tecnicas = mysqlTable('tecnicas', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 255 }).notNull(),
});

export const servicoTecnica = mysqlTable(
    'servico_tecnica',
    {
        servico_id: int('servico_id')
            .notNull()
            .references(() => servicos.id, { onDelete: 'cascade' }),
        tecnica_id: int('tecnica_id')
            .notNull()
            .references(() => tecnicas.id, { onDelete: 'cascade' }),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.servico_id, t.tecnica_id] }),
    }),
);

/* =========================================================================
   Pacotes  (catálogo de pacotes – não vinculado a cliente)
   ========================================================================= */
export const pacotes = mysqlTable('pacotes', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 255 }).notNull(),
    descricao: text('descricao'),
    id_servico: int('id_servico').references(() => servicos.id, { onDelete: 'set null' }),
    quantidade_sessoes: int('quantidade_sessoes').notNull().default(1),
    valor_total: decimal('valor_total', { precision: 10, scale: 2 }).notNull().default('0.00'),
    status: varchar('status', { length: 50 }).default('ativo'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Vendas  (substitui aquisições — venda de pacote ou serviço)
   ========================================================================= */
export const vendas = mysqlTable(
    'vendas',
    {
        id: serial('id').primaryKey(),
        id_pessoa: int('id_pessoa')
            .notNull()
            .references(() => pessoas.id),
        id_servico: int('id_servico').references(() => servicos.id),
        id_pacote: int('id_pacote').references(() => pacotes.id),
        id_forma_pagamento: int('id_forma_pagamento')
            .notNull()
            .references(() => formasPagamento.id),
        id_unidade: int('id_unidade')
            .notNull()
            .references(() => unidades.id),
        quantidade_sessoes: int('quantidade_sessoes').notNull(),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
        data_venda: date('data_venda').notNull(),
        quantidade_parcelas: int('quantidade_parcelas').notNull().default(1),
        observacao: text('observacao'),
        status: mysqlEnum('status', ['ATIVA', 'ENCERRADA']).notNull().default('ATIVA'),
        motivo_encerramento: varchar('motivo_encerramento', { length: 255 }),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
        deleted_at: timestamp('deleted_at'),
    },
    (t) => ({
        pessoaIdx: index('idx_vendas_pessoa').on(t.id_pessoa),
        unidadeIdx: index('idx_vendas_unidade').on(t.id_unidade),
        dataIdx: index('idx_vendas_data').on(t.data_venda),
        statusIdx: index('idx_vendas_status').on(t.status),
        formaPgtoIdx: index('idx_vendas_forma_pagamento').on(t.id_forma_pagamento),
    }),
);

/* =========================================================================
   Categorias Receitas/Despesas
   ========================================================================= */
export const categoriasReceitasDespesas = mysqlTable(
    'categorias_receitas_despesas',
    {
        id: serial('id').primaryKey(),
        nome: varchar('nome', { length: 150 }).notNull(),
        tipo: mysqlEnum('tipo', ['RECEITA', 'DESPESA']).notNull(),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
    },
    (t) => ({
        tipoIdx: index('idx_tipo').on(t.tipo),
    }),
);

/* =========================================================================
   Receitas/Despesas
   ========================================================================= */
export const receitasDespesas = mysqlTable(
    'receitas_despesas',
    {
        id: serial('id').primaryKey(),
        id_pessoa: int('id_pessoa').references(() => pessoas.id),
        tipo: mysqlEnum('tipo', ['RECEITA', 'DESPESA']).notNull(),
        descricao: varchar('descricao', { length: 255 }).notNull(),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
        data_lancamento: date('data_lancamento').notNull(),
        id_forma_pagamento: int('id_forma_pagamento')
            .notNull()
            .references(() => formasPagamento.id),
        id_categorias_receitas_despesas: int('id_categorias_receitas_despesas')
            .notNull()
            .references(() => categoriasReceitasDespesas.id),
        quantidade_parcelas: int('quantidade_parcelas').notNull().default(1),
        observacao: text('observacao'),
        created_at: timestamp('created_at').defaultNow(),
    },
    (t) => ({
        pessoaIdx: index('idx_rd_pessoa').on(t.id_pessoa),
        formaPgtoIdx: index('fk_rd_forma_pagamento').on(t.id_forma_pagamento),
        categoriaIdx: index('idx_rd_categoria').on(t.id_categorias_receitas_despesas),
        tipoIdx: index('idx_rd_tipo').on(t.tipo),
        dataIdx: index('idx_rd_data').on(t.data_lancamento),
    }),
);

/* =========================================================================
   Agenda Configuração
   ========================================================================= */
export const agendaConfiguracao = mysqlTable(
    'agenda_configuracao',
    {
        id: serial('id').primaryKey(),
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id),
        hora_inicio: time('hora_inicio').notNull(),
        hora_fim: time('hora_fim').notNull(),
        intervalo_minutos: int('intervalo_minutos').notNull(),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
    },
    (t) => ({
        profIdx: index('fk_agenda_profissional').on(t.id_profissional),
    }),
);

/* =========================================================================
   Atendimentos
   ========================================================================= */
export const atendimentos = mysqlTable(
    'atendimentos',
    {
        id: serial('id').primaryKey(),
        id_venda: int('id_venda')
            .notNull()
            .references(() => vendas.id, { onDelete: 'cascade' }),
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id),
        data: date('data').notNull(),
        hora_inicio: time('hora_inicio').notNull(),
        hora_fim: time('hora_fim').notNull(),
        status: mysqlEnum('status', ['AGENDADO', 'REALIZADO', 'CANCELADO', 'FALTOU']).notNull(),
        observacoes: text('observacoes'),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
    },
    (t) => ({
        vendaIdx: index('fk_atendimento_venda').on(t.id_venda),
        profIdx: index('fk_atendimento_profissional').on(t.id_profissional),
    }),
);

/* =========================================================================
   Formas de Pagamento
   ========================================================================= */
export const formasPagamento = mysqlTable('formas_pagamento', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 50 }).notNull(),
    ativo: dbBoolean('ativo').default(true),
    descricao: varchar('descricao', { length: 255 }),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Financeiro  (parcelas de vendas e receitas/despesas)
   ========================================================================= */
export const financeiro = mysqlTable(
    'financeiro',
    {
        id: serial('id').primaryKey(),
        id_venda: int('id_venda').references(() => vendas.id, { onDelete: 'cascade' }),
        id_receita_despesa: int('id_receita_despesa').references(() => receitasDespesas.id, { onDelete: 'cascade' }),
        parcela: int('parcela').notNull().default(1),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
        data_lancamento: date('data_lancamento').notNull(),
        data_vencimento: date('data_vencimento').notNull(),
        data_pagamento: date('data_pagamento'),
        status: mysqlEnum('status', ['PENDENTE', 'PAGO', 'CANCELADO']).notNull().default('PENDENTE'),
        created_at: timestamp('created_at').defaultNow(),
    },
    (t) => ({
        vendaIdx: index('idx_financeiro_venda').on(t.id_venda),
        rdIdx: index('idx_financeiro_rd').on(t.id_receita_despesa),
        vencimentoIdx: index('idx_financeiro_vencimento').on(t.data_vencimento),
        statusIdx: index('idx_financeiro_status').on(t.status),
    }),
);

/* =========================================================================
   Relations
   ========================================================================= */
export const unidadesRelations = relations(unidades, ({ many }) => ({
    usuarios: many(usuarios),
    pessoas: many(pessoas),
    vendas: many(vendas),
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
    unidade: one(unidades, { fields: [usuarios.id_unidade], references: [unidades.id] }),
    agendas: many(agendaConfiguracao),
    atendimentos: many(atendimentos),
}));

export const pessoasRelations = relations(pessoas, ({ one, many }) => ({
    unidade: one(unidades, { fields: [pessoas.id_unidade], references: [unidades.id] }),
    vendas: many(vendas),
}));

export const servicosRelations = relations(servicos, ({ many }) => ({
    servicoTecnicas: many(servicoTecnica),
    pacotes: many(pacotes),
}));

export const tecnicasRelations = relations(tecnicas, ({ many }) => ({
    servicoTecnicas: many(servicoTecnica),
}));

export const servicoTecnicaRelations = relations(servicoTecnica, ({ one }) => ({
    servico: one(servicos, { fields: [servicoTecnica.servico_id], references: [servicos.id] }),
    tecnica: one(tecnicas, { fields: [servicoTecnica.tecnica_id], references: [tecnicas.id] }),
}));

export const pacotesRelations = relations(pacotes, ({ one }) => ({
    servico: one(servicos, { fields: [pacotes.id_servico], references: [servicos.id] }),
}));

export const vendasRelations = relations(vendas, ({ one, many }) => ({
    pessoa: one(pessoas, { fields: [vendas.id_pessoa], references: [pessoas.id] }),
    servico: one(servicos, { fields: [vendas.id_servico], references: [servicos.id] }),
    pacote: one(pacotes, { fields: [vendas.id_pacote], references: [pacotes.id] }),
    formaPagamento: one(formasPagamento, { fields: [vendas.id_forma_pagamento], references: [formasPagamento.id] }),
    unidade: one(unidades, { fields: [vendas.id_unidade], references: [unidades.id] }),
    atendimentos: many(atendimentos),
    financeiro: many(financeiro),
}));

export const categoriasReceitasDespesasRelations = relations(categoriasReceitasDespesas, ({ many }) => ({
    receitasDespesas: many(receitasDespesas),
}));

export const receitasDespesasRelations = relations(receitasDespesas, ({ one, many }) => ({
    pessoa: one(pessoas, { fields: [receitasDespesas.id_pessoa], references: [pessoas.id] }),
    formaPagamento: one(formasPagamento, { fields: [receitasDespesas.id_forma_pagamento], references: [formasPagamento.id] }),
    categoria: one(categoriasReceitasDespesas, { fields: [receitasDespesas.id_categorias_receitas_despesas], references: [categoriasReceitasDespesas.id] }),
    financeiro: many(financeiro),
}));

export const agendaConfiguracaoRelations = relations(agendaConfiguracao, ({ one }) => ({
    profissional: one(usuarios, { fields: [agendaConfiguracao.id_profissional], references: [usuarios.id] }),
}));

export const atendimentosRelations = relations(atendimentos, ({ one }) => ({
    venda: one(vendas, { fields: [atendimentos.id_venda], references: [vendas.id] }),
    profissional: one(usuarios, { fields: [atendimentos.id_profissional], references: [usuarios.id] }),
}));

export const formasPagamentoRelations = relations(formasPagamento, ({ many }) => ({
    financeiro: many(financeiro),
    vendas: many(vendas),
    receitasDespesas: many(receitasDespesas),
}));

export const financeiroRelations = relations(financeiro, ({ one }) => ({
    venda: one(vendas, { fields: [financeiro.id_venda], references: [vendas.id] }),
    receitaDespesa: one(receitasDespesas, { fields: [financeiro.id_receita_despesa], references: [receitasDespesas.id] }),
}));

/* =========================================================================
   Types
   ========================================================================= */
export type Unidade = InferSelectModel<typeof unidades>;
export type NewUnidade = InferInsertModel<typeof unidades>;

export type Usuario = InferSelectModel<typeof usuarios>;
export type NewUsuario = InferInsertModel<typeof usuarios>;

export type Pessoa = InferSelectModel<typeof pessoas>;
export type NewPessoa = InferInsertModel<typeof pessoas>;

export type Servico = InferSelectModel<typeof servicos>;
export type NewServico = InferInsertModel<typeof servicos>;

export type Tecnica = InferSelectModel<typeof tecnicas>;
export type NewTecnica = InferInsertModel<typeof tecnicas>;

export type ServicoTecnica = InferSelectModel<typeof servicoTecnica>;
export type NewServicoTecnica = InferInsertModel<typeof servicoTecnica>;

export type Pacote = InferSelectModel<typeof pacotes>;
export type NewPacote = InferInsertModel<typeof pacotes>;

export type Venda = InferSelectModel<typeof vendas>;
export type NewVenda = InferInsertModel<typeof vendas>;

export type CategoriaReceitaDespesa = InferSelectModel<typeof categoriasReceitasDespesas>;
export type NewCategoriaReceitaDespesa = InferInsertModel<typeof categoriasReceitasDespesas>;

export type ReceitaDespesa = InferSelectModel<typeof receitasDespesas>;
export type NewReceitaDespesa = InferInsertModel<typeof receitasDespesas>;

export type AgendaConfiguracao = InferSelectModel<typeof agendaConfiguracao>;
export type NewAgendaConfiguracao = InferInsertModel<typeof agendaConfiguracao>;

export type Atendimento = InferSelectModel<typeof atendimentos>;
export type NewAtendimento = InferInsertModel<typeof atendimentos>;

export type FormaPagamento = InferSelectModel<typeof formasPagamento>;
export type NewFormaPagamento = InferInsertModel<typeof formasPagamento>;

export type Financeiro = InferSelectModel<typeof financeiro>;
export type NewFinanceiro = InferInsertModel<typeof financeiro>;
