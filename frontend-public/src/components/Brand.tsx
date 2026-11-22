import { Link } from 'react-router-dom';

export default function Brand({ onClick }: { onClick?: () => void }) {
    return (
        <Link className="brand" to="/" aria-label="Tayna Santos, massoterapeuta — início" onClick={onClick}>
            <span className="mono" aria-hidden="true" />
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
