/**
 * Navegação principal, em um lugar só. A sidebar, o menu do celular e a busca
 * global leem daqui - acrescentar uma tela é acrescentar uma linha.
 *
 * Só nomes e ícones: nada de configuração de runtime (isso é server/config.ts).
 */

import {
  Briefcase,
  Building2,
  CalendarDays,
  FolderOpen,
  History,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sun,
  Target,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulo ainda não liberado: aparece apagado, com a etiqueta "Em breve". */
  comingSoon?: boolean;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/hoje", label: "Hoje", icon: Sun },
  { href: "/clientes", label: "Clientes", icon: Building2 },
  { href: "/projetos", label: "Projetos", icon: Briefcase },
  { href: "/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/arquivos", label: "Arquivos", icon: FolderOpen },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/leads", label: "Leads", icon: Target, comingSoon: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

/** Sub-navegação do módulo de Leads, exibida só quando ele está ligado. */
export const LEADS_NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/leads/painel", label: "Painel" },
  { href: "/leads/buscar", label: "Buscar" },
  { href: "/leads", label: "Todos os leads" },
  { href: "/leads/mapa", label: "Mapa" },
  { href: "/leads/listas", label: "Listas" },
  { href: "/leads/favoritos", label: "Favoritos" },
  { href: "/leads/historico", label: "Histórico" },
  { href: "/leads/configuracoes", label: "Configurações" },
];

/**
 * A rota atual corresponde a este item do menu?
 * "/clientes" acende em "/clientes/abc", mas "/leads" não pode acender em
 * "/leads-algo-outro" - daí a checagem da barra.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
