import { redirect } from "next/navigation";
import { login } from "@/domains/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;

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
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              That email or password was not recognized.
            </div>
          ) : null}
          <form action={login} className="space-y-4">
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
        </CardContent>
      </Card>
    </main>
  );
}
