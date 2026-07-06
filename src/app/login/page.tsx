import { redirect } from "next/navigation";
import Link from "next/link";
import { login } from "@/domains/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; returnTo?: string; twoFactor?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//") ? params.returnTo : "/dashboard");
  const [userCount, firstLoginAdminCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { serverRole: "SERVER_ADMIN", lastLoginAt: null, disabledAt: null } })
  ]);
  const showBootstrapGuidance = userCount === 0 || (userCount === 1 && firstLoginAdminCount === 1);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <FluxpointLogoTile size={48} className="mb-3" />
          <CardTitle>Log in to Fluxpoint</CardTitle>
          <p className="text-sm text-muted-foreground">{showBootstrapGuidance ? "Use the admin account created during bootstrap for first-time setup." : "Use your Fluxpoint account credentials."}</p>
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
          {params.twoFactor === "expired" ? (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
              Your two-factor verification expired. Sign in again to continue.
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
          <div className="mt-5 rounded-md border border-border bg-muted/35 p-3 text-center text-sm text-muted-foreground">
            <p>Fluxpoint access is approved by the server administrator.</p>
            <Link className="mt-2 inline-block font-semibold text-primary hover:underline" href="/request-account">
              Request an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
