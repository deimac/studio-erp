import { MapPin, ExternalLink, MessageCircle } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5543998468294?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20sess%C3%A3o';
const MAPS_URL = 'https://www.google.com/maps/search/Maring%C3%A1+PR';

export default function Localizacao() {
    return (
        <section
            id="localizacao"
            className="relative section-pad bg-section-offwhite"
        >
            <div className="container-page">
                {/* Section header */}
                <div className="text-center mb-12 lg:mb-14 animate-fade-in-up">
                    <p className="eyebrow mb-4 text-gold-accent">Venha me visitar</p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-on-light">
                        Localização
                    </h2>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                    {/* Info */}
                    <div className="flex-1 max-w-md text-center lg:text-left animate-fade-in-up">
                        <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-gold-accent" />
                            </div>
                            <div>
                                <p className="font-serif text-lg font-semibold text-on-light">
                                    Maringá, Paraná
                                </p>
                            </div>
                        </div>

                        <p className="text-base leading-relaxed mb-8 text-on-light-muted">
                            {/* PLACEHOLDER: Adicione endereço completo, bairro e referência quando disponível. */}
                            Endereço completo será adicionado em breve.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <a
                                href={MAPS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="loc-btn-maps"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Abrir no Google Maps
                            </a>

                            <a
                                href={WHATSAPP_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="loc-btn-whatsapp"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Agendar pelo WhatsApp
                            </a>
                        </div>
                    </div>

                    {/* Map embed */}
                    <div className="flex-1 w-full max-w-lg animate-fade-in-up animate-delay-200">
                        <div className="relative rounded-xl overflow-hidden border border-gold/20 map-container">
                            <iframe
                                title="Localização — Maringá, PR"
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d116747.05509329779!2d-51.99879!3d-23.42067!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ecd6bc74109843%3A0x7f9fecca67c22a2!2sMaring%C3%A1%20-%20PR!5e0!3m2!1spt-BR!2sbr!4v1700000000000"
                                className="absolute inset-0 w-full h-full map-iframe"
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
