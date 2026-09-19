"use client";

/**
 * Ações rápidas do painel: abrem o formulário em um diálogo, sem trocar de
 * tela. A ideia é que o mais frequente - lançar um pagamento, anotar um custo,
 * abrir uma tarefa - caiba em dois cliques a partir da página inicial.
 *
 * Os dados dos selects (clientes e projetos) vêm prontos do servidor, então o
 * diálogo abre instantaneamente, sem buscar nada.
 */

import { useState } from "react";
import { Building2, FolderPlus, ListPlus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ClientForm } from "@/features/clients/client-form";
import { ProjectForm } from "@/features/projects/project-form";
import { TaskForm, type ProjectOption, type UserOption } from "@/features/tasks/task-form";
import { ExpenseForm, PaymentForm } from "@/features/finance/finance-forms";
import { createClientAction } from "@/server/actions/client-actions";
import { createProjectAction } from "@/server/actions/project-actions";
import { createTaskAction } from "@/server/actions/task-actions";
import { createExpenseAction, createPaymentAction } from "@/server/actions/finance-actions";

type QuickAction = "client" | "project" | "task" | "payment" | "expense" | null;

export function QuickActions({
  clients,
  projects,
  users,
}: {
  clients: ReadonlyArray<{ id: string; name: string; company: string | null }>;
  projects: ReadonlyArray<ProjectOption>;
  users: ReadonlyArray<UserOption>;
}) {
  const [open, setOpen] = useState<QuickAction>(null);
  const close = () => setOpen(null);

  const hasClients = clients.length > 0;
  const hasProjects = projects.length > 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" onClick={() => setOpen("client")}>
          <Building2 className="size-3.5" aria-hidden />
          Novo cliente
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!hasClients}
          title={hasClients ? undefined : "Cadastre um cliente primeiro."}
          onClick={() => setOpen("project")}
        >
          <FolderPlus className="size-3.5" aria-hidden />
          Novo projeto
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!hasProjects}
          title={hasProjects ? undefined : "Crie um projeto primeiro."}
          onClick={() => setOpen("task")}
        >
          <ListPlus className="size-3.5" aria-hidden />
          Nova tarefa
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!hasProjects}
          title={hasProjects ? undefined : "Crie um projeto primeiro."}
          onClick={() => setOpen("payment")}
        >
          <Wallet className="size-3.5" aria-hidden />
          Registrar pagamento
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!hasProjects}
          title={hasProjects ? undefined : "Crie um projeto primeiro."}
          onClick={() => setOpen("expense")}
        >
          <Receipt className="size-3.5" aria-hidden />
          Registrar despesa
        </Button>
      </div>

      <Modal open={open === "client"} onClose={close} title="Novo cliente">
        <ClientForm
          action={createClientAction}
          submitLabel="Cadastrar cliente"
          redirectOnSuccess={(id) => `/clientes/${id}`}
        />
      </Modal>

      <Modal open={open === "project"} onClose={close} title="Novo projeto" size="lg">
        <ProjectForm
          action={createProjectAction}
          clients={clients}
          submitLabel="Criar projeto"
          redirectOnSuccess={(id) => `/projetos/${id}`}
        />
      </Modal>

      <Modal open={open === "task"} onClose={close} title="Nova tarefa">
        <TaskForm action={createTaskAction} projects={projects} users={users} onDone={close} />
      </Modal>

      <Modal
        open={open === "payment"}
        onClose={close}
        title="Registrar pagamento"
        description="Uma parcela do projeto. Preencha Recebido em para já dar como pago."
      >
        <PaymentForm action={createPaymentAction} projects={projects} onDone={close} />
      </Modal>

      <Modal open={open === "expense"} onClose={close} title="Registrar despesa">
        <ExpenseForm action={createExpenseAction} projects={projects} onDone={close} />
      </Modal>
    </>
  );
}
