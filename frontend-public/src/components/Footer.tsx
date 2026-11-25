import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, Instagram, MapPin, MessageCircle, Navigation } from 'lucide-react';
import Brand from './Brand';
import { formatarTelefone } from '@/lib/whatsapp';
import { mapaUrl, useContato, useWhatsapp } from '@/lib/contato';

export default function Footer() {
    const whatsappUrl = useWhatsapp();
    const { unidades, principal, instagram, instagramUrl, rodapeTexto, assinatura } = useContato();
    const varias = unidades.length > 1;
    const comEndereco = unidades.filter((u) => u.endereco);
    return (
        <>
            <footer className="foot" id="contato">
                <div>
                    <Brand />
                    {rodapeTexto && <p className="about-txt">{rodapeTexto}</p>}
                    <div className="socials">
                        {instagramUrl && <a className="circle-btn" href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>}
                        <a className="circle-btn" href={whatsappUrl()} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle /></a>
                    </div>
                </div>
                {comEndereco.length > 0 && (
                    <div>
                        <h2>{comEndereco.length > 1 ? 'Endereços' : 'Endereço'}</h2>
                        <ul>
                            {comEndereco.map((u) => (
                                <Fragment key={u.id}>
                                    <li>
                                        <MapPin />
                                        <span>
                                            {varias && <><b>{u.nome}</b><br /></>}
                                            {u.endereco}
                                            {(u.bairro || u.cidade) && <><br />{[u.bairro, u.cidade].filter(Boolean).join(' · ')}</>}
                                        </span>
                                    </li>
                                    <li><Navigation /><a href={mapaUrl(u)} target="_blank" rel="noreferrer">Abrir no mapa</a></li>
                                </Fragment>
                            ))}
                        </ul>
                    </div>
                )}
                <div>
                    <h2>Contato</h2>
                    <ul>
                        {varias
                            ? unidades.filter((u) => u.whatsapp).map((u) => (
                                  <li key={u.id}><MessageCircle /><a href={`https://wa.me/${u.whatsapp!.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{formatarTelefone(u.whatsapp!)} · {u.nome}</a></li>
                              ))
                            : principal?.whatsapp && <li><MessageCircle /><a href={whatsappUrl()} target="_blank" rel="noreferrer">{formatarTelefone(principal.whatsapp)}</a></li>}
                        {instagramUrl && <li><Instagram /><a href={instagramUrl} target="_blank" rel="noreferrer">@{instagram}</a></li>}
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
                <span>© {new Date().getFullYear()}{assinatura && ` ${assinatura}`}{!varias && principal?.cidade && ` · ${principal.cidade}`}</span>
                <span>Pagamento no dia: dinheiro, PIX, débito ou crédito</span>
            </div>
        </>
    );
}
