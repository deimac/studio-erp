// Passos para instalar o app no celular. A ilustração de cada passo fica em components/instalar/InstallArt.tsx.

export const APP_NOME = 'Studio ERP';

export type Aparelho = 'ios' | 'android';
export type ArteId = 'ios-browser' | 'ios-share' | 'ios-add' | 'android-browser' | 'android-menu' | 'android-confirm' | 'home';

export interface Passo {
    id: string;
    arte: ArteId;
    titulo: string;
    texto: string;
}

export const NOME_APARELHO: Record<Aparelho, string> = { ios: 'iPhone', android: 'Android' };

export const PASSOS: Record<Aparelho, Passo[]> = {
    ios: [
        { id: 'ios-1', arte: 'ios-browser', titulo: 'Abra no Safari', texto: 'Abra este endereço no Safari, o navegador da bússola azul.' },
        { id: 'ios-2', arte: 'ios-share', titulo: 'Toque em Compartilhar', texto: 'É o botão do quadrado com a seta para cima, na barra de baixo.' },
        { id: 'ios-3', arte: 'ios-add', titulo: 'Adicionar à Tela de Início', texto: 'Role a lista, toque nessa opção e depois em Adicionar.' },
        { id: 'ios-4', arte: 'home', titulo: 'Pronto! Abra pelo ícone', texto: 'O ícone aparece na tela do celular. Toque nele e entre com seu e-mail e senha.' },
    ],
    android: [
        { id: 'android-1', arte: 'android-browser', titulo: 'Abra no Chrome', texto: 'Abra este endereço no Chrome.' },
        { id: 'android-2', arte: 'android-menu', titulo: 'Toque em Instalar', texto: 'Use o botão Instalar agora desta página, ou toque nos 3 pontinhos ⋮ e em Instalar aplicativo.' },
        { id: 'android-3', arte: 'android-confirm', titulo: 'Confirme', texto: 'Toque em Instalar na janela que abrir.' },
        { id: 'android-4', arte: 'home', titulo: 'Pronto! Abra pelo ícone', texto: 'O ícone aparece na tela do celular. Toque nele e entre com seu e-mail e senha.' },
    ],
};

/** Nome sob o ícone da tela inicial: até 12 letras (o resto o aparelho corta). */
export const nomeIcone = (nome: string): string => {
    const limpo = nome.trim() || 'App';
    return limpo.length > 12 ? limpo.slice(0, 12).trim() : limpo;
};
