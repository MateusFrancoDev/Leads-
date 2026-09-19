/**
 * Nome do cookie de sessão. Fica aqui - e não em server/auth - porque o proxy
 * também precisa dele, e o proxy não pode importar código que toca no banco.
 */
export const SESSION_COOKIE = "lummit_session";
