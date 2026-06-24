import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function IndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = user.app_metadata?.role || user.user_metadata?.role || "staff";
  redirect(`/${role}`);
}
