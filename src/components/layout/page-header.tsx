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
        <h1 className="font-display text-4xl font-normal leading-none tracking-normal text-primary sm:text-5xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
