"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const cookieName = "fluxpoint-form-flash";
const storageName = "fluxpoint-form-flash-pending";
const submitStorageName = "fluxpoint-form-submit-pending";
type Notice = { message: string; tone: "success" | "error"; nonce: number };

function readNotice(): Notice | null {
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  try {
    if (value) {
      const parsed = JSON.parse(decodeURIComponent(value));
      if (typeof parsed.message === "string") {
        sessionStorage.setItem(storageName, JSON.stringify(parsed));
        return parsed;
      }
    }
    const stored = sessionStorage.getItem(storageName);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return typeof parsed.message === "string" && Date.now() - Number(parsed.nonce) < 10_000 ? parsed : null;
  } catch {
    return null;
  }
}

function clearNoticeCookie() {
  document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function clearNotice() {
  clearNoticeCookie();
  sessionStorage.removeItem(storageName);
}

function fallbackMessage(label: string) {
  const value = label.trim().replace(/\s+/g, " ");
  if (/^create\b/i.test(value)) return "Created.";
  if (/^delete\b/i.test(value)) return "Deleted.";
  if (/^archive\b/i.test(value)) return "Archived.";
  if (/^(remove|clear)\b/i.test(value)) return "Removed.";
  if (/^(save|update)\b/i.test(value)) return "Saved.";
  if (/^(complete|mark|log|add|assign|start|request|generate|duplicate|send)\b/i.test(value)) return "Updated.";
  return "Saved.";
}

export function FormFeedback() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const lastNonce = useRef(0);

  useEffect(() => {
    const check = () => {
      const next = readNotice();
      if (next && next.nonce !== lastNonce.current) {
        sessionStorage.removeItem(submitStorageName);
        lastNonce.current = next.nonce;
        setNotice(next);
      }
      const pending = sessionStorage.getItem(submitStorageName);
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as Notice & { readyAt: number };
          if (Date.now() >= parsed.readyAt && parsed.nonce !== lastNonce.current) {
            sessionStorage.removeItem(submitStorageName);
            lastNonce.current = parsed.nonce;
            setNotice(parsed);
          }
        } catch {
          sessionStorage.removeItem(submitStorageName);
        }
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !form.checkValidity()) return;
      const submitter = event.submitter instanceof HTMLButtonElement || event.submitter instanceof HTMLInputElement ? event.submitter : null;
      const label = submitter?.textContent || submitter?.value || "Save";
      const now = Date.now();
      sessionStorage.setItem(submitStorageName, JSON.stringify({ message: fallbackMessage(label), tone: "success", nonce: now, readyAt: now + 1_800 }));
    };
    document.addEventListener("submit", onSubmit, true);
    check();
    const interval = window.setInterval(check, 350);
    return () => { document.removeEventListener("submit", onSubmit, true); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const clearCookie = window.setTimeout(clearNoticeCookie, 750);
    const timeout = window.setTimeout(() => { clearNotice(); setNotice(null); }, 4_500);
    return () => { window.clearTimeout(clearCookie); window.clearTimeout(timeout); };
  }, [notice]);

  if (!notice) return null;
  const success = notice.tone === "success";
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[100] flex justify-center sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5" aria-live="polite" aria-atomic="true">
      <div role={success ? "status" : "alert"} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${success ? "border-emerald-500/40 bg-emerald-950/95 text-emerald-50" : "border-destructive/50 bg-destructive text-destructive-foreground"}`}>
        {success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
        <span>{notice.message}</span>
        <button type="button" className="ml-2 rounded px-1 text-xs opacity-75 hover:opacity-100" onClick={() => { clearNotice(); setNotice(null); }} aria-label="Dismiss notification">×</button>
      </div>
    </div>
  );
}
