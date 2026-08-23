import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-primary">{brand.name}</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">Privacy policy</h1>
      <p className="mt-3 max-w-reading text-body text-muted-foreground">
        Last updated August 2026. {brand.legalEntity} operates {brand.name}. This page explains what we collect
        when you use it, why, and what happens to your information if you leave.
      </p>

      <div className="mt-10 space-y-8 max-w-reading text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your email address and a hashed password — we never store your password itself.</li>
            <li>
              If you set up a public identity, its display name and, if you add one, a short bio. You choose
              whether to write under your real name or a pseudonym.
            </li>
            <li>The drafts and notes you write.</li>
            <li>
              A random identifier stored on your device, used only to count unique readers of a note without
              tracking anyone across the web.
            </li>
            <li>Server logs, which include IP addresses, kept for security and abuse prevention.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Why</h2>
          <p className="mt-2">
            To run your account, show your writing back to you, let a moderator review what you submit, and keep
            the unique-reader count on published notes honest. Nothing here is used for advertising, and we don't
            sell it.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Who else sees it</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cloudflare Turnstile checks that a registration or comment is coming from a person, not a script.</li>
            <li>An email provider sends your account and password-reset emails.</li>
            <li>
              The Solana blockchain — a public, independent record anyone can check. When you publish a note, we
              commit a cryptographic fingerprint of its title, excerpt, and content to it, along with a timestamp.
              That's what lets anyone verify a note existed at a given moment, without taking our word for it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Once something is kept, it's kept</h2>
          <p className="mt-2">
            This part is worth reading slowly. Publishing is the one deliberate, irreversible step in{" "}
            {brand.name} — and it means what it says. A published note becomes a permanent public record.
            Deleting your account afterward does not retract it, and neither can we. If you write under a
            pseudonym, that byline stays attached to what you published under it, because a permanent record with
            no attribution would be unverifiable to anyone reading it later.
          </p>
          <p className="mt-2">
            Everything before that point is yours to undo. Drafts you never submitted, or never finished, are
            deleted along with your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Deleting your account</h2>
          <p className="mt-2">
            You can delete your account yourself, any time, from{" "}
            <Link to="/settings" className="text-primary underline">
              Settings
            </Link>{" "}
            or from{" "}
            <Link to="/delete-account" className="text-primary underline">
              noteschain.org/delete-account
            </Link>{" "}
            after signing in. Doing this:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Ends every signed-in session and disables your password for good.</li>
            <li>Replaces your email address with a placeholder, so it no longer appears on your active account.</li>
            <li>Deletes drafts you never published.</li>
            <li>Removes any public identity you set up that has nothing published under it.</li>
          </ul>
          <p className="mt-2">
            It does not retract anything you've already published, for the reason above. If you can't sign in to
            do this yourself, email{" "}
            <a href={`mailto:${brand.supportEmail}`} className="text-primary underline">
              {brand.supportEmail}
            </a>{" "}
            and we'll handle it.
          </p>
          <p className="mt-2">
            A small amount of operational data — things like the delivery record of an account email, or a log of
            a failed sign-in attempt — can outlive account deletion. We keep it for fraud prevention and our own
            records, not tied to your active account.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Children</h2>
          <p className="mt-2">
            {brand.name} isn't directed at children, and we don't knowingly collect information from anyone under
            13.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Changes and contact</h2>
          <p className="mt-2">
            We'll update this page if what we collect or how we use it changes. Questions go to{" "}
            <a href={`mailto:${brand.supportEmail}`} className="text-primary underline">
              {brand.supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
