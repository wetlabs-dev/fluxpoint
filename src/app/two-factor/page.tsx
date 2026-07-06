import { redirect } from "next/navigation";
import { verifyTwoFactorLogin } from "@/domains/auth/actions";
import { getTwoFactorChallenge } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";

function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function withReturnTo(path: string, returnTo: string) {
  return returnTo === "/dashboard" ? path : `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const challenge = await getTwoFactorChallenge();
  if (!challenge) redirect(withReturnTo("/login?twoFactor=expired", returnTo));

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <FluxpointLogoTile size={48} className="mb-3" />
          <CardTitle>Two-factor verification</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app, or use one saved recovery code.</p>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              That verification code did not match. Try the current code from your authenticator.
            </div>
          ) : null}
          <form action={verifyTwoFactorLogin} className="space-y-4">
            {returnTo !== "/dashboard" ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <label className="space-y-1">
              <span className="text-sm font-medium">Verification or recovery code</span>
              <Input name="code" autoComplete="one-time-code" pattern="[A-Za-z0-9 -]*" required className="text-lg tracking-[0.2em]" />
            </label>
            <Button type="submit" className="w-full">Verify and sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
