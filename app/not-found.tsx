import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-ink">Pagina nao encontrada</p>
      <p className="max-w-sm text-sm text-ink-muted">
        O endereco acessado nao existe nesta aplicacao.
      </p>
      <Link href="/" className={buttonClasses("secondary", "sm")}>
        Voltar ao dashboard
      </Link>
    </main>
  );
}
