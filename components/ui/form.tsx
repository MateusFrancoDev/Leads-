import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASSES =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-subtle focus:border-accent focus:outline-none";

/** Rotulo + controle + mensagem de erro, com ligacao acessivel entre eles. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL_CLASSES, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(CONTROL_CLASSES, "h-auto min-h-20 resize-y py-2 leading-relaxed", className)}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL_CLASSES, "pr-8", className)}>
      {children}
    </select>
  );
}

/** Opcoes dos filtros "possui / nao possui". */
export const TRI_STATE_OPTIONS = [
  { value: "any", label: "Indiferente" },
  { value: "yes", label: "Possui" },
  { value: "no", label: "Nao possui" },
] as const;

/** Filtro de presenca (site, telefone, WhatsApp...) usado nas duas telas. */
export function TriStateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const id = `filter-${name}`;
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} name={name} defaultValue={defaultValue}>
        {TRI_STATE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
