import React, { useState, useEffect, createContext, useContext } from "react";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`p-4 rounded-2xl shadow-2xl cursor-pointer border animate-slideIn flex items-start gap-3 ${
              toast.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : toast.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : toast.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-brand-500/10 border-brand-500/30 text-brand-400"
            }`}
          >
            <span className="text-xs font-semibold leading-relaxed">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
