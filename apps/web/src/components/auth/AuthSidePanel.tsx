/**
 * Desktop-only atmosphere for the login/register forms — mobile skips it
 * entirely rather than squeezing it in above the form, since screen space
 * there is better spent getting to the fields.
 */
export function AuthSidePanel() {
  return (
    <div className="hidden items-center justify-center bg-canopy px-10 text-canopy-foreground md:flex md:w-2/5">
      <blockquote className="max-w-xs font-sans text-2xl italic leading-snug">
        Wrote this on a bench. Still true from here.
      </blockquote>
    </div>
  );
}
