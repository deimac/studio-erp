const TECNICAS = ['Drenagem linfática', 'Liberação miofascial', 'Massagem modeladora', 'Aromaterapia', 'Pedras quentes', 'Escalda-pés', 'Relaxamento profundo'];

export default function Faixa() {
    const itens = [...TECNICAS, ...TECNICAS];
    return (
        <div className="strip" aria-hidden="true">
            <div className="track">
                {itens.map((t, i) => <span key={i} style={{ display: 'contents' }}><span>{t}</span><span className="mono" /></span>)}
            </div>
        </div>
    );
}
