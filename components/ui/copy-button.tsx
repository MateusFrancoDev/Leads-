"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/button";

/** Copia um texto para a área de transferência. Usado por telefone, e-mail e IA. */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copiado",
  size = "sm",
  iconOnly = false,
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  size?: ButtonSize;
  /** Só o ícone (tabela); o rótulo continua disponível para leitores de tela. */
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const icon = copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={copy}
        title={copied ? copiedLabel : label}
        className="inline-flex size-6 items-center justify-center rounded text-ink-subtle hover:text-ink"
      >
        {icon}
        <span className="sr-only">{copied ? copiedLabel : label}</span>
      </button>
    );
  }

  return (
    <Button type="button" size={size} onClick={copy}>
      {icon}
      {copied ? copiedLabel : label}
    </Button>
  );
}
