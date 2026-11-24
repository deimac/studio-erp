import type { ReactNode } from 'react';
import { nomeIcone, type ArteId } from '@/lib/instalar';

// Ilustrações dos passos de instalação: celular desenhado em SVG com o ponto do toque em destaque.
// Cores pelos tokens do tema (globals.css).

const C = {
    muted: 'fill-[hsl(var(--muted))]',
    mutedFg: 'fill-[hsl(var(--muted-foreground))]',
    fg: 'fill-[hsl(var(--foreground))]',
    card: 'fill-[hsl(var(--card))]',
    bg: 'fill-[hsl(var(--background))]',
    primary: 'fill-[hsl(var(--primary))]',
    border: 'stroke-[hsl(var(--border))]',
    ring: 'animate-pulse fill-none stroke-[hsl(var(--primary))]',
};

function Celular({ label, children }: { label: string; children: ReactNode }) {
    return (
        <svg viewBox="0 0 220 280" role="img" aria-label={label} className="mx-auto h-auto w-full max-w-[220px]">
            <rect x="6" y="4" width="208" height="272" rx="30" className={`${C.muted} ${C.border}`} strokeWidth="2" />
            <rect x="16" y="14" width="188" height="252" rx="22" className={C.bg} />
            <rect x="86" y="20" width="48" height="8" rx="4" className={C.muted} />
            {children}
        </svg>
    );
}

const Texto = ({ x, y, children, size = 9, anchor = 'start', bold = false, tone = C.fg }: {
    x: number; y: number; children: ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; tone?: string;
}) => (
    <text x={x} y={y} fontSize={size} textAnchor={anchor} fontWeight={bold ? 700 : 400} className={tone}>{children}</text>
);

const Anel = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
    <circle cx={cx} cy={cy} r={r} className={C.ring} strokeWidth="3" />
);
const Moldura = ({ x, y, w, h, r = 8 }: { x: number; y: number; w: number; h: number; r?: number }) => (
    <rect x={x} y={y} width={w} height={h} rx={r} className={C.ring} strokeWidth="3" />
);

function Linhas() {
    return (
        <g className={C.muted}>
            <rect x="32" y="84" width="120" height="10" rx="5" />
            <rect x="32" y="104" width="156" height="7" rx="3.5" />
            <rect x="32" y="118" width="140" height="7" rx="3.5" />
            <rect x="32" y="132" width="150" height="7" rx="3.5" />
            <rect x="32" y="152" width="156" height="44" rx="8" />
        </g>
    );
}

function BarraEndereco({ host, menu = false }: { host: string; menu?: boolean }) {
    return (
        <g>
            <rect x="26" y="38" width={menu ? 138 : 168} height="24" rx="12" className={C.muted} />
            <rect x="37" y="46" width="7" height="6" rx="1.5" className={C.mutedFg} />
            <Texto x={50} y={54} size={8.5}>{host.length > 22 ? `${host.slice(0, 21)}…` : host}</Texto>
            {menu && (
                <g className={C.fg}>
                    <circle cx="186" cy="44" r="2" /><circle cx="186" cy="51" r="2" /><circle cx="186" cy="58" r="2" />
                </g>
            )}
        </g>
    );
}

function Navegador({ host, android }: { host: string; android: boolean }) {
    return (
        <Celular label={android ? 'Chrome aberto no endereço do sistema' : 'Safari aberto no endereço do sistema'}>
            <BarraEndereco host={host} menu={android} />
            <Moldura x={24} y={36} w={android ? 142 : 172} h={28} r={14} />
            <Linhas />
        </Celular>
    );
}

function IosCompartilhar({ host }: { host: string }) {
    return (
        <Celular label="Botão Compartilhar, na barra de baixo do Safari">
            <BarraEndereco host={host} />
            <Linhas />
            <rect x="16" y="226" width="188" height="40" className={C.card} />
            <line x1="16" y1="226" x2="204" y2="226" className={C.border} />
            <g className="fill-none stroke-[hsl(var(--foreground))]" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M44 240 l-6 6 6 6" />
                <path d="M76 240 l6 6 -6 6" />
                <rect x="104" y="244" width="12" height="12" rx="2" />
                <path d="M110 250 V236 M105 241 L110 236 L115 241" />
                <rect x="146" y="240" width="14" height="12" rx="2" />
                <rect x="178" y="240" width="12" height="12" rx="2" />
            </g>
            <Anel cx={110} cy={246} r={19} />
            <Texto x={110} y={220} size={8.5} anchor="middle" bold tone={C.primary}>Compartilhar</Texto>
        </Celular>
    );
}

