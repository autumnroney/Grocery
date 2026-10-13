// Basketwise admin API (Supabase Edge Function).
//
// The browser sends the signed-in user's access token. This function checks
// who they are and what role they have (public.user_roles) on every request,
// then does the work with the project's secret key, which never leaves the
// server. Every change is written to public.admin_audit_log.
//
// Roles:
//   admin     everything below plus roles, passwords, emails, suspensions,
//             sign-outs, deleting and inviting users
//   employee  read-only console (overview, health, users, audit log) and can
//             email a user a sign-in link
//   customer  no access
//
// Deployed with verify_jwt = false because the token is verified here
// (auth.getUser) so it works with both legacy and new signing keys.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

type Role = "admin" | "employee" | "customer";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function readKey(jsonVar: string, legacyVar: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(jsonVar) ?? "{}");
    if (keys.default) return keys.default;
  } catch (_) { /* fall back to the legacy key */ }
  return Deno.env.get(legacyVar)!;
}
const SECRET_KEY = readKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = readKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES: Role[] = ["admin", "employee", "customer"];
const EMPLOYEE_ACTIONS = new Set(["me", "status", "users", "audit", "send_link"]);
const ADMIN_ACTIONS = new Set([
  ...EMPLOYEE_ACTIONS,
  "set_role", "set_password", "update_email", "suspend", "unsuspend", "revoke_sessions", "delete_user", "invite",
]);
// About 100 years: Supabase's way of saying "suspended until unsuspended".
const SUSPEND_DURATION = "876000h";

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function roleOf(userId: string): Promise<Role> {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, "Couldn't check your role: " + error.message);
  return (data?.role as Role) ?? "customer";
}

async function audit(actor: User, action: string, target: User | null, details: Record<string, unknown> = {}) {
  await admin.from("admin_audit_log").insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target_id: target?.id ?? null,
    target_email: target?.email ?? null,
    details,
  });
}

async function getTarget(userId: unknown): Promise<User> {
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) throw new HttpError(400, "Missing or invalid user_id.");
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new HttpError(404, "User not found.");
  return data.user;
}

async function adminCount(): Promise<number> {
  const { count, error } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

// Admins can't lock themselves out, and the site always keeps one admin.
async function guardSelfAndLastAdmin(actor: User, target: User, what: string) {
  if (actor.id === target.id) throw new HttpError(400, `You can't ${what} your own account here.`);
  if ((await roleOf(target.id)) === "admin" && (await adminCount()) <= 1) {
    throw new HttpError(400, `That's the only admin. Make someone else an admin before you ${what} this account.`);
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true, ms: Math.round(performance.now() - start), value };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
  }
}

async function listAllUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw new HttpError(500, error.message);
    users.push(...data.users);
    if (data.users.length < 500) break;
  }
  return users;
}

