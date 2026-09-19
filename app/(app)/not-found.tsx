import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/feedback";

/** 404 dentro do sistema: mantém a navegação ao lado. */
export default function AppNotFound() {
  return (
    <Panel>
      <EmptyState
        title="Não encontramos essa página"
        description="O registro pode ter sido excluído, o endereço está errado, ou o módulo ainda não foi liberado."
        action={
          <Link href="/dashboard" className={buttonClasses("secondary", "sm")}>
            Voltar para o painel
          </Link>
        }
      />
    </Panel>
  );
}
