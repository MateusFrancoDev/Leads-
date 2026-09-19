import { Sidebar } from "@/components/layout/sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/server/auth/dal";
import { serverConfig } from "@/server/config";
import { readCompanyName } from "@/server/repositories/settings-repository";

/**
 * Casca de tudo que exige login: navegação à esquerda, barra com busca global e
 * identificação do usuário no topo, conteúdo rolável no meio.
 *
 * `requireUser()` aqui garante que nenhuma página filha renderize sem sessão.
 * Mesmo assim cada página e cada Server Action chama de novo: um layout não
 * protege os dados, quem protege é a consulta.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const companyName = await readCompanyName();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar leadsEnabled={serverConfig.leadsModuleEnabled} companyName={companyName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-8">
          <GlobalSearch />
          <UserMenu name={user.name} role={user.role} avatarUrl={user.avatarUrl} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
