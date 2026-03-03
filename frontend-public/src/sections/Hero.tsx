import * as React from 'react';

const WHATSAPP_URL = 'https://wa.me/5543998468294?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20sess%C3%A3o';

export default function Hero() {
    return (
        <section
            id="inicio"
            className="relative min-h-screen flex items-center overflow-hidden bg-section-navy"
        >
            {/* Subtle radial glow */}
            <div className="absolute inset-0 pointer-events-none hero-glow" />

            <div className="container-page flex flex-col lg:flex-row w-full items-center gap-12 py-28 lg:py-32 lg:gap-20">
                {/* Image — top on mobile, right on desktop */}
                <div className="flex lg:hidden w-full justify-center animate-fade-in-up">
                    <div className="relative">
                        <img
                            src="https://tsmassoterapeuta.com.br/brand/logo_tayna.png"
                            alt="Tayna Santos"
                            className="w-64 h-80 object-contain"
                            loading="eager"
                        />
                    </div>
                </div>

                {/* Text — bottom on mobile, left on desktop */}
                <div className="flex-1 max-w-xl animate-fade-in-up w-full lg:w-auto">
                    <p className="eyebrow text-gold mb-6">
                        Tayna Santos • Massoterapeuta
                    </p>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold leading-[1.05] text-text-light">
                        Uma experiência de cuidados
                        <span className="text-gold"> sofisticados</span>,
                        <br />pensado para você.
                    </h1>

                    <div className="h-6 lg:h-8" aria-hidden="true" />

                    <p className="lead text-text-muted max-w-md">
                        Atendimento personalizado, técnicas especializadas em um ambiente acolhedor —
                        para você relaxar, se recuperar e ter uma verdadeira conexão.
                    </p>

                    <div className="h-5 lg:h-7" aria-hidden="true" />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full sm:w-auto min-w-[240px] items-center justify-center gap-2 rounded-md border-2 border-gold bg-gold px-10 py-4 h-14 text-base font-semibold tracking-wide text-navy whitespace-nowrap transition-all duration-200 hover:bg-gold-light hover:border-gold-light"
                        >
                            Agendar sessão
                        </a>
                        <a
                            href="#servicos"
                            className="inline-flex w-full sm:w-auto min-w-[240px] items-center justify-center gap-2 rounded-md border border-gold/35 bg-white/5 px-10 py-4 h-14 text-base font-semibold tracking-wide text-text-light/90 whitespace-nowrap transition-all duration-200 hover:border-gold/55 hover:bg-white/10 hover:text-text-light"
                        >
                            Conheça os serviços
                        </a>
                    </div>
                </div>

                {/* Image — hidden on mobile, right on desktop */}
                <div className="hidden lg:flex flex-1 justify-end animate-fade-in-up animate-delay-200">
                    <div className="relative">
                        <img
                            src="https://tsmassoterapeuta.com.br/brand/logo_tayna.png"
                            alt="Tayna Santos"
                            className="relative w-[420px] h-[540px] object-contain"
                            loading="eager"
                        />
                    </div>
                </div>
            </div>

            {/* Gold divider at bottom (key point) */}
            <div className="absolute bottom-0 left-0 right-0 divider-gold" />
        </section>
    );
}
