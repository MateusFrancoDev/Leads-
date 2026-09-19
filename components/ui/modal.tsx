"use client";

/**
 * Diálogo construído sobre o <dialog> nativo. O elemento já entrega, de graça,
 * o que uma biblioteca de modal costuma reimplementar: foco preso dentro da
 * caixa, fechar no Esc, camada acima de tudo e `::backdrop` estilizável.
 *
 * Usado tanto para formulário rápido quanto para confirmação de exclusão.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

  return (
    <dialog
      ref={dialogRef}
      // O Esc dispara "cancel"; sem isto o React e o DOM discordariam sobre estar aberto.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Clique no fundo fecha: o alvo do clique é o próprio <dialog>, não o conteúdo.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40",
        widths[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-md p-1 text-ink-subtle hover:bg-surface-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
    </dialog>
  );
}
