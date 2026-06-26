"use client";

import React from "react";
import { createPortal } from "react-dom";
import { RiCloseLine } from "react-icons/ri";

type ModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
}: ModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined" || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 px-4 py-6 [scrollbar-width:thin] [scrollbar-color:var(--color-primary-fixed-dim)_var(--color-surface-container-low)] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-surface-container-low [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-surface-container-low [&::-webkit-scrollbar-thumb]:bg-primary-fixed-dim hover:[&::-webkit-scrollbar-thumb]:bg-primary-container sm:px-6 sm:py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-xl flex-none rounded-2xl border border-outline-variant bg-surface-container shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
      >
        <div className="max-h-[calc(100vh-3rem)] overflow-y-auto p-6 [scrollbar-width:thin] [scrollbar-color:var(--color-primary-fixed-dim)_var(--color-surface-container-low)] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-surface-container-low [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-surface-container-low [&::-webkit-scrollbar-thumb]:bg-primary-fixed-dim hover:[&::-webkit-scrollbar-thumb]:bg-primary-container sm:max-h-[calc(100vh-4rem)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 id="modal-title" className="text-title-lg text-primary">
                {title}
              </h3>
              {description && (
                <p id="modal-description" className="mt-1 text-body-sm text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-variant"
              aria-label="Fechar modal"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
