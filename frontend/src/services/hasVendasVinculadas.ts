export async function hasVendasVinculadas(pessoaId: number, trpcClient: any): Promise<boolean> {
    return await trpcClient.vendas.hasVinculoPessoa.query({ id_pessoa: pessoaId });
}
