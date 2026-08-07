import { PenSquare, ShieldCheck, Check, ScanSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { VerificationBadge } from "@/components/publication/VerificationBadge";

const STEPS = [
  {
    icon: PenSquare,
    title: "Write privately",
    body: "Everything starts as a draft. It autosaves as you go, and no one else can see it until you decide to submit it.",
  },
  {
    icon: ShieldCheck,
    title: "A person checks it",
    body: "A moderator reads it before it can go any further — a quick check for the obvious stuff, not a review of your ideas.",
  },
  {
    icon: Check,
    title: "You decide when",
    body: "Nothing happens on its own. You confirm publishing yourself, and that's the one step here you can't take back.",
  },
  {
    icon: null,
    title: "It's kept on Solana",
    body: "Not stored on one company's server — kept across many independent computers, the same way. No one, including us, can quietly edit or delete it afterward.",
  },
  {
    icon: ScanSearch,
    title: "Anyone can verify it",
    body: "The verification mark on a publication links straight to the public record. You don't have to take our word for it — you can look yourself.",
  },
] as const;

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-primary">{brand.name}</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">How it works</h1>
      <p className="mt-3 max-w-reading text-body text-muted-foreground">
        A notebook that occasionally lets a thought out into the world. Here's what actually happens between
        writing something and it becoming a public, permanent record.
      </p>

      <ol className="mt-10 space-y-8">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                {step.icon ? <step.icon size={18} className="text-foreground" /> : <VerificationBadge status="FINALIZED" size={20} />}
              </span>
              {i < STEPS.length - 1 && <span aria-hidden="true" className="mt-2 h-full w-px flex-1 bg-border" />}
            </div>
            <div className="pb-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
              <h2 className="mt-1 text-lg">{step.title}</h2>
              <p className="mt-1 max-w-reading text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 border-t border-border pt-6">
        <p className="text-muted-foreground">
          Curious what's actually been kept?{" "}
          <Link to="/explore" className="text-primary underline">
            Explore what's been published
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
