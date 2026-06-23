"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    sessionStorage.removeItem("fluxpoint-form-submit-pending");
    sessionStorage.removeItem("fluxpoint-form-flash-pending");
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-2xl rounded-xl border border-destructive/45 bg-destructive/10 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <h2 className="font-display text-2xl text-primary">That change was not saved</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error.message || "Fluxpoint could not complete the request. Review the form and try again."}</p>
          <Button className="mt-4" type="button" variant="secondary" onClick={reset}>Return to the form</Button>
        </div>
      </div>
    </div>
  );
}
