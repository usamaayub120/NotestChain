import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PublicationWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAcknowledged(false);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>This will be permanent</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                Once published, this content will be stored on a public blockchain. It may remain publicly
                accessible even if it is later hidden or delisted from this website. The publication cannot be
                edited or deleted after finalization.
              </p>
              <p>
                It's the one promise nobody, including us, can go back on.{" "}
                <a
                  href="/how-it-works"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  See how keeping works
                </a>
                .
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          I understand this can't be undone.
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!acknowledged || isPending} onClick={onConfirm}>
            {isPending ? "Publishing…" : "Publish permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
