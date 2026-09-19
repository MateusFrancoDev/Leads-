import type { Metadata } from "next";
import { Suspense } from "react";
import { APP_CONFIG } from "@/lib/config/app-config";
import { LoginForm } from "@/features/auth/login-form";
import { readCompanyName } from "@/server/repositories/settings-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: APP_CONFIG.loginTitle,
  // Sistema interno: nada aqui deve aparecer em buscador.
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const companyName = await readCompanyName();

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="text-xs font-medium tracking-[0.18em] text-ink-subtle uppercase">
            {companyName}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            {APP_CONFIG.loginTitle}
          </h1>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-5 text-center text-xs text-ink-subtle">
          Acesso restrito. Novos usuários são criados pelo administrador.
        </p>
      </div>
    </main>
  );
}