const actions: Record<string, (actor: User, role: Role, body: Record<string, unknown>, req: Request) => Promise<unknown>> = {
  async me(actor, role) {
    return { id: actor.id, email: actor.email, role };
  },

  async status() {
    const db = await timed(async () => {
      const { data, error } = await admin.rpc("admin_system_status");
      if (error) throw new Error(error.message);
      return data;
    });
    const auth = await timed(async () => {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    });
    const users = await timed(async () => {
      const all = await listAllUsers();
      const now = Date.now(), day = 86400000;
      return {
        total: all.length,
        new_7d: all.filter((u) => now - Date.parse(u.created_at) < 7 * day).length,
        active_7d: all.filter((u) => u.last_sign_in_at && now - Date.parse(u.last_sign_in_at) < 7 * day).length,
        active_30d: all.filter((u) => u.last_sign_in_at && now - Date.parse(u.last_sign_in_at) < 30 * day).length,
        unconfirmed: all.filter((u) => !u.email_confirmed_at).length,
        suspended: all.filter((u) => u.banned_until && Date.parse(u.banned_until) > now).length,
      };
    });
    const { data: roleRows } = await admin.from("user_roles").select("role");
    const roles: Record<string, number> = { admin: 0, employee: 0, customer: 0 };
    (roleRows ?? []).forEach((r: { role: string }) => { roles[r.role] = (roles[r.role] ?? 0) + 1; });
    return {
      checked_at: new Date().toISOString(),
      database: { ok: db.ok, latency_ms: db.ms, error: db.error, ...(db.value as Record<string, unknown> ?? {}) },
      auth: { ok: auth.ok, latency_ms: auth.ms, error: auth.error, version: (auth.value as { version?: string })?.version },
      functions: { ok: true, region: Deno.env.get("SB_REGION") ?? null },
      users: users.value ?? null,
      roles,
    };
  },

  async users() {
    const [all, profiles, roles, plans] = await Promise.all([
      listAllUsers(),
      admin.from("profiles").select("id, display_name, household_size, carb_goal, diet, preferred_store, zip_code, updated_at"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("plans").select("user_id, data, updated_at"),
    ]);
    for (const r of [profiles, roles, plans]) if (r.error) throw new HttpError(500, r.error.message);
    const byId = <T extends Record<string, unknown>>(rows: T[], key: string) => new Map(rows.map((r) => [r[key] as string, r]));
    const p = byId(profiles.data ?? [], "id");
    const r = byId(roles.data ?? [], "user_id");
    const pl = byId(plans.data ?? [], "user_id");
    return all.map((u) => {
      const plan = pl.get(u.id) as { data?: { plan?: unknown[] }; updated_at?: string } | undefined;
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: u.banned_until ?? null,
        providers: (u.app_metadata?.providers as string[] | undefined) ?? [],
        role: (r.get(u.id)?.role as Role) ?? "customer",
        profile: p.get(u.id) ?? null,
        plan: plan ? { meals: Array.isArray(plan.data?.plan) ? plan.data!.plan!.length : 0, updated_at: plan.updated_at } : null,
      };
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  },

  async audit() {
    const { data, error } = await admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async send_link(actor, _role, body, req) {
    const target = await getTarget(body.user_id);
    if (!target.email) throw new HttpError(400, "This user has no email address.");
    const origin = req.headers.get("origin");
    const publicClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { error } = await publicClient.auth.signInWithOtp({
      email: target.email,
      options: { shouldCreateUser: false, emailRedirectTo: origin ? `${origin}/plan.html` : undefined },
    });
    if (error) throw new HttpError(400, error.message);
    await audit(actor, "send_sign_in_link", target);
    return { sent: true };
  },

  async set_role(actor, _role, body) {
    const target = await getTarget(body.user_id);
    const role = body.role as Role;
    if (!ROLES.includes(role)) throw new HttpError(400, "Role must be admin, employee or customer.");
    const current = await roleOf(target.id);
    if (current === role) return { role };
    if (current === "admin" && (await adminCount()) <= 1) {
      throw new HttpError(400, "That's the only admin. Make someone else an admin first.");
    }
    const { error } = await admin.from("user_roles").upsert({ user_id: target.id, role, updated_by: actor.id });
    if (error) throw new HttpError(500, error.message);
    await audit(actor, "set_role", target, { from: current, to: role });
    return { role };
  },

  async set_password(actor, _role, body) {
    const target = await getTarget(body.user_id);
    const password = String(body.password ?? "");
    if (password.length < 8 || password.length > 72) throw new HttpError(400, "Password must be 8 to 72 characters.");
    const { error } = await admin.auth.admin.updateUserById(target.id, { password });
    if (error) throw new HttpError(400, error.message);
    await audit(actor, "set_password", target);
    return { updated: true };
  },

  async update_email(actor, _role, body) {
    const target = await getTarget(body.user_id);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "That email address doesn't look right.");
    const { error } = await admin.auth.admin.updateUserById(target.id, { email, email_confirm: true });
    if (error) throw new HttpError(400, error.message);
    await audit(actor, "update_email", target, { from: target.email, to: email });
    return { email };
  },

  async suspend(actor, _role, body) {
    const target = await getTarget(body.user_id);
    await guardSelfAndLastAdmin(actor, target, "suspend");
    const { error } = await admin.auth.admin.updateUserById(target.id, { ban_duration: SUSPEND_DURATION });
    if (error) throw new HttpError(400, error.message);
    await admin.rpc("admin_revoke_sessions", { target: target.id });
    await audit(actor, "suspend", target);
    return { suspended: true };
  },

  async unsuspend(actor, _role, body) {
    const target = await getTarget(body.user_id);
    const { error } = await admin.auth.admin.updateUserById(target.id, { ban_duration: "none" });
    if (error) throw new HttpError(400, error.message);
    await audit(actor, "unsuspend", target);
    return { suspended: false };
  },

  async revoke_sessions(actor, _role, body) {
    const target = await getTarget(body.user_id);
    const { data, error } = await admin.rpc("admin_revoke_sessions", { target: target.id });
    if (error) throw new HttpError(500, error.message);
    await audit(actor, "sign_out_everywhere", target, { sessions_removed: data });
    return { sessions_removed: data };
  },

  async delete_user(actor, _role, body) {
    const target = await getTarget(body.user_id);
    await guardSelfAndLastAdmin(actor, target, "delete");
    if (body.confirm_email !== target.email) throw new HttpError(400, "Type the user's email to confirm.");
    const { error } = await admin.auth.admin.deleteUser(target.id);
    if (error) throw new HttpError(400, error.message);
    await audit(actor, "delete_user", target);
    return { deleted: true };
  },

  async invite(actor, _role, body, req) {
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = (body.role as Role) ?? "customer";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "That email address doesn't look right.");
    if (!ROLES.includes(role)) throw new HttpError(400, "Role must be admin, employee or customer.");
    const origin = req.headers.get("origin");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/plan.html` : undefined,
    });
    if (error) throw new HttpError(400, error.message);
    if (role !== "customer") {
      const res = await admin.from("user_roles").upsert({ user_id: data.user.id, role, updated_by: actor.id });
      if (res.error) throw new HttpError(500, res.error.message);
    }
    await audit(actor, "invite", data.user, { role });
    return { id: data.user.id, email, role };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Please sign in.");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
    const actor = authData.user;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const handler = actions[action];
    if (!handler) throw new HttpError(400, `Unknown action "${action}".`);

    const role = await roleOf(actor.id);
    const allowed = role === "admin" ? ADMIN_ACTIONS : role === "employee" ? EMPLOYEE_ACTIONS : new Set(["me"]);
    if (!allowed.has(action)) {
      throw new HttpError(403, role === "employee" ? "Only admins can do that." : "You don't have access to the admin console.");
    }
    return json({ data: await handler(actor, role, body, req) });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Something went wrong.";
    if (status >= 500) console.error(e);
    return json({ error: message }, status);
  }
});
