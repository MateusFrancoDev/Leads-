/**
 * Cria um usuário do sistema. Não existe cadastro pela interface: acesso é
 * dado no terminal, por quem administra a máquina.
 *
 *   npm run user:create
 *
 * Também aceita os dados por argumento (a senha continua sendo perguntada,
 * para não ficar registrada no histórico do terminal):
 *
 *   npm run user:create -- --nome "Mateus Franco" --email m@empresa.com --cargo admin
 */

import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { hashPassword } from "@/server/auth/password";
import { newPasswordSchema } from "@/lib/schemas/auth";
import { countUsers, createUser, emailIsTaken } from "@/server/repositories/user-repository";
import type { UserRoleValue } from "@/lib/domain/enums";
import { USER_ROLE_OPTIONS } from "@/lib/domain/enums";

/** O CLI aceita apelidos curtos; o banco guarda o valor do enum. */
const ROLE_ALIASES: Record<string, UserRoleValue> = {
  admin: "ADMIN",
  administrador: "ADMIN",
  socio: "PARTNER",
  sócio: "PARTNER",
  partner: "PARTNER",
  funcionario: "EMPLOYEE",
  funcionário: "EMPLOYEE",
  employee: "EMPLOYEE",
};

/** Teclas de controle que a leitura da senha precisa tratar à mão. */
const ENTER = ["\r", "\n"];
const CTRL_C = "";
const CTRL_D = "";
const BACKSPACE = ["", "\b"];

/**
 * Leitor de linhas usado quando a entrada NÃO é um terminal (pipe, arquivo, CI).
 *
 * Precisa ser um só para o script inteiro: abrir e fechar uma interface por
 * pergunta descartaria o que o readline já tinha lido adiante do pipe, e a
 * segunda resposta se perderia.
 */
let pipedLines: AsyncIterator<string> | null = null;

async function readPipedLine(): Promise<string> {
  pipedLines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const { value, done } = await pipedLines.next();
  return done ? "" : String(value).trim();
}

/**
 * Pergunta e lê uma linha.
 *
 * No terminal, uma interface por pergunta, aberta e fechada na hora: manter uma
 * viva o script inteiro brigaria com a leitura da senha, que precisa assumir o
 * stdin em modo bruto - duas coisas escutando o mesmo teclado dão prompt travado.
 */
async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    return readPipedLine();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function askRequired(question: string): Promise<string> {
  for (;;) {
    const answer = await ask(question);
    if (answer) return answer;
    console.log("  Campo obrigatório.");
  }
}

/**
 * Pergunta a senha mostrando um asterisco por caractere digitado.
 *
 * Esconder a digitação por completo parece um terminal travado: sem nenhum
 * retorno não dá para saber se a tecla foi registrada. O asterisco resolve isso
 * e a senha continua fora do histórico da tela.
 *
 * Fora de um terminal interativo (entrada redirecionada, CI) lê a linha normal,
 * então `echo senha | npm run user:create -- --nome X --email y@z` funciona.
 */
async function askSecret(question: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;

  if (!input.isTTY) return ask(question);

  return new Promise<string>((resolve) => {
    output.write(question);

    let value = "";
    const wasRaw = Boolean(input.isRaw);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    function finish(result: string | null): void {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
      // Ctrl+C: em modo bruto o terminal não interrompe sozinho.
      if (result === null) process.exit(130);
      resolve(result);
    }

    function onData(chunk: string): void {
      for (const char of chunk) {
        if (ENTER.includes(char) || char === CTRL_D) {
          finish(value);
          return;
        }
        if (char === CTRL_C) {
          finish(null);
          return;
        }
        if (BACKSPACE.includes(char)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            // Apaga o asterisco: volta o cursor, cobre com espaço, volta de novo.
            output.write("\b \b");
          }
          continue;
        }
        // Ignora as demais teclas de controle (setas chegam como escape).
        if (char >= " ") {
          value += char;
          output.write("*");
        }
      }
    }

    input.on("data", onData);
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      nome: { type: "string" },
      email: { type: "string" },
      cargo: { type: "string" },
    },
    allowPositionals: true,
  });

  const total = await countUsers();
  console.log(`\nNovo usuário do sistema (${total} já cadastrado${total === 1 ? "" : "s"}).\n`);

  const name = values.nome?.trim() || (await askRequired("Nome: "));

  let email = values.email?.trim().toLowerCase() ?? "";
  for (;;) {
    if (!email) email = (await askRequired("E-mail: ")).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("  E-mail inválido.");
      email = "";
      continue;
    }
    if (await emailIsTaken(email)) {
      console.log("  Já existe um usuário com este e-mail.");
      email = "";
      continue;
    }
    break;
  }

  const roleLabels = USER_ROLE_OPTIONS.map((option) => option.label.toLowerCase()).join(" / ");
  let role: UserRoleValue | undefined = values.cargo
    ? ROLE_ALIASES[values.cargo.trim().toLowerCase()]
    : undefined;
  while (!role) {
    const answer = await ask(`Cargo (${roleLabels}) [administrador]: `);
    role = answer === "" ? "ADMIN" : ROLE_ALIASES[answer.toLowerCase()];
    if (!role) console.log("  Cargo inválido.");
  }

  console.log("\nA senha aparece como asteriscos. Mínimo de 8 caracteres, com letra e número.");

  let password = "";
  for (;;) {
    const first = await askSecret("Senha: ");
    const check = newPasswordSchema.safeParse(first);
    if (!check.success) {
      console.log(`  ${check.error.issues[0]?.message ?? "Senha inválida."}`);
      continue;
    }
    const confirmation = await askSecret("Repita a senha: ");
    if (first !== confirmation) {
      console.log("  As senhas não conferem.");
      continue;
    }
    password = first;
    break;
  }

  const user = await createUser({ name, email, passwordHash: await hashPassword(password), role });
  const label = USER_ROLE_OPTIONS.find((option) => option.value === user.role)?.label ?? user.role;
  console.log(`\nUsuário criado: ${user.name} <${user.email}> - ${label}\n`);
}

main()
  .catch((error: unknown) => {
    console.error("\nNão foi possível criar o usuário.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.stdin.pause());
