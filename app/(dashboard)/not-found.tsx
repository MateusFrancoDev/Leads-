import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/feedback";

/** 404 dentro do painel: mantém a navegação ao lado. */
export default function DashboardNotFound() {
  return (
    <Panel>
      <EmptyState
        title="Não encontramos essa página"
        description="O lead ou a lista pode ter sido removido, ou o endereço esta errado."
        action={
          <Link href="/leads" className={buttonClasses("secondary", "sm")}>
            Ver todos os leads
          </Link>
        }
      />
    </Panel>
  );
}
