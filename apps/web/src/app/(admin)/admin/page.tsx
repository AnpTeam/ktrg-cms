import { redirect } from "next/navigation";
import { initLingui } from "@/i18n/server";

// The admin home is the route list for now.
export default async function AdminHome() {
  await initLingui();
  redirect("/admin/routes");
}
