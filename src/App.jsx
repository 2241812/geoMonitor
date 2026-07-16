import { HashRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import MapPage from './components/MapPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
      </Routes>
    </HashRouter>
  );
}
