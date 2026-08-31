import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { apiFetch, ApiClientError } from "@/lib/api";

/**
 * The raw invitation token stays in the URL only until this authenticated
 * acceptance call. The API compares its server-side hash and never returns
 * it to the browser or an admin.
 */
export function StaffInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const currentUser = useCurrentUser();
  const accept = useMutation({ mutationFn: () => apiFetch<{ accepted: boolean }>("/admin/access/invitations/accept", { method: "POST", body: { token } }) });
  const next = `/access/invitation?token=${encodeURIComponent(token)}`;

  if (!token) return <InvitationFrame title="This invitation link is incomplete." detail="Ask the person who invited you to send a new secure invitation." />;
  if (currentUser.isLoading) return <InvitationFrame title="Checking your invitation…" detail="" />;
  if (!currentUser.data) {
    return <InvitationFrame title="You’ve been invited to staff access" detail="Sign in with the invited email address, or create an account with that address and accept the Terms of Service. You choose your own password.">
      <div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></Button><Button variant="outline" asChild><Link to={`/register?next=${encodeURIComponent(next)}`}>Create account</Link></Button></div>
    </InvitationFrame>;
  }
  if (accept.isSuccess) return <InvitationFrame title="Staff access accepted" detail="Your permissions are active. You can now continue to the staff area."><div className="mt-6"><Button asChild><Link to="/admin">Continue</Link></Button></div></InvitationFrame>;
  const error = accept.error instanceof ApiClientError ? accept.error.message : accept.error ? "We could not accept this invitation." : null;
  return <InvitationFrame title="Accept staff access" detail={`You are signed in as ${currentUser.data.email}. Accept only if this is the address that received the invitation.`}>
    {error && <p className="mt-4 text-sm font-medium text-destructive" role="alert">{error}</p>}
    <div className="mt-6"><Button disabled={accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? "Accepting…" : "Accept invitation"}</Button></div>
  </InvitationFrame>;
}

function InvitationFrame({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[65dvh] max-w-lg items-center px-4 py-10"><section className="w-full rounded-lg border border-border bg-surface p-6 shadow-sm"><p className="text-sm font-medium text-primary">NotesChain staff access</p><h1 className="mt-2 text-2xl">{title}</h1>{detail && <p className="mt-3 leading-6 text-muted-foreground">{detail}</p>}{children}</section></div>;
}
