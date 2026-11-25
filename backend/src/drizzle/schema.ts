import {
    boolean as dbBoolean,
    date,
    datetime,
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
    /** O que fazer com a sessão do pacote quando o cliente falta. */
    falta_regra: mysqlEnum('falta_regra', ['DESCONTAR', 'DEVOLVER', 'PERGUNTAR']).notNull().default('PERGUNTAR'),
    /** Cada profissional define a própria regra de falta. */
    falta_por_profissional: dbBoolean('falta_por_profissional').notNull().default(false),
    /** CLINICA: o admin vê os dados de todos. INDIVIDUAL: cada um vê só o seu (agenda mostra "Ocupado"). */
    modo_trabalho: mysqlEnum('modo_trabalho', ['CLINICA', 'INDIVIDUAL']).notNull().default('CLINICA'),
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
        cor: varchar('cor', { length: 20 }),
        telefone: varchar('telefone', { length: 20 }),
        intervalo_agenda_min: int('intervalo_agenda_min').notNull().default(30),
        /** Divide o espaço com os demais: horário ocupado por um bloqueia o grupo. */
        agenda_compartilhada: dbBoolean('agenda_compartilhada').notNull().default(true),
        /** Profissional usa os serviços/técnicas da clínica (decisão do admin). */
        ve_servicos_clinica: dbBoolean('ve_servicos_clinica').notNull().default(false),
        /** Regra de falta do profissional (quando a clínica deixa cada um definir). */
        falta_regra: mysqlEnum('falta_regra', ['DESCONTAR', 'DEVOLVER', 'PERGUNTAR']),
        /** Atalhos da barra do celular, separados por vírgula (vazio = padrão). */
        atalhos_celular: varchar('atalhos_celular', { length: 200 }),
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

/** Quais profissionais atendem cada pessoa: o profissional só vê as pessoas dele. */
export const pessoaProfissionais = mysqlTable(
    'pessoa_profissionais',
    {
        id_pessoa: int('id_pessoa')
            .notNull()
            .references(() => pessoas.id, { onDelete: 'cascade' }),
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id, { onDelete: 'cascade' }),
        created_at: timestamp('created_at').defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.id_pessoa, t.id_profissional] }),
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
    // Modalidade dentro de um protocolo (site público)
    id_protocolo: int('id_protocolo').references(() => protocolos.id, { onDelete: 'set null' }),
    nome_modalidade: varchar('nome_modalidade', { length: 150 }),
    regioes: text('regioes'), // JSON string[]
    ordem_modalidade: int('ordem_modalidade').notNull().default(0),
    /** Dono: serviço próprio de um profissional (nunca vai ao site). NULL = serviço da clínica. */
    id_profissional: int('id_profissional'),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Protocolos  (agrupam serviços/modalidades para o site público)
   ========================================================================= */
export const protocolos = mysqlTable('protocolos', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    subtitulo: varchar('subtitulo', { length: 255 }),
    descricao: text('descricao'),
    inclui: text('inclui'), // JSON string[]
    beneficios: text('beneficios'), // JSON string[]
    /** Técnicas dos serviços que esta página não mostra em "O que inclui" (JSON number[]). */
    tecnicas_ocultas: text('tecnicas_ocultas'),
    aviso: text('aviso'),
    frase_final: varchar('frase_final', { length: 255 }),
    icone: varchar('icone', { length: 50 }),
    imagem_url: varchar('imagem_url', { length: 500 }),
    ordem: int('ordem').notNull().default(0),
    permite_vale_presente: dbBoolean('permite_vale_presente').notNull().default(false),
    ativo: dbBoolean('ativo').notNull().default(true),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

/* =========================================================================
   Site config  (chave/valor: imagens e textos globais do site público)
   ========================================================================= */
export const siteConfig = mysqlTable('site_config', {
    chave: varchar('chave', { length: 100 }).primaryKey(),
    valor: text('valor'),
});

export const SITE_CONFIG_CHAVES = ['hero_imagem_url', 'sobre_imagem_url', 'hero_titulo', 'hero_subtitulo'] as const;

/* =========================================================================
   Técnicas  +  servico_tecnica (N:N)
   ========================================================================= */
export const tecnicas = mysqlTable('tecnicas', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 255 }).notNull(),
    /** Dono: técnica própria de um profissional. NULL = da clínica. */
    id_profissional: int('id_profissional'),
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
    /** TECNICA (aparece em "Técnicas aplicadas") ou BENEFICIO (em "Benefícios"). */
    tipo: varchar('tipo', { length: 20 }).notNull().default('TECNICA'),
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
        /** 1ª forma da venda; NULL = a receber, forma definida na baixa. */
        id_forma_pagamento: int('id_forma_pagamento').references(() => formasPagamento.id),
        id_unidade: int('id_unidade')
            .notNull()
            .references(() => unidades.id),
        quantidade_sessoes: int('quantidade_sessoes').notNull(),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
        data_venda: date('data_venda').notNull(),
        quantidade_parcelas: int('quantidade_parcelas').notNull().default(1),
        observacao: text('observacao'),
        status: mysqlEnum('status', ['ATIVA', 'ENCERRADA']).notNull().default('ATIVA'),
        /** Quem vendeu (dono da venda). NULL = legado, só o admin vê. */
        id_profissional: int('id_profissional'),
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

