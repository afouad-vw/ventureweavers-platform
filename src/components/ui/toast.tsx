"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

/** Show a short confirmation, e.g. toast("Saved"). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-[90] -translate-x-1/2 desk:bottom-6"
      >
        {message ? <div className="max-w-[calc(100vw-32px)] rounded-xl bg-fg px-4 py-2.5 text-[13.5px] font-bold text-bg shadow-lg">{message}</div> : null}
      </div>
    </ToastContext.Provider>
  );
}
