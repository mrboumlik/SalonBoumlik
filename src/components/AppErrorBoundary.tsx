import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Salon Boumlik UI boundary recovered from error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#FAF9F6] text-slate-900 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-2xl bg-white border border-stone-200 p-6 text-center space-y-4 shadow-lg">
            <h1 className="text-xl font-black text-slate-900">SALON BOUMLIK</h1>
            <p className="text-sm text-stone-700 leading-relaxed">
              حدث خلل مؤقت في المتصفح. اضغط على إعادة التحميل للمتابعة بشكل طبيعي.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                if (typeof window === 'undefined') return;
                const clearAndReload = async () => {
                  try {
                    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(regs.map((r) => r.unregister()));
                    }
                    if ('caches' in window) {
                      const keys = await window.caches.keys();
                      await Promise.all(keys.map((k) => window.caches.delete(k)));
                    }
                  } catch {
                    // Ignore cache clear failure
                  }
                  if (window.location) {
                    window.location.reload();
                  }
                };
                void clearAndReload();
              }}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm cursor-pointer"
            >
              إعادة تحميل الصفحة • Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
