import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { useDeleteAccount } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

/** Reused on both the authenticated Settings page and the public /delete-account page. */
export function DeleteAccountSection() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string>();
  const deleteAccount = useDeleteAccount();

  async function handleConfirm() {
    setError(undefined);
    try {
      await deleteAccount.mutateAsync({ password });
      navigate("/");
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-lg text-foreground">Delete your account</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This closes your account for good -  every session ends, your password stops working, and unfinished
        drafts are deleted with it. Notes you've already published stay published; that's the one thing account
        deletion can't undo.
      </p>

      <div className="mt-4 max-w-xs space-y-2">
        <label htmlFor="delete-account-password" className="text-sm font-medium text-foreground">
          Confirm your password
        </label>
        <Input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button variant="destructive" className="mt-4" disabled={!password} onClick={() => setConfirmOpen(true)}>
        Delete account
      </Button>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your account?"
        description="Ends every session and disables sign-in immediately. This can't be undone."
        confirmLabel="Delete account"
        pendingLabel="Deleting…"
        isPending={deleteAccount.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
