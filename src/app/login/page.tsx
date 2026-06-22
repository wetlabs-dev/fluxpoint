import { redirect } from "next/navigation";
import Link from "next/link";
import { login } from "@/domains/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; returnTo?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//") ? params.returnTo : "/dashboard");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">≈</div>
          <CardTitle>Log in to Fluxpoint</CardTitle>
          <p className="text-sm text-muted-foreground">Use the admin account created during bootstrap.</p>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              That email or password was not recognized.
            </div>
          ) : null}
          {params.reset ? (
            <div className="mb-4 rounded-md border border-water/30 bg-water/10 p-3 text-sm text-primary">
              Your password was reset. You can log in with the new password.
            </div>
          ) : null}
          <form action={login} className="space-y-4">
            {params.returnTo ? <input type="hidden" name="returnTo" value={params.returnTo} /> : null}
            <label className="space-y-1">
              <span className="text-sm font-medium">Email</span>
              <Input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Password</span>
              <Input name="password" type="password" autoComplete="current-password" required />
            </label>
            <Button type="submit" className="w-full">Log in</Button>
          </form>
          <Link className="mt-4 block text-center text-sm font-semibold text-primary hover:underline" href="/forgot-password">
            Forgot your password?
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
