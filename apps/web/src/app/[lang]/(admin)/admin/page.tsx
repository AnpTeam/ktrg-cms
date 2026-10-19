import { redirect } from "next/navigation";
import { initLingui } from "@/i18n/server";
import { localePath } from "@/lib/rally";

// The admin home is the route list for now.
export default async function AdminHome() {
  const i18n = await initLingui();
  redirect(localePath(i18n.locale, "/admin/routes"));
}