/** Itens da venda: cada serviço avulso ou pacote vendido, com as sessões e o valor dele. */
export const vendaItens = mysqlTable(
    'venda_itens',
    {
        id: serial('id').primaryKey(),
        id_venda: int('id_venda').notNull().references(() => vendas.id, { onDelete: 'cascade' }),
        id_servico: int('id_servico').references(() => servicos.id),
        id_pacote: int('id_pacote').references(() => pacotes.id),
        /** Item livre (sem serviço/pacote cadastrado). */
        descricao: varchar('descricao', { length: 120 }),
        quantidade_sessoes: int('quantidade_sessoes').notNull(),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
        created_at: timestamp('created_at').defaultNow(),
    },
    (t) => ({
        vendaIdx: index('idx_vi_venda').on(t.id_venda),
    }),
);

/** Itens de venda usados por um atendimento (cada um desconta 1 sessão). */
export const atendimentoItens = mysqlTable(
    'atendimento_itens',
    {
        id_atendimento: int('id_atendimento').notNull(),
        id_venda_item: int('id_venda_item').notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.id_atendimento, t.id_venda_item] }),
        itemIdx: index('idx_ai_item').on(t.id_venda_item),
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
        /** Dono do lançamento. NULL = legado, só o admin vê. */
        id_profissional: int('id_profissional'),
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
export const STATUS_ATENDIMENTO = ['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU'] as const;

export const atendimentos = mysqlTable(
    'atendimentos',
    {
        id: serial('id').primaryKey(),
        id_unidade: int('id_unidade').notNull().references(() => unidades.id),
        id_pessoa: int('id_pessoa').notNull().references(() => pessoas.id),
        // Venda/pacote é opcional: quando presente, o atendimento consome uma sessão dela
        id_venda: int('id_venda').references(() => vendas.id, { onDelete: 'cascade' }),
        /** Item da venda do qual o atendimento consome a sessão. */
        id_venda_item: int('id_venda_item'),
        /** Falta que consumiu a sessão do pacote. */
        falta_consome: dbBoolean('falta_consome').notNull().default(false),
        /** Atendimento livre (sem serviço cadastrado): título, duração e a venda dele. */
        titulo_extra: varchar('titulo_extra', { length: 120 }),
        duracao_extra: int('duracao_extra'),
        id_venda_extra: int('id_venda_extra'),
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id),
        id_sala: int('id_sala').references(() => salas.id, { onDelete: 'set null' }),
        id_recorrencia: int('id_recorrencia').references(() => agendaRecorrencias.id, { onDelete: 'set null' }),
        data: date('data').notNull(),
        hora_inicio: time('hora_inicio').notNull(),
        hora_fim: time('hora_fim').notNull(),
        status: mysqlEnum('status', STATUS_ATENDIMENTO).notNull(),
        observacoes: text('observacoes'),
        criado_por: int('criado_por'),
        confirmado_em: timestamp('confirmado_em'),
        lembrete_enviado_em: timestamp('lembrete_enviado_em'),
        motivo_cancelamento: varchar('motivo_cancelamento', { length: 255 }),
        created_at: timestamp('created_at').defaultNow(),
        updated_at: timestamp('updated_at').defaultNow(),
    },
    (t) => ({
        vendaIdx: index('idx_atendimentos_id_venda').on(t.id_venda),
        profIdx: index('fk_atendimento_profissional').on(t.id_profissional),
        profDataIdx: index('idx_atend_prof_data').on(t.id_profissional, t.data),
        salaDataIdx: index('idx_atend_sala_data').on(t.id_sala, t.data),
        unidadeDataIdx: index('idx_atend_unidade_data').on(t.id_unidade, t.data),
        pessoaIdx: index('idx_atend_pessoa').on(t.id_pessoa),
    }),
);

export const atendimentoServicos = mysqlTable(
    'atendimento_servicos',
    {
        id_atendimento: int('id_atendimento')
            .notNull()
            .references(() => atendimentos.id, { onDelete: 'cascade' }),
        id_servico: int('id_servico')
            .notNull()
            .references(() => servicos.id),
        duracao_minutos: int('duracao_minutos').notNull(),
        valor: decimal('valor', { precision: 10, scale: 2 }).notNull().default('0.00'),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.id_atendimento, t.id_servico] }),
    }),
);

/* =========================================================================
   Agenda: salas, expediente, serviços por profissional, bloqueios, recorrências
   ========================================================================= */
