import { brand } from "@noteschain/shared";

export function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-primary">{brand.name}</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">Terms of service</h1>
      <p className="mt-3 max-w-reading text-body text-muted-foreground">
        Last updated August 2026. These are the terms between you and {brand.legalEntity}, which operates{" "}
        {brand.name}, for using the site and app.
      </p>

      <div className="mt-10 space-y-8 max-w-reading text-muted-foreground">
        <section>
          <h2 className="text-lg text-foreground">Using {brand.name}</h2>
          <p className="mt-2">
            By creating an account, you agree to these terms and to the{" "}
            <a href="/privacy" className="text-primary underline">
              privacy policy
            </a>
            . If you don't agree, don't use {brand.name}.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">What you can publish</h2>
          <p className="mt-2">
            Write what you want, but not anything illegal, anything designed to harass or endanger someone, or
            anything impersonating a person or organization you're not. A moderator reads every submission before
            it can be published -  not a review of your ideas, just a check for the obvious stuff.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Permanence</h2>
          <p className="mt-2">
            Publishing is deliberate and irreversible. Once a note is published, it's kept as a permanent public
            record -  notarized independently of {brand.name}, verifiable by anyone. Neither you nor we can edit
            or remove it afterward. Make sure you mean it before you confirm.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Your account</h2>
          <p className="mt-2">
            You're responsible for what's published under it and for keeping your password to yourself. Use a
            real name or a pseudonym for your public identity -  either way, it shouldn't belong to someone else.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">If something goes wrong</h2>
          <p className="mt-2">
            We can suspend an account that violates these terms. Suspension ends active sessions and blocks
            sign-in; it doesn't retract anything already published, for the same reason deleting your own account
            doesn't.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Changes</h2>
          <p className="mt-2">We'll post updates here if these terms change enough to matter.</p>
        </section>

        <section>
          <h2 className="text-lg text-foreground">Contact</h2>
          <p className="mt-2">
            <a href={`mailto:${brand.supportEmail}`} className="text-primary underline">
              {brand.supportEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
