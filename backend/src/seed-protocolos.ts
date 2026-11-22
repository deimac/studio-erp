import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db, pool } from './config/db';
import { pacotes, protocolos, servicos } from './drizzle/schema';

/**
 * Cadastra/atualiza os 6 protocolos do PDF "Protocolo estética Tayna".
 * Idempotente: protocolo casado por slug, modalidade por (id_protocolo, nome_modalidade),
 * pacote por (id_servico, quantidade_sessoes). Exige --yes para gravar.
 */

type Modalidade = {
    nome: string;
    duracao: number;
    valor: number;
    regioes?: string[];
    pacotes?: Array<[sessoes: number, valor: number]>;
};

type ProtocoloSeed = {
    slug: string;
    nome: string;
    subtitulo: string;
    descricao: string;
    inclui: string[];
    beneficios: string[];
    aviso?: string;
    frase_final?: string;
    icone: string;
    permite_vale_presente?: boolean;
    modalidades: Modalidade[];
};

const PACOTES_60: Array<[number, number]> = [
    [4, 560],
    [8, 1040],
];
const PACOTES_90: Array<[number, number]> = [
    [4, 760],
    [8, 1440],
];

const DADOS: ProtocoloSeed[] = [
    {
        slug: 'metodo-ts',
        nome: 'Método TS',
        subtitulo: 'Três técnicas, um cuidado corporal completo.',
        descricao:
            'Um método exclusivo que combina drenagem linfática, liberação miofascial e massagem modeladora em uma única sessão.\n\nO atendimento é personalizado conforme as necessidades e os objetivos de cada cliente, com foco no cuidado corporal, na sensação de leveza e no contorno das regiões trabalhadas.',
        inclui: ['Drenagem linfática manual.', 'Liberação miofascial.', 'Massagem modeladora.', 'Técnicas adaptadas às regiões escolhidas.'],
        beneficios: [],
        aviso:
            'As técnicas e a intensidade são adaptadas à avaliação individual. O método não garante perda de gordura ou redução de medidas e não substitui cuidados de saúde quando necessários.',
        icone: 'Sparkles',
        modalidades: [
            { nome: 'Foco Regional', duracao: 60, valor: 150, regioes: ['Abdômen, cintura e costas.', 'Pernas.'], pacotes: PACOTES_60 },
            {
                nome: 'Corpo Integral',
                duracao: 90,
                valor: 200,
                regioes: ['Abdômen e cintura.', 'Costas.', 'Braços.', 'Coxas.', 'Glúteos.'],
                pacotes: PACOTES_90,
            },
        ],
    },
    {
        slug: 'lipedema',
        nome: 'Cuidado para Lipedema',
        subtitulo: 'Leveza, conforto e cuidado individualizado.',
        descricao:
            'Um atendimento manual personalizado para pessoas com diagnóstico de lipedema, com foco no conforto corporal e no auxílio ao manejo de sintomas como inchaço, sensação de peso e desconforto.\n\nCombina drenagem linfática manual com técnicas suaves de liberação miofascial, respeitando a sensibilidade e as necessidades de cada corpo.',
        inclui: [
            'Drenagem linfática manual.',
            'Liberação miofascial suave, quando indicada.',
            'Manobras adaptadas às regiões afetadas.',
            'Atendimento individualizado para pernas, braços ou corpo integral.',
        ],
        beneficios: [
            'Auxílio no manejo do inchaço, quando presente.',
            'Alívio da sensação de peso e desconforto.',
            'Sensação de leveza e bem-estar.',
            'Promoção de conforto corporal.',
        ],
        aviso:
            'O atendimento é complementar ao acompanhamento médico e multiprofissional. Não cura o lipedema nem substitui tratamentos de saúde. A realização depende de avaliação prévia e condições clínicas adequadas.',
        icone: 'Feather',
        modalidades: [
            { nome: 'Pernas', duracao: 60, valor: 150, pacotes: PACOTES_60 },
            { nome: 'Braços', duracao: 60, valor: 150, pacotes: PACOTES_60 },
            { nome: 'Corpo Integral', duracao: 90, valor: 200, pacotes: PACOTES_90 },
        ],
    },
    {
        slug: 'alivio-terapeutico',
        nome: 'Alívio Terapêutico',
        subtitulo: 'Menos tensão, mais liberdade de movimento.',
        descricao:
            'Um atendimento terapêutico personalizado, desenvolvido para aliviar tensões musculares, trabalhar pontos de desconforto e promover maior conforto corporal.\n\nCombina diferentes técnicas manuais, selecionadas conforme a necessidade de cada cliente.',
        inclui: [
            'Liberação miofascial.',
            'Ventosaterapia.',
            'Alongamentos terapêuticos.',
            'Liberação de pontos-gatilho.',
            'Técnicas adaptadas à avaliação individual.',
        ],
        beneficios: [],
        aviso:
            'As técnicas são escolhidas conforme a avaliação, respeitando os limites e a sensibilidade de cada pessoa. O atendimento não substitui avaliação ou tratamento médico e odontológico quando necessários.',
        frase_final:
            'Os pacotes oferecem condições especiais para a continuidade dos cuidados, com técnicas ajustadas conforme a necessidade de cada sessão.',
        icone: 'HandHeart',
        modalidades: [
            {
                nome: 'Foco Regional',
                duracao: 60,
                valor: 150,
                regioes: [
                    'Pescoço e cervical.',
                    'Ombros e trapézio.',
                    'Costas e lombar.',
                    'Mandíbula, como cuidado complementar para tensões associadas ao bruxismo.',
                ],
                pacotes: PACOTES_60,
            },
            {
                nome: 'Múltiplas Regiões',
                duracao: 90,
                valor: 200,
                regioes: ['Atendimento personalizado para trabalhar diferentes regiões de tensão e desconforto muscular na mesma sessão.'],
                pacotes: PACOTES_90,
            },
        ],
    },
    {
        slug: 'drenagem-linfatica',
        nome: 'Drenagem Linfática Corporal',
        subtitulo: 'Leveza, cuidado e bem-estar.',
        descricao:
            'Uma técnica manual realizada com movimentos suaves, lentos e rítmicos, que auxilia o sistema linfático e contribui para o manejo de edemas e da sensação de inchaço.\n\nUm atendimento corporal que também proporciona relaxamento e uma agradável sensação de leveza.',
        inclui: [
            'Drenagem linfática manual no corpo todo.',
            'Manobras suaves e rítmicas.',
            'Atendimento personalizado conforme as necessidades da cliente.',
            'Não inclui drenagem facial.',
        ],
        beneficios: [
            'Auxílio no manejo da retenção de líquidos e do inchaço.',
            'Alívio da sensação de peso corporal.',
            'Sensação de leveza e conforto.',
            'Promoção do relaxamento e bem-estar.',
        ],
        frase_final: 'Um cuidado delicado para proporcionar mais leveza e bem-estar ao seu corpo.',
        icone: 'Droplets',
        modalidades: [{ nome: 'Corpo todo', duracao: 90, valor: 190 }],
    },
    {
        slug: 'toque-sereno',
        nome: 'Toque Sereno',
        subtitulo: 'Uma experiência de relaxamento profundo.',
        descricao:
            'Uma massagem totalmente relaxante, criada para proporcionar uma pausa na rotina e momentos de tranquilidade e bem-estar.\n\nCombina movimentos suaves, lentos e envolventes com aromaterapia e óleos para massagem, tornando a experiência ainda mais especial.',
        inclui: [
            'Massagem corporal relaxante.',
            'Aromaterapia.',
            'Massagem no couro cabeludo.',
            'Massagem nos pés.',
            'Ambiente com música e iluminação aconchegantes.',
        ],
        beneficios: [
            'Relaxamento físico e mental.',
            'Alívio de tensões do dia a dia.',
            'Sensação de tranquilidade e leveza.',
            'Promoção do bem-estar e autocuidado.',
        ],
        frase_final: 'Uma pausa para você, seu corpo e sua tranquilidade.',
        icone: 'Flower2',
        modalidades: [{ nome: 'Sessão relaxante', duracao: 60, valor: 160 }],
    },
    {
        slug: 'ritual-de-pausa',
        nome: 'Ritual de Pausa',
        subtitulo: 'Relaxamento terapêutico da cabeça aos pés.',
        descricao:
            'Uma experiência de cuidado e bem-estar que combina diferentes técnicas manuais para aliviar as tensões do cotidiano, proporcionar conforto e promover relaxamento físico e mental.\n\nUm momento especial para desacelerar e dedicar atenção ao próprio corpo.',
        inclui: [
            'Chá de boas-vindas.',
            'Escalda-pés com sais e ervas aromáticas.',
            'Esfoliação e hidratação dos pés.',
            'Massagem relaxante nos pés.',
            'Massagem facial.',
            'Massagem craniana.',
            'Massagem relaxante na cervical e no trapézio.',
        ],
        beneficios: [
            'Sensação de relaxamento físico e mental.',
            'Alívio de tensões na cervical e no trapézio.',
            'Sensação de conforto e bem-estar.',
            'Momento de autocuidado e tranquilidade.',
            'Relaxamento da musculatura facial e do couro cabeludo.',
        ],
        frase_final: 'Uma pausa na rotina, um carinho em cada detalhe.',
        icone: 'Leaf',
        permite_vale_presente: true,
        modalidades: [{ nome: 'Da cabeça aos pés', duracao: 80, valor: 190 }],
    },
];

