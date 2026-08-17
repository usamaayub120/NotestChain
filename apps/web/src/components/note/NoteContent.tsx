import { Fragment, type ReactNode } from "react";
import { parseNoteMarkdown, type InlineNode } from "@noteschain/shared";
import { cn } from "@/lib/utils";

export type NoteFormat = "PLAINTEXT" | "MARKDOWN";

/**
 * The single render path for note bodies.
 *
 * It builds React elements from the parser's token tree and never produces an
 * HTML string, so `dangerouslySetInnerHTML` is not involved and script
 * injection is structurally impossible rather than filtered out. React
 * escapes every text node on the way in; there is no path by which a note's
 * characters become markup.
 */

function renderInline(nodes: InlineNode[], shimmer: boolean, keyPrefix = ""): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    if (node.type === "text") return <Fragment key={key}>{node.value}</Fragment>;

    const children = renderInline(node.children, shimmer, `${key}.`);

    // <strong>/<em>, never <b>/<i> — bold and italic here carry the author's
    // emphasis, which is semantic and should reach a screen reader as such.
    if (node.type === "strong") return <strong key={key}>{children}</strong>;
    if (node.type === "em") return <em key={key}>{children}</em>;

    return (
      <mark key={key} className={shimmer ? "animate-shimmer mark-shimmer" : undefined}>
        {children}
      </mark>
    );
  });
}

export function NoteContent({
  source,
  format,
  shimmer = false,
  className,
}: {
  source: string;
  /**
   * Defaults to PLAINTEXT when absent. That direction is deliberate: every
   * note published before markdown shipped is immutable and already hashed,
   * so one containing `*asterisks*` must keep rendering as asterisks. A code
   * path that forgets to pass this shows the writer's characters as typed
   * rather than silently reinterpreting a permanent record.
   */
  format?: NoteFormat;
  /** Reader and editor preview only — see the note below. */
  shimmer?: boolean;
  className?: string;
}) {
  if (format !== "MARKDOWN") {
    return <div className={cn("whitespace-pre-wrap", className)}>{source}</div>;
  }

  const blocks = parseNoteMarkdown(source);

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <p key={index} className={cn("whitespace-pre-wrap", index > 0 && "mt-4")}>
          {renderInline(block.children, shimmer)}
        </p>
      ))}
    </div>
  );
}
