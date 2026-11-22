import { Outlet, Route, Routes } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScrollManager from '@/components/ScrollManager';
import Home from '@/pages/Home';
import ProtocoloPage from '@/pages/ProtocoloPage';
import NotFound from '@/pages/NotFound';

function Layout() {
    return (
        <div className="page">
            <ScrollManager />
            <Header />
            <main><Outlet /></main>
            <Footer />
        </div>
    );
}

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="protocolos/:slug" element={<ProtocoloPage />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    );
}
