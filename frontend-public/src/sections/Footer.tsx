import { Instagram, MessageCircle, MapPin } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5543998468294?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20sess%C3%A3o';
const INSTAGRAM_URL = 'https://www.instagram.com/massoterapeuta_tayna';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="footer-root">
            {/* Linha dourada no topo */}
            <div className="absolute top-0 left-0 right-0 divider-gold" />

            <div className="container-page">
                <div className="footer-grid">

                    {/* Coluna 1 — Logo */}
                    <div className="footer-col-logo">
                        <img
                            src="/brand/logo_tayna.png"
                            alt="Tayna Santos"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = '/brand/logo_branca.png';
                            }}
                        />
                    </div>

                    {/* Coluna 2 — Endereço */}
                    <div className="footer-col-address">
                        <p className="footer-address-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <MapPin style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                            Onde realizamos nossos atendimentos:
                        </p>
                        <div className="footer-address-text">
                            <p>R. Dr. Saulo Porto Virmond, 989</p>
                            <p>Chácara Paulista, Maringá – PR</p>
                            <p>CEP 87005-090</p>
                        </div>
                    </div>

                    {/* Coluna 3 — Social */}
                    <div className="footer-col-social">
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <a
                                href={WHATSAPP_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-social-btn"
                                aria-label="WhatsApp"
                            >
                                <MessageCircle style={{ width: '20px', height: '20px' }} />
                            </a>
                            <a
                                href={INSTAGRAM_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="footer-social-btn"
                                aria-label="Instagram"
                            >
                                <Instagram style={{ width: '20px', height: '20px' }} />
                            </a>
                        </div>
                    </div>

                </div>

                {/* Faixa de copyright */}
                <div className="footer-bottom">
                    <p className="footer-copyright">
                        © {year} Tayna Santos — Massoterapeuta. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}
