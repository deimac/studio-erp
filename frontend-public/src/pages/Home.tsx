import { useEffect } from 'react';
import Hero from '@/sections/Hero';
import Faixa from '@/sections/Faixa';
import PorQueEscolher from '@/sections/PorQueEscolher';
import Protocolos from '@/sections/Protocolos';
import Resultados from '@/sections/Resultados';
import Sobre from '@/sections/Sobre';
import ValePresente from '@/sections/ValePresente';
import FAQ from '@/sections/FAQ';
import { useProtocolos, useSiteConfig } from '@/lib/catalogo';

export default function Home() {
    const { data: protocolos, isError } = useProtocolos();
    const config = useSiteConfig();
    useEffect(() => { document.title = 'Tayna Santos — Massoterapeuta em Maringá'; }, []);
    // Em erro de rede, mostra a página sem os blocos dinâmicos em vez de skeleton eterno.
    const lista = isError ? [] : protocolos;
    const vale = lista?.find((p) => p.permite_vale_presente);
    return (
        <>
            <Hero protocolos={lista} config={config} />
            <Faixa />
            <PorQueEscolher />
            <Protocolos protocolos={lista} />
            <Resultados />
            <Sobre imagem={config.sobre_imagem_url} />
            {(vale || !lista) && <ValePresente protocolo={vale} />}
            <FAQ />
        </>
    );
}
