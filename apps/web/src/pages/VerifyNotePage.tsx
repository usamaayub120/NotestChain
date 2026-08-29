import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { NoteContent } from "@/components/note/NoteContent";
import { AuthorBadge } from "@/components/publication/AuthorBadge";
import { BlockchainProofSheet } from "@/components/publication/BlockchainProofSheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/Loader";
import { useProofLookup } from "@/hooks/usePublications";

export function VerifyNotePage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data, isFetching, isError } = useProofLookup(submitted, submitted.length > 0);

  return (
    <div className="mx-auto max-w-reading px-4 py-8">
      <h1 className="font-display text-3xl">Check a note’s public record</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a note URL, transaction signature, or record address. We’ll match it to the public record.
      </p>

      <form
        className="mt-6 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(input.trim());
        }}
      >
        <div className="flex-1">
          <label htmlFor="proof-input" className="mb-1 block text-sm font-medium">What do you want to verify?</label>
          <Input
            id="proof-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Note URL, signature, or address"
            aria-describedby="proof-help"
          />
        </div>
        <Button type="submit" disabled={!input.trim()}>
          <Search size={16} /> Look up
        </Button>
      </form>
      <p id="proof-help" className="mt-3 text-sm text-muted-foreground">You can paste a note link, a transaction signature, or a public record address.</p>

      {isFetching && (
        <div className="mt-8">
          <PageLoader label="Looking that up" />
        </div>
      )}

      {!isFetching && isError && (
        <p role="alert" className="mt-8 text-sm text-destructive">
          Something went wrong looking that up -  try again.
        </p>
      )}

      {!isFetching && data?.kind === "not_found" && (
        <p className="mt-8 text-sm text-muted-foreground">
          We couldn't find a note matching that. Double-check the URL, signature, or address.
        </p>
      )}

      {!isFetching && data?.kind === "publication" && (
        <article className="mt-8 border-t border-border pt-6">
          <h2 className="font-display text-2xl">{data.publication.title}</h2>
          <div className="mt-3">
            <AuthorBadge author={data.publication.author} timestamp={data.publication.createdAt} />
          </div>
          <NoteContent
            source={data.publication.content}
            format={data.publication.contentFormat ?? "PLAINTEXT"}
            className="mt-6 text-body leading-relaxed"
          />
          <div className="mt-6 flex items-center gap-4">
            <BlockchainProofSheet publication={data.publication} />
            <Link to={`/p/${data.publication.id}`} className="text-sm text-primary underline">
              Open this note's page
            </Link>
          </div>
        </article>
      )}

      {!isFetching && data?.kind === "onchain_only" && (
        <article className="mt-8 border-t border-border pt-6">
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            This on-chain record has no matching entry in our records -  it isn't a note published through this
            platform's normal review process. Showing only what's directly on-chain.
          </p>
          <h2 className="mt-4 font-display text-2xl">{data.account.title}</h2>
          {data.account.authorDisplaySnapshot && (
            <p className="mt-2 text-sm text-muted-foreground">{data.account.authorDisplaySnapshot}</p>
          )}
          <p className="mt-4 whitespace-pre-wrap text-body leading-relaxed">
            {data.account.content ?? data.account.excerpt}
          </p>
          {data.account.schemaVersion === 2 && (
            <p className="mt-3 text-xs text-muted-foreground">
              This is a v2 record -  only an excerpt and a content hash live on-chain; the full body isn't
              recoverable from here.
            </p>
          )}
          <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline">On-chain address: </dt>
              <dd className="inline font-mono">{data.account.pda}</dd>
            </div>
            <div>
              <dt className="inline">Content hash: </dt>
              <dd className="inline font-mono">{data.account.contentHash}</dd>
            </div>
          </dl>
          <a href={data.account.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary underline">
            View on Solana Explorer
          </a>
        </article>
      )}
    </div>
  );
}
