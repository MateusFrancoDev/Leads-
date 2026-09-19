import { redirect } from "next/navigation";

/**
 * A raiz não tem tela própria: o sistema começa no painel. Quem não estiver
 * logado é desviado antes daqui, pelo proxy.
 */
export default function RootPage() {
  redirect("/dashboard");
}
