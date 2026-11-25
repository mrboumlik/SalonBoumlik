import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    let hadInitialController = Boolean(navigator.serviceWorker.controller);
    const SW_RELOAD_FLAG = 'sb_sw_reloaded_v1';

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadInitialController) {
        hadInitialController = true;
        return;
      }
      try {
        if (window.sessionStorage && window.sessionStorage.getItem(SW_RELOAD_FLAG) === '1') {
          return;
        }
        window.sessionStorage?.setItem(SW_RELOAD_FLAG, '1');
      } catch {
        // Ignore sessionStorage restrictions
      }
      window.location.reload();
    });

    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        let lastCheckAt = Date.now();
        const checkForUpdates = () => {
          const now = Date.now();
          if (now - lastCheckAt < 5 * 60 * 1000) return;
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
          lastCheckAt = now;
          try {
            void registration.update();
          } catch {
            // Ignore SW update check failure
          }
        };
        window.addEventListener('focus', checkForUpdates);
        window.addEventListener('online', checkForUpdates);
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              checkForUpdates();
            }
          });
        }
      },
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
