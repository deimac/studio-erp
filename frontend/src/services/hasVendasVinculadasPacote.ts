export async function hasVendasVinculadasPacote(pacoteId: number, trpcClient: any): Promise<boolean> {
    return await trpcClient.vendas.hasVinculoPacote.query({ id_pacote: pacoteId });
}