export const salas = mysqlTable('salas', {
    id: serial('id').primaryKey(),
    id_unidade: int('id_unidade').notNull().references(() => unidades.id),
    nome: varchar('nome', { length: 100 }).notNull(),
    cor: varchar('cor', { length: 20 }),
    ordem: int('ordem').notNull().default(0),
    ativo: dbBoolean('ativo').notNull().default(true),
    created_at: timestamp('created_at').defaultNow(),
    updated_at: timestamp('updated_at').defaultNow(),
});

export const profissionalHorarios = mysqlTable(
    'profissional_horarios',
    {
        id: serial('id').primaryKey(),
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id, { onDelete: 'cascade' }),
        dia_semana: int('dia_semana').notNull(), // 0 = domingo … 6 = sábado
        hora_inicio: time('hora_inicio').notNull(),
        hora_fim: time('hora_fim').notNull(),
    },
    (t) => ({
        profIdx: index('idx_ph_profissional').on(t.id_profissional, t.dia_semana),
    }),
);

export const profissionalServicos = mysqlTable(
    'profissional_servicos',
    {
        id_profissional: int('id_profissional')
            .notNull()
            .references(() => usuarios.id, { onDelete: 'cascade' }),
        id_servico: int('id_servico')
            .notNull()
            .references(() => servicos.id, { onDelete: 'cascade' }),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.id_profissional, t.id_servico] }),
    }),
);

/** Sem profissional e sem sala = clínica inteira fechada (ex.: feriado). */
export const agendaBloqueios = mysqlTable(
    'agenda_bloqueios',
    {
        id: serial('id').primaryKey(),
        id_unidade: int('id_unidade').notNull().references(() => unidades.id),
        id_profissional: int('id_profissional').references(() => usuarios.id, { onDelete: 'cascade' }),
        id_sala: int('id_sala').references(() => salas.id, { onDelete: 'cascade' }),
        inicio: datetime('inicio', { mode: 'string' }).notNull(),
        fim: datetime('fim', { mode: 'string' }).notNull(),
        motivo: varchar('motivo', { length: 255 }),
        criado_por: int('criado_por'),
        created_at: timestamp('created_at').defaultNow(),
    },
    (t) => ({
        periodoIdx: index('idx_bloqueios_periodo').on(t.id_unidade, t.inicio, t.fim),
    }),
);

/** Feriados da cidade/estado cadastrados pela clínica (os nacionais são calculados). ano null = todo ano. */
export const feriados = mysqlTable('feriados', {
    id: serial('id').primaryKey(),
    id_unidade: int('id_unidade').notNull(),
    dia: int('dia').notNull(),
    mes: int('mes').notNull(),
    ano: int('ano'),
    nome: varchar('nome', { length: 120 }).notNull(),
    created_at: timestamp('created_at').defaultNow(),
});

export const agendaRecorrencias = mysqlTable('agenda_recorrencias', {
    id: serial('id').primaryKey(),
    intervalo_semanas: int('intervalo_semanas').notNull().default(1),
    quantidade: int('quantidade').notNull(),
    criado_por: int('criado_por'),
    created_at: timestamp('created_at').defaultNow(),
});

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
        /** Forma de pagamento desta parcela (venda pode combinar Pix, cartão…). */
        id_forma_pagamento: int('id_forma_pagamento'),
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

export const servicosRelations = relations(servicos, ({ one, many }) => ({
    servicoTecnicas: many(servicoTecnica),
    pacotes: many(pacotes),
    protocolo: one(protocolos, { fields: [servicos.id_protocolo], references: [protocolos.id] }),
}));

export const protocolosRelations = relations(protocolos, ({ many }) => ({
    servicos: many(servicos),
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

export const atendimentosRelations = relations(atendimentos, ({ one, many }) => ({
    venda: one(vendas, { fields: [atendimentos.id_venda], references: [vendas.id] }),
    pessoa: one(pessoas, { fields: [atendimentos.id_pessoa], references: [pessoas.id] }),
    profissional: one(usuarios, { fields: [atendimentos.id_profissional], references: [usuarios.id] }),
    sala: one(salas, { fields: [atendimentos.id_sala], references: [salas.id] }),
    servicos: many(atendimentoServicos),
}));

export const atendimentoServicosRelations = relations(atendimentoServicos, ({ one }) => ({
    atendimento: one(atendimentos, { fields: [atendimentoServicos.id_atendimento], references: [atendimentos.id] }),
    servico: one(servicos, { fields: [atendimentoServicos.id_servico], references: [servicos.id] }),
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

export type Sala = InferSelectModel<typeof salas>;
export type ProfissionalHorario = InferSelectModel<typeof profissionalHorarios>;
export type AgendaBloqueio = InferSelectModel<typeof agendaBloqueios>;
export type AtendimentoServico = InferSelectModel<typeof atendimentoServicos>;
