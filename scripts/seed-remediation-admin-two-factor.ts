import { createHmac } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { encryptTotpSecret } from "../src/lib/auth/totp";
const secret = "JBSWY3DPEHPK3PXP";
function code() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = []; for (let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(); const offset=hmac[hmac.length-1]&15;
  const binary=((hmac[offset]&127)<<24)|((hmac[offset+1]&255)<<16)|((hmac[offset+2]&255)<<8)|(hmac[offset+3]&255);
  return String(binary%1_000_000).padStart(6,"0");
}
async function main(){const email=process.env.REMEDIATION_ADMIN_EMAIL || "admin@remediation.invalid";const user=await prisma.user.update({where:{email},data:{serverRole:"SERVER_ADMIN"}});await prisma.userTwoFactor.upsert({where:{userId:user.id},update:{secretCiphertext:encryptTotpSecret(secret),enabledAt:new Date()},create:{userId:user.id,secretCiphertext:encryptTotpSecret(secret),enabledAt:new Date()}});console.log(code());}
main().finally(()=>prisma.$disconnect());
