import Link from "next/link";
import { requestPasswordReset } from "@/domains/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">≈</div>
          <CardTitle>Reset your Fluxpoint password</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your account email and Fluxpoint will send a single-use reset link if the account exists.</p>
        </CardHeader>
        <CardContent>
          {params.sent ? (
            <div className="rounded-md border border-water/30 bg-water/10 p-3 text-sm text-primary">
              If that address exists, a reset email is on the way.
            </div>
          ) : (
            <form action={requestPasswordReset} className="space-y-4">
              <label className="space-y-1">
                <span className="text-sm font-medium">Email</span>
                <Input name="email" type="email" autoComplete="email" required />
              </label>
              <Button type="submit" className="w-full">Send reset link</Button>
            </form>
          )}
          <Link className="mt-4 block text-center text-sm font-semibold text-primary hover:underline" href="/login">
            Back to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
