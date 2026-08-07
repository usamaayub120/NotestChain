import { Switch } from "@/components/ui/switch";
import { useSetCommentsEnabled } from "@/hooks/useComments";

export function CommentsEnabledToggle({ publicationId, commentsEnabled }: { publicationId: string; commentsEnabled: boolean }) {
  const setCommentsEnabled = useSetCommentsEnabled(publicationId);

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Switch
        checked={commentsEnabled}
        onCheckedChange={(checked) => setCommentsEnabled.mutate(checked)}
        disabled={setCommentsEnabled.isPending}
      />
      Comments {commentsEnabled ? "on" : "off"}
    </label>
  );
}
