import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { cleanAddressBar } from './core/urlHygiene';

// Contre-audit V0.2 : retire utm_* et identifiants de clic de l'adresse affichée (paramètres fonctionnels conservés)
cleanAddressBar();

// Enregistrement du Service Worker dans le bundle (conforme CSP script-src 'self')
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {
      // Offline fallback silencieux si non disponible
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
