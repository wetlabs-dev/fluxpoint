"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Settings, UserCircle, X } from "lucide-react";
import { logout } from "@/domains/auth/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export function MobileAccountMenu({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);

  return <div ref={rootRef} className="relative ml-auto lg:hidden">
    <button ref={buttonRef} type="button" aria-label={open ? "Close account menu" : "Open account menu"} aria-expanded={open} aria-controls="mobile-account-menu" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/75 text-primary shadow-sm backdrop-blur transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-water/40">
      {open ? <X className="h-5 w-5" aria-hidden="true" /> : <UserCircle className="h-5 w-5" aria-hidden="true" />}
    </button>
    {open ? <div id="mobile-account-menu" role="dialog" aria-label="Account controls" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-border bg-card p-4 shadow-2xl">
      <div className="min-w-0 rounded-md bg-muted/55 p-3"><div className="truncate text-sm font-semibold text-primary">{user.name}</div><div className="truncate text-xs text-muted-foreground">{user.email}</div></div>
      <ThemeToggle />
      <Link href="/account" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"><Settings className="h-4 w-4" aria-hidden="true" />Account settings</Link>
      <form action={logout}><Button type="submit" variant="secondary" className="w-full">Log out</Button></form>
    </div> : null}
  </div>;
}
