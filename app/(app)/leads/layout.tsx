import Link from "next/link";
import { Target } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsSubnav } from "@/components/layout/leads-subnav";
import { serverConfig } from "@/server/config";

/**
 * Porteiro do módulo de captação automática de leads.
 *
 * O módulo inteiro (OpenStreetMap, Dados Abertos do CNPJ, enriquecimento de
 * sites, análise por IA, listas de prospecção) continua no código e funcionando.
 * Ele só fica fora do ar enquanto LEADS_MODULE_ENABLED for "false" no .env -
 * basta trocar para "true" para reativar tudo, sem alterar uma linha.
 *
 * Com o módulo desligado, `children` não é renderizado: as telas de leads nem
 * chegam a consultar o banco. A tela abaixo é mostrada em seu lugar, em vez de
 * um 404 - a página existe, ela só ainda não foi liberada.
 */
export default function LeadsLayout({ children }: LayoutProps<"/leads">) {
  if (!serverConfig.leadsModuleEnabled) return <ComingSoon />;

  return (
    <>
      <LeadsSubnav />
      {children}
    </>
  );
}

function ComingSoon() {
  return (
    <>
      <PageHeader
        title="Leads"
        description="Captação automática de empresas para prospecção."
      />

      <Panel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <Target className="size-5 text-ink-subtle" aria-hidden />
        <p className="text-sm font-medium text-ink">Em breve</p>
        <p className="max-w-md text-sm text-ink-muted">
          A busca por nicho e localização, o mapa, as listas de prospecção e a análise de sites
          continuam prontos no sistema. O módulo é liberado quando a API de captação for contratada.
        </p>
        <Link href="/dashboard" className={`${buttonClasses("secondary", "sm")} mt-2`}>
          Voltar para o painel
        </Link>
        <p className="mt-1 text-xs text-ink-subtle">
          Para ligar agora: <code className="text-ink-muted">LEADS_MODULE_ENABLED=&quot;true&quot;</code>{" "}
          no arquivo .env.
        </p>
      </Panel>
    </>
  );
}
