/**
 * Hooks de resolução para rodar TypeScript direto no Node (testes e scripts).
 *
 * O código usa o alias "@/..." do tsconfig e imports sem extensão. O Node não
 * entende nenhum dos dois; estes hooks traduzem para o arquivo .ts real, o que
 * evita instalar Jest, Vitest ou tsx.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function findFile(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) return basePath;
  for (const extension of EXTENSIONS) {
    if (existsSync(basePath + extension)) return basePath + extension;
  }
  for (const extension of EXTENSIONS) {
    const index = resolvePath(basePath, `index${extension}`);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let basePath = null;
  if (specifier.startsWith("@/")) {
    basePath = resolvePath(ROOT, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    basePath = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (basePath) {
    const file = findFile(basePath);
    if (file) {
      const isTypeScript = /\.(m?ts|tsx)$/.test(file);
      return {
        url: pathToFileURL(file).href,
        format: isTypeScript ? "module-typescript" : undefined,
        shortCircuit: true,
      };
    }
  }
  return nextResolve(specifier, context);
}
