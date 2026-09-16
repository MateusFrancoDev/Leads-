"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/button";

/** Copia um texto para a area de transferencia. Usado pelo telefone e pela IA. */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copiado",
  size = "sm",
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  size?: ButtonSize;
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

  return (
    <Button type="button" size={size} onClick={copy}>
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