function IosAdicionar() {
    const linhas = [
        { y: 138, text: 'Copiar' },
        { y: 170, text: 'Adicionar aos Favoritos' },
    ];
    return (
        <Celular label="Opção Adicionar à Tela de Início na lista de compartilhamento">
            <rect x="16" y="34" width="188" height="232" rx="22" className={`${C.fg} opacity-20`} />
            <rect x="16" y="104" width="188" height="162" rx="22" className={`${C.card} ${C.border}`} />
            <rect x="96" y="110" width="28" height="4" rx="2" className={`${C.mutedFg} opacity-50`} />
            {linhas.map((r) => (
                <g key={r.text}>
                    <Texto x={32} y={r.y + 16} size={9}>{r.text}</Texto>
                    <line x1="28" y1={r.y + 26} x2="192" y2={r.y + 26} className={C.border} />
                </g>
            ))}
            <Texto x={32} y={218} size={9} bold>Adicionar à Tela de Início</Texto>
            <g className="fill-none stroke-[hsl(var(--foreground))]" strokeWidth="1.6" strokeLinecap="round">
                <rect x="168" y="204" width="20" height="20" rx="5" />
                <path d="M178 209 v10 M173 214 h10" />
            </g>
            <Moldura x={22} y={198} w={176} h={34} />
            <Texto x={110} y={254} size={8} anchor="middle" tone={C.mutedFg}>Depois toque em Adicionar</Texto>
        </Celular>
    );
}

function AndroidMenu({ host }: { host: string }) {
    const linhas = [{ y: 90, text: 'Nova guia' }, { y: 114, text: 'Histórico' }, { y: 162, text: 'Configurações' }];
    return (
        <Celular label="Menu do Chrome com a opção Instalar aplicativo">
            <BarraEndereco host={host} menu />
            <Anel cx={186} cy={51} r={12} />
            <Linhas />
            <rect x="90" y="68" width="106" height="116" rx="10" className={`${C.card} ${C.border}`} strokeWidth="1.5" />
            {linhas.map((r) => <Texto key={r.text} x={102} y={r.y} size={8.5}>{r.text}</Texto>)}
            <Texto x={102} y={138} size={8.5} bold>Instalar aplicativo</Texto>
            <Moldura x={94} y={122} w={98} h={22} r={6} />
        </Celular>
    );
}

function Icone({ x, y, size }: { x: number; y: number; size: number }) {
    return <image href="/icons/icon-192.png" x={x} y={y} width={size} height={size} style={{ clipPath: `inset(0 round ${size / 4}px)` }} />;
}

function AndroidConfirmar({ nome }: { nome: string }) {
    return (
        <Celular label="Janela de confirmação da instalação, com o botão Instalar">
            <rect x="16" y="34" width="188" height="232" rx="22" className={`${C.fg} opacity-20`} />
            <rect x="32" y="96" width="156" height="112" rx="14" className={`${C.card} ${C.border}`} strokeWidth="1.5" />
            <Icone x={46} y={110} size={28} />
            <Texto x={82} y={122} size={9} bold>Instalar aplicativo?</Texto>
            <Texto x={82} y={136} size={8} tone={C.mutedFg}>{nomeIcone(nome)}</Texto>
            <Texto x={80} y={192} size={8.5} anchor="middle" tone={C.mutedFg}>Cancelar</Texto>
            <rect x="124" y="176" width="52" height="22" rx="11" className={C.primary} />
            <Texto x={150} y={191} size={9} anchor="middle" bold tone="fill-[hsl(var(--primary-foreground))]">Instalar</Texto>
            <Moldura x={120} y={172} w={60} h={30} r={15} />
        </Celular>
    );
}

function TelaInicial({ nome }: { nome: string }) {
    const cols = [28, 74, 120, 166];
    const linhas = [50, 108, 166];
    return (
        <Celular label={`Ícone do ${nomeIcone(nome)} na tela inicial`}>
            {linhas.map((y, r) => cols.map((x, c) => (r === 1 && c === 2 ? null : (
                <g key={`${r}-${c}`}>
                    <rect x={x} y={y} width="32" height="32" rx="8" className={C.muted} />
                    <rect x={x + 5} y={y + 38} width="22" height="5" rx="2.5" className={C.muted} />
                </g>
            ))))}
            <Icone x={120} y={108} size={32} />
            <Texto x={136} y={152} size={8} anchor="middle" bold>{nomeIcone(nome)}</Texto>
            <Moldura x={113} y={101} w={46} h={60} r={10} />
        </Celular>
    );
}

export function InstallArt({ arte, nome, host }: { arte: ArteId; nome: string; host: string }) {
    switch (arte) {
        case 'ios-browser': return <Navegador host={host} android={false} />;
        case 'ios-share': return <IosCompartilhar host={host} />;
        case 'ios-add': return <IosAdicionar />;
        case 'android-browser': return <Navegador host={host} android />;
        case 'android-menu': return <AndroidMenu host={host} />;
        case 'android-confirm': return <AndroidConfirmar nome={nome} />;
        case 'home': return <TelaInicial nome={nome} />;
    }
}
