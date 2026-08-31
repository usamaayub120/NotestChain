import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { MutationError } from "@/components/admin/MutationError";
import { useCreateStaffInvitation, useStaffAccess, useUpdateStaffRoles, type StaffRole } from "@/hooks/useAdmin";

const assignable: Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER">[] = ["MODERATOR", "CAMPAIGN_CREATOR", "CAMPAIGN_APPROVER", "PLATFORM_ADMIN"];
const label = (role: StaffRole) => role.toLowerCase().replaceAll("_", " ");

export function StaffAccessPage() {
  const access = useStaffAccess();
  const invite = useCreateStaffInvitation();
  const updateRoles = useUpdateStaffRoles();
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER">[]>(["MODERATOR"]);
  const toggle = (role: Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER">) => setRoles((current) => current.includes(role) ? current.filter((value) => value !== role) : [...current, role]);
  const submit = () => invite.mutate({ email, roles }, { onSuccess: () => { setEmail(""); setRoles(["MODERATOR"]); } });
  return <div className="px-4 py-6 md:px-8"><AdminPageHeader title="Staff access" description="Invite staff and assign least-privilege roles. Passwords are always chosen by the invited person." />
    <section className="mt-6 max-w-2xl rounded-md border border-border bg-surface p-5"><h2 className="font-semibold">Invite staff member</h2><div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-10 rounded-md border border-input bg-background px-3" type="email" /></label><fieldset className="grid gap-2"><legend className="text-sm font-medium">Roles</legend>{assignable.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><input checked={roles.includes(role)} onChange={() => toggle(role)} type="checkbox" />{label(role)}</label>)}</fieldset><MutationError error={invite.error} /><Button className="w-fit" disabled={!email || roles.length === 0 || invite.isPending} onClick={submit}>{invite.isPending ? "Sending…" : "Send secure invitation"}</Button></div></section>
    {access.isLoading ? <div className="mt-6"><CardSkeletonList /></div> : <><section className="mt-8"><h2 className="font-semibold">Active staff</h2><div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface"><table className="w-full min-w-[48rem] text-sm"><thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3">Access</th></tr></thead><tbody>{access.data?.staff.map((member) => <tr className="border-b last:border-0" key={member.id}><td className="px-4 py-3">{member.email}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{member.roles.map((role) => <span className="rounded bg-muted px-2 py-0.5 text-xs" key={role}>{label(role)}</span>)}</div></td><td className="px-4 py-3 text-muted-foreground">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "Never"}</td><td className="px-4 py-3">{member.roles.includes("OWNER") || member.roles.includes("ACCESS_MANAGER") ? <span className="text-xs text-muted-foreground">Owner-managed</span> : <RoleEditor current={member.roles.filter((role): role is Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER"> => role !== "OWNER" && role !== "ACCESS_MANAGER")} onSave={(next) => updateRoles.mutate({ id: member.id, roles: next })} busy={updateRoles.isPending} />}</td></tr>)}</tbody></table></div></section><section className="mt-8"><h2 className="font-semibold">Pending invitations</h2><div className="mt-3 rounded-md border border-border bg-surface">{access.data?.invitations.length ? access.data.invitations.map((item) => <div className="border-b px-4 py-3 last:border-0" key={item.id}><p className="font-medium">{item.email}</p><p className="mt-1 text-xs text-muted-foreground">{item.roles.map(label).join(", ")} · expires {new Date(item.expiresAt).toLocaleString()}</p></div>) : <p className="p-4 text-sm text-muted-foreground">No pending invitations.</p>}</div></section></>}</div>;
}

function RoleEditor({ current, onSave, busy }: { current: Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER">[]; onSave: (roles: Exclude<StaffRole, "ACCESS_MANAGER" | "OWNER">[]) => void; busy: boolean }) {
  const [roles, setRoles] = useState(current);
  return <div className="flex flex-wrap items-center gap-2">{assignable.map((role) => <label className="text-xs" key={role}><input className="mr-1" type="checkbox" checked={roles.includes(role)} onChange={() => setRoles((value) => value.includes(role) ? value.filter((entry) => entry !== role) : [...value, role])} />{label(role)}</label>)}<Button size="sm" variant="outline" disabled={roles.length === 0 || busy} onClick={() => onSave(roles)}>Save</Button></div>;
}
