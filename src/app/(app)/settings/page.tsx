import { redirect } from "next/navigation";

export default function LegacySettingsRedirect() {
  redirect("/server-maintenance");
}
