import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBookmarks, useAddBookmark, useRemoveBookmark } from "@/hooks/useBookmarks";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function BookmarkButton({ publicationId }: { publicationId: string }) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const { data: bookmarks } = useBookmarks();
  const add = useAddBookmark();
  const remove = useRemoveBookmark();

  const isBookmarked = !!bookmarks?.some((b) => b.publication.id === publicationId);

  function toggle() {
    if (!user) {
      navigate(`/login?next=/p/${publicationId}`);
      return;
    }
    if (isBookmarked) remove.mutate(publicationId);
    else add.mutate(publicationId);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isBookmarked}
      aria-label={isBookmarked ? "Remove bookmark" : "Save for later"}
      className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
    >
      <Heart size={18} className={cn(isBookmarked && "fill-primary text-primary")} />
      {isBookmarked ? "Saved" : "Save"}
    </button>
  );
}
