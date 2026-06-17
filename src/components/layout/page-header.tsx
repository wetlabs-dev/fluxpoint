export function PageHeader({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-moss">{eyebrow}</div> : null}
        <h1 className="text-3xl font-bold tracking-normal text-primary sm:text-4xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
