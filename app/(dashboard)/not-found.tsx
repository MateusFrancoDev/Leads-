import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/feedback";

/** 404 dentro do painel: mantem a navegacao ao lado. */
export default function DashboardNotFound() {
  return (
    <Panel>
      <EmptyState
        title="Nao encontramos essa pagina"
        description="O lead ou a lista pode ter sido removido, ou o endereco esta errado."
        action={
          <Link href="/leads" className={buttonClasses("secondary", "sm")}>
            Ver todos os leads
          </Link>
        }
      />
    </Panel>
  );
}
