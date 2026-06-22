"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { useToast } from "@/components/common/Toast";
import { staffApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import type { Role, StaffMember } from "@/lib/types";

const ROLE_HINT: Record<Role, string> = {
  OWNER: "Full access, including staff + billing",
  MANAGER: "Operations, settings + staff",
  CASHIER: "POS, payments + reports",
  WAITER: "Order entry only",
};

function RoleBadge({ role }: { role: Role }) {
  const tone = role === "OWNER" ? "accent" : role === "MANAGER" ? "green" : "gray";
  return <Badge tone={tone}>{ROLE_LABELS[role]}</Badge>;
}

export function StaffManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const assignable = ASSIGNABLE_ROLES[user?.role ?? "WAITER"];

  const query = useQuery({ queryKey: ["staff"], queryFn: staffApi.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });
  const onError = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : "Action failed.", "error");

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: Role; isActive?: boolean }) =>
      staffApi.update(id, input),
    onSuccess: () => {
      refresh();
      toast("Staff updated.", "success");
    },
    onError,
  });

  const [addOpen, setAddOpen] = useState(false);

  if (query.isLoading) return <LoadingState label="Loading staff…" />;
  if (query.isError)
    return (
      <ErrorState
        message={query.error instanceof ApiError ? query.error.message : "Could not load staff."}
        onRetry={() => query.refetch()}
      />
    );

  const staff = query.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Each staff member signs in with their own email + password. Their role decides what
          they can do.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          Add staff
        </Button>
      </div>

      <div className="space-y-2">
        {staff.map((m) => {
          const isSelf = m.id === user?.id;
          const canManage = assignable.includes(m.role);
          return (
            <Card key={m.id} className={m.isActive ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {m.name || m.email}
                    {isSelf && <span className="ml-2 text-xs font-medium text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!m.isActive && <Badge tone="gray">Disabled</Badge>}
                  {canManage && !isSelf ? (
                    <select
                      value={m.role}
                      onChange={(e) => update.mutate({ id: m.id, role: e.target.value as Role })}
                      disabled={update.isPending}
                      aria-label={`Role for ${m.email}`}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                    >
                      {/* The member's current role is always listed, plus the ones you may assign. */}
                      {[...new Set([m.role, ...assignable])].map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                  {canManage && !isSelf && (
                    <Button
                      size="sm"
                      variant={m.isActive ? "ghost" : "secondary"}
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}
                    >
                      {m.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddStaffDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        assignable={assignable}
        onAdded={() => {
          refresh();
          setAddOpen(false);
        }}
      />
    </div>
  );
}

function AddStaffDialog({
  open,
  onClose,
  assignable,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  assignable: Role[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(assignable[assignable.length - 1] ?? "WAITER");

  const create = useMutation({
    mutationFn: () =>
      staffApi.create({ email: email.trim(), password, name: name.trim() || undefined, role }),
    onSuccess: () => {
      toast("Staff member added.", "success");
      setName("");
      setEmail("");
      setPassword("");
      onAdded();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not add staff.", "error"),
  });

  const valid = email.includes("@") && password.length >= 8;

  return (
    <ModalDialog open={open} onClose={onClose} title="Add staff member">
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@restaurant.com" />
        </div>
        <div>
          <Label>Temporary password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="≥ 8 characters"
          />
        </div>
        <div>
          <Label className="mb-2">Role</Label>
          <div className="space-y-1.5">
            {assignable.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 transition-colors hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="role"
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-0.5 h-4 w-4 text-accent-600 focus:ring-accent-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{ROLE_LABELS[r]}</span>
                  <span className="block text-xs text-slate-400">{ROLE_HINT[r]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            <ShieldCheck />
            {create.isPending ? "Adding…" : "Add staff"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
