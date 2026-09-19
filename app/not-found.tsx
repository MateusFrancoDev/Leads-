import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** 404 fora do sistema (sem sessão): sem navegação, só o caminho de volta. */
export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Erro 404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
          Página não encontrada
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <Link href="/dashboard" className={`${buttonClasses("secondary", "sm")} mt-5`}>
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}
