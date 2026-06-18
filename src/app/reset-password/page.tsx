import Link from "next/link";
import { resetPasswordWithToken } from "@/domains/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">≈</div>
          <CardTitle>Choose a new password</CardTitle>
          <p className="text-sm text-muted-foreground">Reset links expire after one hour and can only be used once.</p>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {params.error === "weak" ? "Use at least 12 characters." : "That reset link is invalid or expired."}
            </div>
          ) : null}
          {token ? (
            <form action={resetPasswordWithToken} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <label className="space-y-1">
                <span className="text-sm font-medium">New password</span>
                <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
              </label>
              <Button type="submit" className="w-full">Reset password</Button>
            </form>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No reset token was provided.
            </div>
          )}
          <Link className="mt-4 block text-center text-sm font-semibold text-primary hover:underline" href="/login">
            Back to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