async function main() {
    console.log(`Banco: ${process.env.DB_HOST} / ${process.env.DB_NAME}`);
    if (!process.argv.includes('--yes')) {
        console.log(`Vai cadastrar/atualizar ${DADOS.length} protocolos. Rode com --yes para gravar.`);
        return;
    }

    for (const [ordem, d] of DADOS.entries()) {
        const valores = {
            nome: d.nome,
            subtitulo: d.subtitulo,
            descricao: d.descricao,
            inclui: JSON.stringify(d.inclui),
            beneficios: JSON.stringify(d.beneficios),
            aviso: d.aviso ?? null,
            frase_final: d.frase_final ?? null,
            icone: d.icone,
            ordem,
            permite_vale_presente: d.permite_vale_presente ?? false,
        };

        let [protocolo] = await db.select({ id: protocolos.id }).from(protocolos).where(eq(protocolos.slug, d.slug)).limit(1);
        if (protocolo) {
            await db.update(protocolos).set({ ...valores, updated_at: new Date() }).where(eq(protocolos.id, protocolo.id));
        } else {
            const [novo] = await db.insert(protocolos).values({ ...valores, slug: d.slug }).$returningId();
            protocolo = novo;
        }

        for (const [ordemModalidade, m] of d.modalidades.entries()) {
            const nomeServico = `${d.nome} – ${m.nome}`;
            let [servico] = await db
                .select({ id: servicos.id })
                .from(servicos)
                .where(and(eq(servicos.id_protocolo, protocolo.id), eq(servicos.nome_modalidade, m.nome)))
                .limit(1);
            const dadosServico = {
                nome: nomeServico,
                duracao_minutos: m.duracao,
                valor: m.valor.toFixed(2),
                regioes: m.regioes ? JSON.stringify(m.regioes) : null,
                ordem_modalidade: ordemModalidade,
            };
            if (servico) {
                await db.update(servicos).set({ ...dadosServico, updated_at: new Date() }).where(eq(servicos.id, servico.id));
            } else {
                const [novo] = await db
                    .insert(servicos)
                    .values({ ...dadosServico, id_protocolo: protocolo.id, nome_modalidade: m.nome, ativo: true, gera_credito: true })
                    .$returningId();
                servico = novo;
            }

            for (const [sessoes, total] of m.pacotes ?? []) {
                const [pacote] = await db
                    .select({ id: pacotes.id })
                    .from(pacotes)
                    .where(and(eq(pacotes.id_servico, servico.id), eq(pacotes.quantidade_sessoes, sessoes)))
                    .limit(1);
                const dadosPacote = { nome: `${nomeServico} – ${sessoes} sessões`, valor_total: total.toFixed(2) };
                if (pacote) {
                    await db.update(pacotes).set({ ...dadosPacote, updated_at: new Date() }).where(eq(pacotes.id, pacote.id));
                } else {
                    await db.insert(pacotes).values({ ...dadosPacote, id_servico: servico.id, quantidade_sessoes: sessoes, status: 'ativo' });
                }
            }
        }
        console.log(`✓ ${d.nome}`);
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
