export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] leading-none text-ink">{title}</h1>
        {description ? <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:py-10 ${className}`}>{children}</main>;
}
