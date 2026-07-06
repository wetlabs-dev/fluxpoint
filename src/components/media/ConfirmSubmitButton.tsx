"use client";

import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({ message, children, variant = "secondary" }: { message: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={(event) => {
        if (window.confirm(message)) event.currentTarget.form?.requestSubmit();
      }}
    >
      {children}
    </Button>
  );
}
