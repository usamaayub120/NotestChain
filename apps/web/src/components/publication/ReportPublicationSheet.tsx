import { useState } from "react";
import { Flag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function ReportPublicationSheet({ publicationId }: { publicationId: string }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function submit() {
    setStatus("sending");
    try {
      await apiFetch(`/publications/${publicationId}/report`, { method: "POST", body: { reason } });
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <Flag size={16} /> Report
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Report this publication</SheetTitle>
        </SheetHeader>
        {status === "sent" ? (
          <p className="mt-4 text-sm text-muted-foreground">Thanks — a moderator will take a look.</p>
        ) : (
          <>
            <Textarea
              className="mt-4"
              rows={4}
              placeholder="What's wrong with this publication?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button className="mt-3 w-full" onClick={submit} disabled={!reason.trim() || status === "sending"}>
              {status === "sending" ? "Sending…" : "Send report"}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
