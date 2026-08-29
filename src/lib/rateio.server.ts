import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminSession = { admin?: boolean };

const sessionConfig = {
  password: process.env["SESSION_SECRET"] ?? "dev-only-session-secret-please-set-32chars",
  name: "newtech-admin",
  maxAge: 60 * 60 * 12,
  cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
};

export function getAdminSession() {
  return useSession<AdminSession>(sessionConfig);
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.data.admin) throw new Error("Acesso restrito ao administrador.");
  return session;
}

export function hashSecret(value: string, salt?: string) {
  const s = salt ?? randomBytes(8).toString("hex");
  const h = createHash("sha256").update(s + value, "utf8").digest("hex");
  return `${s}:${h}`;
}

export function verifySecret(value: string, stored: string) {
  const [salt] = stored.split(":");
  if (!salt) return false;
  const a = Buffer.from(hashSecret(value, salt));
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const db = supabaseAdmin;

export type PublicSignup = {
  id: string;
  name: string;
  phone: string;
  quantity: number;
  status: string;
  created_at: string;
};

export type PublicProduct = {
  id: string;
  name: string;
  total_value: number;
  units_per_batch: number;
  closed_batches: number;
  reserved: number;
  signups: PublicSignup[];
};

export async function loadPublicData() {
  const [{ data: products, error: pe }, { data: signups, error: se }, settings] = await Promise.all([
    db.from("products").select("*").order("created_at", { ascending: true }),
    db.from("signups").select("id,product_id,name,phone,quantity,status,created_at").order("created_at", { ascending: true }),
    loadSettings(),
  ]);
  if (pe) throw new Error(pe.message);
  if (se) throw new Error(se.message);

  const list: PublicProduct[] = (products ?? []).map((p) => {
    const rows = (signups ?? []).filter((s) => s.product_id === p.id);
    return {
      id: p.id,
      name: p.name,
      total_value: Number(p.total_value),
      units_per_batch: p.units_per_batch,
      closed_batches: p.closed_batches,
      reserved: rows.reduce((acc, r) => acc + r.quantity, 0),
      signups: rows.map(({ product_id: _pid, ...r }) => r),
    };
  });

  return { products: list, settings };
}

export async function loadSettings() {
  const { data, error } = await db
    .from("settings")
    .select("pix_key,card_link,whatsapp,payment_days")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { pix_key: "", card_link: "", whatsapp: "", payment_days: 5 };
}

export async function loadAdminData() {
  const [{ data: products, error: pe }, { data: signups, error: se }, settings] = await Promise.all([
    db.from("products").select("*").order("created_at", { ascending: true }),
    db.from("signups").select("id,product_id,name,email,phone,quantity,status,created_at").order("created_at", { ascending: true }),
    loadSettings(),
  ]);
  if (pe) throw new Error(pe.message);
  if (se) throw new Error(se.message);
  return {
    settings,
    products: (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      total_value: Number(p.total_value),
      units_per_batch: p.units_per_batch,
      closed_batches: p.closed_batches,
      signups: (signups ?? []).filter((s) => s.product_id === p.id),
    })),
  };
}
