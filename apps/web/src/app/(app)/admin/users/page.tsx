"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import {
  ActivePill,
  CheckboxField,
  Field,
  FormError,
  Modal,
  ModalActions,
  describeError,
  inputClass,
  normalizeCode,
} from "@/components/admin/kit";
import { useFactoriesList, type LiveFactory } from "@/features/factories/hooks";
import {
  useCreateUser,
  useResetCredentials,
  useUpdateUser,
  useUsersList,
  type LiveUser,
  type UserRole,
} from "@/features/people/hooks";
import { validateSecret } from "@/features/people/validation";
import { formatDateTime } from "@/lib/time";

const ROLES: UserRole[] = ["admin", "manager", "operator"];
const ROLE_LABEL: Record<UserRole, string> = { admin: "Admin", manager: "Manager", operator: "Operator" };
const ROLE_COLOR: Record<UserRole, string> = {
  admin: "var(--accent)",
  manager: "var(--status-maintenance)",
  operator: "var(--muted)",
};

function RolePill({ role }: { role: UserRole }) {
  const color = ROLE_COLOR[role];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function FactoryPicker({
  factories,
  value,
  onChange,
}: {
  factories: LiveFactory[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  if (factories.length <= 1) return null;
  return (
    <fieldset className="space-y-1">
      <legend className="text-xs text-[var(--muted)]">Factories</legend>
      {factories.map((f) => (
        <CheckboxField
          key={f.id}
          label={f.name}
          checked={value.includes(f.id)}
          onChange={(on) => onChange(on ? [...value, f.id] : value.filter((x) => x !== f.id))}
        />
      ))}
    </fieldset>
  );
}

function SecretPair({
  mode,
  a,
  b,
  onA,
  onB,
}: {
  mode: "pin" | "password";
  a: string;
  b: string;
  onA: (v: string) => void;
  onB: (v: string) => void;
}) {
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  const clean = (v: string) => (mode === "pin" ? digits(v) : v);
  const label = mode === "pin" ? "6-digit PIN" : "Password (12+ characters)";
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={label}>
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          inputMode={mode === "pin" ? "numeric" : undefined}
          value={a}
          onChange={(e) => onA(clean(e.target.value))}
        />
      </Field>
      <Field label="Type it again">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          inputMode={mode === "pin" ? "numeric" : undefined}
          value={b}
          onChange={(e) => onB(clean(e.target.value))}
        />
      </Field>
    </div>
  );
}

function UserModal({ user, factories, onClose }: { user?: LiveUser; factories: LiveFactory[]; onClose: () => void }) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [role, setRole] = useState<UserRole>(user?.role ?? "operator");
  const [name, setName] = useState(user?.name ?? "");
  const [factoryIds, setFactoryIds] = useState<string[]>(user?.factoryIds ?? []);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [secretA, setSecretA] = useState("");
  const [secretB, setSecretB] = useState("");
  const [active, setActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const ids = factories.length === 1 ? [factories[0].id] : factoryIds;
  const mode = role === "operator" ? "pin" : "password";

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    if (ids.length === 0) return setError("Choose at least one factory.");
    const handlers = { onSuccess: onClose, onError: (e: unknown) => setError(describeError(e)) };

    if (user) {
      update.mutate({ id: user.id, patch: { name: name.trim(), isActive: active, factoryIds: ids } }, handlers);
      return;
    }
    const secretError = validateSecret(mode, secretA, secretB);
    if (secretError) return setError(secretError);

    if (role === "operator") {
      const c = normalizeCode(code);
      if (!/^[A-Z0-9-]{2,20}$/.test(c)) return setError("The employee code needs 2 to 20 letters, numbers or dashes.");
      create.mutate({ role, name: name.trim(), factoryIds: ids, employeeCode: c, pin: secretA }, handlers);
    } else {
      const mail = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return setError("Enter a valid email address.");
      create.mutate({ role, name: name.trim(), factoryIds: ids, email: mail, password: secretA }, handlers);
    }
  };

  return (
    <Modal
      title={user ? "Edit user" : "New user"}
      description={user ? `${ROLE_LABEL[user.role]} · ${user.email ?? user.employeeCode ?? ""}` : undefined}
      onClose={onClose}
    >
      {!user && (
        <Field label="Role">
          <select
            className={inputClass}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as UserRole);
              setSecretA("");
              setSecretB("");
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Full name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      {!user && role === "operator" && (
        <Field label="Employee code" hint="Letters, numbers, dashes. Shown in reports.">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        </Field>
      )}
      {!user && role !== "operator" && (
        <Field label="Email (they sign in with this)">
          <input className={inputClass} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
      {!user && <SecretPair mode={mode} a={secretA} b={secretB} onA={setSecretA} onB={setSecretB} />}
      <FactoryPicker factories={factories} value={factoryIds} onChange={setFactoryIds} />
      {user && <CheckboxField checked={active} onChange={setActive} label="Active" />}
      {user && user.isActive && !active && (
        <p className="text-sm text-[var(--status-idle)]">They will be signed out everywhere straight away.</p>
      )}
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        submitLabel={user ? "Save" : "Create user"}
      />
    </Modal>
  );
}

function ResetModal({ user, onClose }: { user: LiveUser; onClose: () => void }) {
  const reset = useResetCredentials();
  const mode = user.role === "operator" ? "pin" : "password";
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const problem = validateSecret(mode, a, b);
    if (problem) return setError(problem);
    reset.mutate(
      { id: user.id, secret: mode === "pin" ? { pin: a } : { password: a } },
      { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
    );
  };

  return (
    <Modal
      title={mode === "pin" ? "Reset PIN" : "Reset password"}
      description={`${user.name}: they will be signed out everywhere and any lock is cleared. Give them the new ${mode === "pin" ? "PIN" : "password"} in person.`}
      onClose={onClose}
    >
      <SecretPair mode={mode} a={a} b={b} onA={setA} onB={setB} />
      <FormError message={error} />
      <ModalActions onCancel={onClose} onSubmit={submit} busy={reset.isPending} submitLabel="Reset" />
    </Modal>
  );
}

export default function UsersPage() {
  const list = useUsersList();
  const factories = useFactoriesList().data ?? [];
  const [role, setRole] = useState<UserRole | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<{ user?: LiveUser } | null>(null);
  const [reset, setReset] = useState<LiveUser | null>(null);

  const all = list.data ?? [];
  const counts: Record<string, number> = { all: all.length };
  for (const r of ROLES) counts[r] = all.filter((u) => u.role === r).length;

  const rows = all
    .filter((u) => (role === "all" || u.role === role) && (showInactive || u.isActive))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));

  const columns = useMemo<ColumnDef<LiveUser, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-[var(--muted)]">
              {row.original.email ?? `Code ${row.original.employeeCode ?? ""}`}
            </span>
          </div>
        ),
      },
      { id: "role", header: "Role", cell: ({ row }) => <RolePill role={row.original.role} /> },
      {
        id: "last",
        header: "Last sign-in",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : "Never"}</span>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <ActivePill active={row.original.isActive} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEdit({ user: row.original })}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReset(row.original)}>
              {row.original.role === "operator" ? "Reset PIN" : "Reset password"}
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Admins, managers and operators. Nobody is ever deleted, only deactivated.</p>
        </div>
        <Button variant="primary" onClick={() => setEdit({})}>
          New user
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={role === "all" ? "primary" : "secondary"} onClick={() => setRole("all")}>
          All · {counts.all}
        </Button>
        {ROLES.map((r) => (
          <Button key={r} size="sm" variant={role === r ? "primary" : "secondary"} onClick={() => setRole(r)}>
            {ROLE_LABEL[r]}s · {counts[r]}
          </Button>
        ))}
        <span className="ml-2">
          <CheckboxField checked={showInactive} onChange={setShowInactive} label="Show inactive" />
        </span>
      </div>

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load users." onRetry={() => list.refetch()} />
      ) : (
        <DataTable data={rows} columns={columns} emptyTitle="No users match" />
      )}

      {edit && <UserModal user={edit.user} factories={factories} onClose={() => setEdit(null)} />}
      {reset && <ResetModal user={reset} onClose={() => setReset(null)} />}
    </div>
  );
}