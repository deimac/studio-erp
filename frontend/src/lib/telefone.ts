import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Telefone com país. No banco fica em formato internacional (+5511999990000);
 * na tela, Brasil aparece como "(11) 99999-0000" e os outros com o código.
 */

const nomes = (() => {
    try {
        return new Intl.DisplayNames(['pt-BR'], { type: 'region' });
    } catch {
        return null;
    }
})();

/** Bandeira do país (emoji a partir da sigla). */
export function bandeira(pais: string) {
    return pais.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export type Pais = { sigla: CountryCode; nome: string; codigo: string };

/** Todos os países, Brasil primeiro e o resto em ordem alfabética. */
export const PAISES: Pais[] = (() => {
    const lista = getCountries().map((sigla) => ({ sigla, nome: nomes?.of(sigla) ?? sigla, codigo: getCountryCallingCode(sigla) }));
    lista.sort((a, b) => (a.sigla === 'BR' ? -1 : b.sigla === 'BR' ? 1 : a.nome.localeCompare(b.nome, 'pt-BR')));
    return lista;
})();

/** Interpreta o valor salvo (internacional ou só dígitos do Brasil). */
export function lerTelefone(valor: string | null | undefined) {
    const bruto = (valor ?? '').trim();
    if (!bruto) return null;
    const digitos = bruto.replace(/\D/g, '');
    const texto = bruto.startsWith('+') ? `+${digitos}` : digitos.length > 11 && digitos.startsWith('55') ? `+${digitos}` : digitos;
    return parsePhoneNumberFromString(texto, 'BR') ?? null;
}

/** Para mostrar: "(11) 99999-0000" no Brasil; "+351 912 345 678" fora. */
export function formatarTelefone(valor: string | null | undefined): string {
    const n = lerTelefone(valor);
    if (!n) return valor ?? '';
    return n.country === 'BR' ? n.formatNational() : n.formatInternational();
}

/** Link tel: com o número internacional. */
export function linkTelefone(valor: string | null | undefined): string {
    const n = lerTelefone(valor);
    return `tel:${n ? n.number : (valor ?? '').replace(/[^\d+]/g, '')}`;
}

/** Formata enquanto digita (só a parte nacional). */
export function formatarDigitando(pais: CountryCode, nacional: string) {
    return new AsYouType(pais).input(nacional);
}

/** Monta o valor salvo a partir do país e do número digitado. */
export function montarTelefone(pais: CountryCode, nacional: string): string {
    const digitos = nacional.replace(/\D/g, '');
    if (!digitos) return '';
    const n = parsePhoneNumberFromString(digitos, pais);
    return n ? n.number : `+${getCountryCallingCode(pais)}${digitos}`;
}

/** O número tem formato possível para o país? (vazio conta como válido) */
export function telefonePossivel(valor: string | null | undefined): boolean {
    if (!valor) return true;
    return !!lerTelefone(valor)?.isPossible();
}
