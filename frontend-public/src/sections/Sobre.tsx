import { useState } from 'react';

export default function Sobre() {
    const [imgError, setImgError] = useState(false);

    return (
        <section id="sobre" className="relative section-pad bg-section-offwhite">
            <div className="container-page">
                <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
                    {/* Image — left */}
                    <div className="flex-1 flex justify-center lg:justify-start animate-fade-in-up">
                        <div className="relative">
                            {/* Gold accent lines */}
                            <div className="absolute -top-4 -left-4 w-24 h-24 border-t border-l border-gold/40 rounded-tl-xl" />
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b border-r border-gold/40 rounded-br-xl" />

                            <div className="relative w-[360px] h-[460px] rounded-xl overflow-hidden bg-navy-light">
                                {!imgError ? (
                                    <img
                                        src="/images/tayna_sobre.png"
                                        alt="Tayna Santos"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                        onError={() => setImgError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
                                        <div className="w-16 h-16 rounded-full border border-gold/30 flex items-center justify-center mb-4">
                                            <span className="font-serif text-gold text-2xl">TS</span>
                                        </div>
                                        <p className="text-text-muted text-sm">Foto profissional</p>
                                        <p className="text-text-muted/50 text-xs mt-1">360 × 460 px</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Text — right */}
                    <div className="flex-1 max-w-lg animate-fade-in-up animate-delay-200">
                        <p className="eyebrow text-gold-accent mb-4">
                            Sobre mim
                        </p>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold leading-[1.1] mb-6 text-on-light"
                        >
                            Tayna{' '}
                            <span className="text-gold-accent">Santos</span>
                        </h2>

                        <div className="w-16 hairline-gold mb-7" />

                        <p className="lead mb-8 text-on-light"
                        >
                            Com 4 anos de experiência no ramo de massoterapia, sou apaixonada
                            por cuidar das pessoas e proporcionar momentos de bem-estar e
                            autoestima.
                        </p>

                        <div className="mt-10 space-y-6">
                            <div>
                                <p className="text-base sm:text-lg leading-relaxed text-on-light">
                                    <span className="text-gold-accent font-semibold">
                                        Técnica em Estética:
                                    </span>
                                </p>
                                <p className="mt-1 text-sm sm:text-base leading-relaxed text-on-light-muted">
                                    Formação profissional em técnicas estéticas avançadas
                                </p>
                            </div>

                            <div>
                                <p className="text-base sm:text-lg leading-relaxed text-on-light">
                                    <span className="text-gold-accent font-semibold">
                                        Biomedicina com Foco em Estética Avançada:
                                    </span>
                                </p>
                                <p className="mt-1 text-sm sm:text-base leading-relaxed text-on-light-muted">
                                    Atualmente cursando para aprofundar conhecimentos
                                </p>
                            </div>

                            <div>
                                <p className="text-base sm:text-lg leading-relaxed text-on-light">
                                    <span className="text-gold-accent font-semibold">
                                        Paixão pelo Bem-estar:
                                    </span>
                                </p>
                                <p className="mt-1 text-sm sm:text-base leading-relaxed text-on-light-muted">
                                    Dedicada a transformar momentos em experiências de conexão
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
