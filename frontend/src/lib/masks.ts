export function maskCpf(value: string) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
}

export function maskCnpj(value: string) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .slice(0, 18);
}

export function maskTelefone(value: string) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .slice(0, 15);
}

export function maskMoney(value: string) {
    let v = value.replace(/\D/g, '');
    v = v.replace(/^0+/, '');
    if (v.length === 0) return '';
    if (v.length === 1) return '0,0' + v;
    if (v.length === 2) return '0,' + v;
    return v.replace(/(\d+)(\d{2})$/, '$1,$2').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

/** Converte valor mascarado (ex: "1.234,56") para número (ex: 1234.56) */
export function unmaskMoney(value: string): number {
    if (!value) return 0;
    // Remove pontos de milhar e troca vírgula por ponto
    const numeric = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(numeric) || 0;
}
