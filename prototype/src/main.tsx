import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enregistrement du Service Worker dans le bundle (conforme CSP script-src 'self')
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {
      // Offline fallback silencieux si non disponible
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
