/** Esqueleto exibido enquanto a pagina busca dados no banco. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-surface-muted" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-line bg-surface" />
    </div>
  );
}
