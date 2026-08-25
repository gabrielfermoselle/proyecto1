// Bloques de carga (skeleton) reutilizables, mobile-first, con animate-pulse de Tailwind.

export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-[var(--paper-line)] ${className}`} />;
}

export function SkeletonText({ lines = 1, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

// Fila tipo "pedido" (MyOrders / ReceivedOrders).
export function SkeletonJobRow() {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--paper-line)] py-4 last:border-none sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-2.5 w-2.5 flex-none rounded-full" />
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-3.5 w-40" />
          <SkeletonBlock className="h-3 w-56" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-7 w-20 rounded-full" />
        <SkeletonBlock className="h-7 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonJobList({ rows = 4 }) {
  return (
    <div className="card job-list-card">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonJobRow key={i} />
      ))}
    </div>
  );
}

// Tarjeta de plomero (Directorio).
export function SkeletonPlumberCard() {
  return (
    <div className="card flex gap-4">
      <SkeletonBlock className="h-[72px] w-[72px] flex-none rounded-full" />
      <div className="flex flex-1 flex-col gap-2.5">
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-3 w-1/4" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

// Perfil de plomero (PlumberProfile / MyPlumberProfile).
export function SkeletonProfile() {
  return (
    <div className="grid cols-2">
      <div className="grid gap-5">
        <div className="card">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-20 w-20 flex-none rounded-full" />
            <div className="flex flex-1 flex-col gap-2.5">
              <SkeletonBlock className="h-5 w-1/2" />
              <SkeletonBlock className="h-3.5 w-1/3" />
            </div>
          </div>
          <hr className="sep" />
          <SkeletonText lines={3} />
        </div>
      </div>
      <div className="grid gap-5">
        <div className="card">
          <SkeletonBlock className="mb-3 h-4 w-1/3" />
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = "" }) {
  return <span className={`spinner ${className}`} />;
}
