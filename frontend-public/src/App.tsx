import Header from '@/sections/Header';
import Hero from '@/sections/Hero';
import Sobre from '@/sections/Sobre';
import Resultados from '@/sections/Resultados';
import Servicos from '@/sections/Servicos';
import Depoimentos from '@/sections/Depoimentos';
import FAQ from '@/sections/FAQ';
import Footer from '@/sections/Footer';

export default function App() {
    return (
        <>
            <Header />
            <main>
                <Hero />
                <Sobre />
                <Resultados />
                <Servicos />
                <Depoimentos />
                <FAQ />
            </main>
            <Footer />
        </>
    );
}
