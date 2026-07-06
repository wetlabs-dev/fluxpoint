import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { confirmTwoFactorSetup, dismissRecoveryCodes, regenerateRecoveryCodes, resetTwoFactorSetup } from "@/domains/auth/actions";
import { decryptRecoveryCodes, decryptTotpSecret, encryptTotpSecret, generateTotpSecret, totpProvisioningUri } from "@/lib/auth/totp";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string; twoFactor?: string; recoveryCodes?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  let setup = await prisma.userTwoFactor.findUnique({
    where: { userId: user.id },
    include: { recoveryCodes: { where: { usedAt: null }, select: { id: true } } }
  });

  if (!setup) {
    setup = await prisma.userTwoFactor.create({
      data: { userId: user.id, secretCiphertext: encryptTotpSecret(generateTotpSecret()) },
      include: { recoveryCodes: { where: { usedAt: null }, select: { id: true } } }
    });
  }

  const enabled = Boolean(setup.enabledAt);
  if (enabled && user.serverRole === "SERVER_ADMIN" && !user.twoFactorVerifiedAt) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account Security" eyebrow="Two-factor authentication" />
        <Card className="max-w-xl">
          <CardHeader><CardTitle>Two-factor verification required</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sign in again and enter your verification code before changing two-factor settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  const secret = decryptTotpSecret(setup.secretCiphertext);
  const qrCode = enabled ? null : await QRCode.toDataURL(totpProvisioningUri(user.email, secret), { margin: 1, width: 240 });
  const recoveryCodes = decryptRecoveryCodes(setup.recoveryCodesCiphertext);
  const unusedRecoveryCount = setup.recoveryCodes.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Account Security" eyebrow="Two-factor authentication" />

      {params.setup === "required" ? <Alert tone="warning">Server Admin accounts must enable two-factor authentication before using server maintenance tools.</Alert> : null}
      {params.twoFactor === "enabled" ? <Alert tone="success">Two-factor authentication is enabled. Save the recovery codes shown below.</Alert> : null}
      {params.twoFactor === "invalid" ? <Alert tone="danger">That verification code did not match. Scan the QR code and try the current 6-digit code.</Alert> : null}
      {params.twoFactor === "reset" ? <Alert tone="warning">Your two-factor setup was reset. Scan the new QR code to enable it again.</Alert> : null}
      {params.recoveryCodes === "generated" ? <Alert tone="success">New recovery codes generated. Save them somewhere safe before dismissing them.</Alert> : null}

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-water" /> Authenticator app</CardTitle>
          <p className="text-sm text-muted-foreground">Use Apple Passwords, 1Password, Google Authenticator, Authy, or another TOTP-compatible app.</p>
        </CardHeader>
        <CardContent>
          {enabled ? (
            <div className="grid gap-4 text-sm text-muted-foreground">
              <p>Two-factor authentication is active for <span className="font-semibold text-foreground">{user.email}</span>.</p>
              <p>{unusedRecoveryCount} unused recovery code{unusedRecoveryCount === 1 ? "" : "s"} remaining.</p>
              <form action={resetTwoFactorSetup}>
                <Button type="submit" variant="secondary">Reset QR setup</Button>
              </form>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[16rem_1fr]">
              <div className="rounded-lg border border-border bg-white p-3">
                {qrCode ? <img src={qrCode} alt="Two-factor QR code" className="mx-auto h-56 w-56" /> : null}
              </div>
              <div className="grid content-start gap-4">
                <div className="text-sm text-muted-foreground">
                  <p>Scan this QR code with your authenticator app, then enter the current 6-digit code to finish setup.</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Add a verification code for Fluxpoint.</li>
                    <li>Scan the QR code or enter the setup key manually.</li>
                    <li>Enter the current code below.</li>
                  </ol>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-primary">Enter setup key manually</summary>
                  <code className="mt-2 block overflow-auto rounded-md border border-border bg-muted/50 p-2 text-xs">{secret}</code>
                </details>
                <form action={confirmTwoFactorSetup} className="grid gap-3">
                  <label className="grid max-w-xs gap-1 text-sm font-medium">
                    <span>Verification code</span>
                    <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" required className="text-lg tracking-[0.2em]" />
                  </label>
                  <Button className="justify-self-start" type="submit">Enable two-factor authentication</Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {enabled ? (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Recovery codes</CardTitle>
            <p className="text-sm text-muted-foreground">Recovery codes are one-time backup codes for signing in if your authenticator is unavailable.</p>
          </CardHeader>
          <CardContent>
            {recoveryCodes.length ? (
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                  <p className="text-sm font-semibold">Save these codes now. They will not be shown after you dismiss this box.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {recoveryCodes.map((recoveryCode) => (
                      <code key={recoveryCode} className="rounded-md border border-amber-200 bg-white/90 px-3 py-2 text-sm tracking-[0.12em] text-slate-950 dark:border-amber-900">
                        {recoveryCode}
                      </code>
                    ))}
                  </div>
                </div>
                <form action={dismissRecoveryCodes}>
                  <Button type="submit">I've saved these recovery codes</Button>
                </form>
              </div>
            ) : (
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>{unusedRecoveryCount} unused recovery code{unusedRecoveryCount === 1 ? "" : "s"} remaining.</p>
                <form action={regenerateRecoveryCodes}>
                  <Button type="submit" variant="secondary">Generate new recovery codes</Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" }) {
  const className =
    tone === "success"
      ? "border-water/30 bg-water/10 text-primary"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
        : "border-destructive/35 bg-destructive/10 text-destructive";
  return <div className={`max-w-4xl rounded-md border p-3 text-sm ${className}`}>{children}</div>;
}
