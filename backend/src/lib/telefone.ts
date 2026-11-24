import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Telefone em formato internacional (+5511999990000). Aceita número com "+"
 * (qualquer país) ou só dígitos brasileiros (DDD + número). Vazio → null.
 * Número inválido → undefined (quem chama decide o erro).
 */
export function normalizarTelefone(valor: string | null | undefined): string | null | undefined {
    const bruto = (valor ?? '').trim();
    if (!bruto) return null;
    const digitos = bruto.replace(/\D/g, '');
    const texto = bruto.startsWith('+') ? `+${digitos}` : digitos.length > 11 && digitos.startsWith('55') ? `+${digitos}` : digitos;
    const n = parsePhoneNumberFromString(texto, 'BR');
    if (!n || !n.isPossible()) return undefined;
    return n.number;
}

/** Dígitos para o wa.me (com código do país). */
export function telefoneWhatsApp(valor: string | null | undefined): string | null {
    const n = normalizarTelefone(valor);
    return n ? n.replace('+', '') : null;
}
