import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('PWA service worker registration note:', error);
      },
    });
  } catch (err) {
    console.warn('PWA registration skipped in restricted context:', err);
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
