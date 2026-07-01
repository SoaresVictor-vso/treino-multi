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
      className="surface-scrollbar fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/72 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-4xl flex-none overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container shadow-[0_32px_100px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
      >
        <div className="surface-scrollbar max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-h-[calc(100vh-4rem)]">
          <div className="border-b border-outline-variant bg-[radial-gradient(circle_at_top_left,rgba(195,244,0,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-6 py-6 sm:px-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="type-label-caps text-secondary-fixed-dim">Cadastro guiado</p>
                <h3 id="modal-title" className="mt-2 text-2xl font-bold tracking-[-0.02em] text-primary sm:text-3xl">
                  {title}
                </h3>
                {description && (
                  <p id="modal-description" className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-outline-variant bg-surface-container/70 p-2 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-primary"
                aria-label="Fechar modal"
              >
                <RiCloseLine size={22} />
              </button>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
