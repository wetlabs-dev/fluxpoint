import {
  decryptRecoveryCodes,
  decryptTotpSecret,
  encryptRecoveryCodes,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  totpProvisioningUri,
  verifyTotp
} from "../src/lib/auth/totp";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

process.env.TOTP_ENCRYPTION_KEY ||= "fluxpoint-two-factor-check-key";

const secret = generateTotpSecret();
assert(/^[A-Z2-7]+$/.test(secret), "Generated TOTP secret should be base32.");
assert(decryptTotpSecret(encryptTotpSecret(secret)) === secret, "Encrypted TOTP secret should round-trip.");
assert(totpProvisioningUri("keeper@example.com", secret).includes("issuer=Fluxpoint"), "Provisioning URI should identify Fluxpoint.");
assert(!verifyTotp(secret, "not-a-code"), "Non-numeric TOTP input should not verify.");

const recoveryCodes = generateRecoveryCodes();
assert(recoveryCodes.length === 10, "Default recovery code batch should contain 10 codes.");
assert(decryptRecoveryCodes(encryptRecoveryCodes(recoveryCodes))[0] === recoveryCodes[0], "Encrypted recovery codes should round-trip.");
assert(normalizeRecoveryCode("abcd-1234 efgh") === "ABCD1234EFGH", "Recovery codes should normalize case and separators.");
assert(hashRecoveryCode("abcd-1234") === hashRecoveryCode("ABCD1234"), "Recovery code hashes should ignore separators and case.");

console.log("Two-factor authentication checks passed.");
