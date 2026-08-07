import { useState } from "react";
import { Link2, Share2, Twitter, Facebook, Linkedin, MessageCircle, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { buildPlatformShareLink, buildShareUrl } from "@/lib/shareLinks";

const PLATFORM_LINKS: { platform: "twitter" | "facebook" | "linkedin" | "whatsapp"; label: string; icon: typeof Twitter }[] = [
  { platform: "twitter", label: "X / Twitter", icon: Twitter },
  { platform: "facebook", label: "Facebook", icon: Facebook },
  { platform: "linkedin", label: "LinkedIn", icon: Linkedin },
  { platform: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function ShareSheet({ publicationId, title }: { publicationId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicationUrl = `${window.location.origin}/p/${publicationId}`;

  async function copyLink() {
    const url = buildShareUrl(publicationUrl, "copy_link");
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    const url = buildShareUrl(publicationUrl, "native_share");
    await navigator.share({ title, url });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <Share2 size={16} /> Share
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Share this publication</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? "Link copied" : "Copy link"}
          </button>

          {typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={nativeShare}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
            >
              <Share2 size={16} /> More options
            </button>
          )}

          {typeof navigator.share !== "function" &&
            PLATFORM_LINKS.map(({ platform, label, icon: Icon }) => (
              <a
                key={platform}
                href={buildPlatformShareLink(platform, buildShareUrl(publicationUrl, platform), title)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted"
              >
                <Icon size={16} /> {label}
              </a>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
