import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { EnumBadge } from "@/components/ui/indicators";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/dates";
import { USER_ROLE } from "@/lib/domain/enums";
import { CompanyForm, PasswordForm, ProfileForm } from "@/features/settings/settings-forms";
import { canManageUsers, requireUser } from "@/server/auth/dal";
import { serverConfig } from "@/server/config";
import { readSettings } from "@/server/repositories/settings-repository";
import { listAllUsers } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, users] = await Promise.all([readSettings(), listAllUsers()]);
  const isAdmin = canManageUsers(user);

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados da empresa, sua conta e o estado do sistema."
      />

      <Section
        title="Empresa"
        description="Nome usado na navegação, no título das páginas e na tela de entrada."
      >
        {isAdmin ? (
          <CompanyForm companyName={settings.companyName} />
        ) : (
          <p className="text-sm text-ink-muted">
            {settings.companyName} — só o administrador pode alterar.
          </p>
        )}
      </Section>

      <Section title="Seu perfil" description="Nome e e-mail usados para entrar e no histórico.">
        <ProfileForm name={user.name} email={user.email} />
      </Section>

      <Section
        title="Senha"
        description="Ao trocar a senha, as sessões abertas em outros navegadores são encerradas."
      >
        <PasswordForm />
      </Section>

      <Section
        title="Usuários"
        description="Novos acessos são criados no terminal, com npm run user:create. Não existe cadastro pela interface."
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Cargo</Th>
                <Th>Situação</Th>
                <Th>Último acesso</Th>
                <Th>Desde</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    {item.name}
                    {item.id === user.id ? (
                      <span className="ml-1.5 text-xs text-ink-subtle">(você)</span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{item.email}</span>
                  </Td>
                  <Td>
                    <EnumBadge option={USER_ROLE[item.role]} />
                  </Td>
                  <Td>
                    <Badge tone={item.isActive ? "positive" : "neutral"}>
                      {item.isActive ? "Ativo" : "Desativado"}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">
                      {item.lastLoginAt ? formatDateTime(item.lastLoginAt) : "Nunca"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{formatDate(item.createdAt)}</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      <Section
        title="Módulos"
        description="O que está ligado neste sistema. Alterado pelo arquivo .env."
      >
        <dl className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <dt className="text-sm text-ink">Captação automática de leads</dt>
              <dd className="text-xs text-ink-subtle">
                OpenStreetMap, Dados Abertos do CNPJ, análise de sites e IA. O código está inteiro no
                projeto; ligue em LEADS_MODULE_ENABLED quando contratar a API.
              </dd>
            </div>
            {serverConfig.leadsModuleEnabled ? (
              <Link href="/leads" className="text-xs text-accent hover:underline">
                Abrir módulo
              </Link>
            ) : (
              <Badge>Em breve</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <dt className="text-sm text-ink">Armazenamento de arquivos</dt>
              <dd className="text-xs text-ink-subtle">
                Pasta {serverConfig.storage.dir}/ no disco, servida só para quem está autenticado.
              </dd>
            </div>
            <Badge tone="positive">Até {serverConfig.storage.maxUploadMb} MB por arquivo</Badge>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <dt className="text-sm text-ink">Banco de dados</dt>
              <dd className="text-xs text-ink-subtle">
                PostgreSQL, com até {serverConfig.databasePoolMax} conexões simultâneas.
              </dd>
            </div>
            <Badge tone={serverConfig.isDatabaseConfigured ? "positive" : "negative"}>
              {serverConfig.isDatabaseConfigured ? "Conectado" : "Não configurado"}
            </Badge>
          </div>
        </dl>
      </Section>

      <Section
        title="Preparado para depois"
        description="Nada disto está ligado ainda; a estrutura já suporta."
      >
        <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
          <li>Permissões por cargo — funcionário com acesso só aos projetos atribuídos.</li>
          <li>Integrações — Google, WhatsApp e e-mail.</li>
          <li>Notificações de prazo e de pagamento.</li>
        </ul>
      </Section>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>
      </div>
      <Panel className="p-4 md:p-5">{children}</Panel>
    </section>
  );
}
