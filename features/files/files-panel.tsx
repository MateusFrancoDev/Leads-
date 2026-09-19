"use client";

/**
 * Arquivos de um projeto ou cliente: enviar, ver, baixar e excluir.
 *
 * Os arquivos não ficam em pasta pública - todo acesso passa por
 * /api/arquivos/[id], que confere a sessão antes de devolver os bytes.
 */

import { useRef } from "react";
import { Download, ExternalLink, Upload } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Badge } from "@/components/ui/badge";
import { useFormAction } from "@/components/ui/use-form-action";
import { formatDate } from "@/lib/dates";
import { FILE_CATEGORY, FILE_CATEGORY_OPTIONS, type FileCategoryValue } from "@/lib/domain/enums";
import { deleteFileAction, uploadFileAction } from "@/server/actions/content-actions";

export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategoryValue;
  createdAt: Date;
  user: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
}

/** "1,2 MB" - repetido aqui porque o service de disco é código de servidor. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function FilesPanel({
  files,
  projectId,
  clientId,
  maxUploadMb,
  showProject = false,
}: {
  files: ReadonlyArray<FileItem>;
  projectId?: string;
  clientId?: string;
  maxUploadMb: number;
  /** Na ficha do cliente vale dizer de que projeto veio cada arquivo. */
  showProject?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useFormAction(uploadFileAction, {
    onSuccess: () => formRef.current?.reset(),
  });

  const canUpload = Boolean(projectId || clientId);

  return (
    <div className="flex flex-col gap-5">
      {canUpload ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5"
        >
          {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
          {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Arquivo"
              htmlFor="file-input"
              hint={`PDF, imagem, documento ou planilha. Até ${maxUploadMb} MB.`}
            >
              <input
                id="file-input"
                type="file"
                name="file"
                required
                className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs file:text-ink-muted"
              />
            </Field>

            <Field label="Categoria" htmlFor="file-category" className="sm:w-44">
              <Select id="file-category" name="category" defaultValue="OTHER">
                {FILE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <FormFeedback state={state} />
            <Button type="submit" variant="primary" size="sm" disabled={pending} className="ml-auto">
              <Upload className="size-3.5" aria-hidden />
              {pending ? "Enviando..." : "Enviar arquivo"}
            </Button>
          </div>
        </form>
      ) : null}

      {files.length === 0 ? (
        <EmptyState
          title="Nenhum arquivo ainda"
          description="Contratos, briefings, logos e o que o cliente enviar ficam guardados aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                <p className="truncate text-xs text-ink-subtle">
                  {formatSize(file.sizeBytes)} · {formatDate(file.createdAt)}
                  {file.user ? ` · ${file.user.name}` : ""}
                  {showProject && file.project ? ` · ${file.project.name}` : ""}
                </p>
              </div>

              <Badge>{FILE_CATEGORY[file.category].label}</Badge>

              <div className="flex items-center gap-1">
                <a
                  href={`/api/arquivos/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses("ghost", "sm")}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Abrir
                </a>
                <a
                  href={`/api/arquivos/${file.id}?download=1`}
                  download
                  className={buttonClasses("ghost", "sm")}
                >
                  <Download className="size-3.5" aria-hidden />
                  Baixar
                </a>
                <ConfirmAction
                  action={deleteFileAction}
                  hiddenFields={{ fileId: file.id }}
                  title="Excluir arquivo"
                  description={`"${file.name}" será apagado do sistema e do disco.`}
                  triggerLabel="Excluir"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
