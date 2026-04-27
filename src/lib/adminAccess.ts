import { supabase } from "@/integrations/supabase/client";

type RoleRow = { role: string };

export async function verifyAdminAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!error) {
    return ((data as RoleRow[] | null) ?? []).some((row) => row.role === "admin");
  }

  const { data: fallback, error: fallbackError } = await supabase.functions.invoke("verify-admin-access", {
    body: {},
  });

  if (fallbackError) {
    throw fallbackError;
  }

  return Boolean((fallback as { isAdmin?: boolean } | null)?.isAdmin);
}