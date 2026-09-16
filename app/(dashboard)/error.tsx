"use client";

/**
 * Fronteira de erro do painel. Mostra uma mensagem curta e um botao para
 * tentar de novo - nunca a stack trace. O detalhe tecnico fica no log do
 * servidor, onde ele e util.
 */

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNotice, Panel } from "@/components/ui/feedback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[painel] erro nao tratado", error.digest ?? error.message);
  }, [error]);

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <ErrorNotice message="Algo deu errado ao montar esta pagina." />
      <p className="text-sm text-ink-muted">
        Se o problema continuar, confira a conexao com o banco em Configuracoes.
      </p>
      <div>
        <Button type="button" variant="primary" size="sm" onClick={reset}>
          <RotateCw className="size-3.5" aria-hidden />
          Tentar de novo
        </Button>
      </div>
    </Panel>
  );
}
