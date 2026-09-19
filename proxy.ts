/**
 * Desvio rápido de quem não está logado (no Next 16 o antigo "middleware"
 * chama-se proxy). Aqui só olhamos se o cookie existe: o proxy roda em toda
 * navegação, inclusive nas pré-carregadas, então não pode consultar o banco.
 *
 * A validação de verdade é feita por requireUser() em server/auth/dal.ts,
 * junto dos dados. Este arquivo é conforto de navegação, não segurança.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const LOGIN_PATH = "/login";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    // Já logado não precisa ver a tela de login de novo.
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Guarda para onde a pessoa queria ir, e volta para lá depois de entrar.
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Fora: arquivos estáticos, imagens do Next, o favicon e as rotas de API.
   *
   * As rotas de API ficam de fora de propósito. Elas já conferem a sessão por
   * conta própria e respondem 401 em JSON; se o proxy as redirecionasse para
   * /login, quem chamasse a API receberia o HTML da tela de entrada com status
   * 307 no lugar de um erro que dá para tratar.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
