import { Link } from 'react-router-dom';

function Emblema() {
    return (
        <svg className="emblem" viewBox="0 0 367 585" aria-hidden="true" focusable="false">
            <rect x="8" y="8" width="351" height="569" rx="175.5" fill="none" stroke="currentColor" strokeWidth="10" strokeDasharray="78 102 706 94 561" />
            <rect x="33" y="32" width="301" height="521" rx="150.5" fill="none" stroke="currentColor" strokeWidth="5" />
            <image href="/brand/ts-monograma.png" x="116.5" y="199" width="134" height="188" />
        </svg>
    );
}

export default function Brand({ onClick }: { onClick?: () => void }) {
    return (
        <Link className="brand" to="/" aria-label="Tayna Santos, massoterapeuta — início" onClick={onClick}>
            <Emblema />
            <span className="bar" aria-hidden="true" />
            <span className="name">
                <b>Tayna Santos</b>
                <span className="spread" aria-hidden="true">
                    {'Massoterapeuta'.split('').map((c, i) => <span key={i}>{c}</span>)}
                </span>
            </span>
        </Link>
    );
}
