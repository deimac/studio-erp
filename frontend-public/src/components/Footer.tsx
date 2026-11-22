import { Link } from 'react-router-dom';
import { HandHeart, Instagram, MapPin, MessageCircle, Navigation } from 'lucide-react';
import Brand from './Brand';
import { whatsappUrl } from '@/lib/whatsapp';
import { ENDERECO, INSTAGRAM_URL, MAPA_URL, TELEFONE } from '@/lib/contato';

export default function Footer() {
    return (
        <>
            <footer className="foot" id="contato">
                <div>
                    <Brand />
                    <p className="about-txt">Massoterapia e estética com protocolos personalizados, em um ambiente pensado para você desacelerar.</p>
                    <div className="socials">
                        <a className="circle-btn" href={INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>
                        <a className="circle-btn" href={whatsappUrl({})} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle /></a>
                    </div>
                </div>
                <div>
                    <h2>Endereço</h2>
                    <ul>
                        <li><MapPin /><span>{ENDERECO.linha1}<br />{ENDERECO.linha2}</span></li>
                        <li><Navigation /><a href={MAPA_URL} target="_blank" rel="noreferrer">Abrir no mapa</a></li>
                    </ul>
                </div>
                <div>
                    <h2>Contato</h2>
                    <ul>
                        <li><MessageCircle /><a href={whatsappUrl({})} target="_blank" rel="noreferrer">{TELEFONE}</a></li>
                        <li><Instagram /><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@massoterapeuta_tayna</a></li>
                        <li><HandHeart /><span>Atendimento individual, com hora marcada</span></li>
                    </ul>
                </div>
                <div>
                    <h2>Navegue</h2>
                    <ul>
                        <li><Link to="/#protocolos">Protocolos</Link></li>
                        <li><Link to="/#resultados">Resultados</Link></li>
                        <li><Link to="/#vale-presente">Vale-presente</Link></li>
                        <li><Link to="/#faq">Dúvidas frequentes</Link></li>
                    </ul>
                </div>
            </footer>
            <div className="base">
                <span>© {new Date().getFullYear()} Tayna Santos · Massoterapia &amp; Estética · Maringá – PR</span>
                <span>Pagamento no dia: dinheiro, PIX, débito ou crédito</span>
            </div>
        </>
    );
}
