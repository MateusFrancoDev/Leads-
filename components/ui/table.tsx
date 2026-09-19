import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabela de dados. No celular ela rola na horizontal dentro do próprio painel
 * em vez de encolher a fonte - uma tabela de sete colunas espremida em 360px
 * não é legível de jeito nenhum, e rolar é honesto.
 */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full min-w-[640px] text-sm">{children}</table>;
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line px-3 py-2 text-xs font-medium whitespace-nowrap text-ink-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-2.5 align-middle text-ink",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("last:[&>td]:border-0 hover:bg-surface-muted", className)}>{children}</tr>;
}
