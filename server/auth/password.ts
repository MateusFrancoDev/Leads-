/**
 * Hash de senha com scrypt, do módulo `node:crypto`. O Node já traz um KDF
 * lento e com sal - não precisamos de bcrypt/argon2 como dependência.
 *
 * Formato gravado: "scrypt$N$r$p$salt$hash" (sal e hash em base64url).
 * Guardar os parâmetros junto permite endurecer o custo no futuro sem
 * invalidar as senhas já cadastradas.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** promisify() perde a sobrecarga com options; a Promise à mão mantém os tipos. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/** Custo do KDF. N=2^16 leva ~100ms nesta máquina: caro para quem ataca, imperceptível no login. */
const COST = { N: 65_536, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** scrypt com N alto precisa de memória acima do padrão de 32MB do Node. */
const MAX_MEMORY = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...COST,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

/**
 * Confere a senha. Devolve false em qualquer hash malformado em vez de lançar:
 * a tela de login nunca deve distinguir "usuário inexistente" de "senha errada".
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(rawHash, "base64url");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const salt = Buffer.from(rawSalt, "base64url");
  const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAX_MEMORY,
  });

  // timingSafeEqual exige o mesmo tamanho; já garantimos isso acima.
  return timingSafeEqual(derived, expected);
}
