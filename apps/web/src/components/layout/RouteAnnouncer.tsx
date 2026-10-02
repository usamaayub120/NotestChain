import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * What a multi-page app gets from the browser and a client-side router has to
 * put back by hand. `<BrowserRouter>` ships none of it, and this app had none
 * of it: no skip link, no focus management, no scroll restoration (verified
 * by grep across src/).
 *
 * Three consequences, all of them daily:
 *   - a keyboard user re-tabbed the header and sidebar on every navigation;
 *   - a screen-reader user got no announcement that the page had changed, so
 *     the new page simply appeared with focus still on the old link;
 *   - navigating from a scrolled feed into a note kept the old scroll offset.
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const first = useRef(true);

  useEffect(() => {
    // Don't steal focus or jump the page on the very first render.
    if (first.current) {
      first.current = false;
      return;
    }

    // POP is the back/forward button, where the browser's own scroll
    // restoration is the behaviour people expect. Only reset on a real
    // forward navigation.
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
    }

    // Move focus to the main landmark so the next Tab continues from the new
    // page's content, and so assistive tech announces the change. tabIndex
    // -1 is removed again on blur to keep it out of the tab order.
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
      main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
    }
  }, [location.pathname, location.search, navigationType]);

  return null;
}

export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      // `focus:` rather than `focus-visible:`. A skip link is only ever
      // reached by keyboard -  it is the first thing in the document -  so the
      // narrower variant buys nothing and silently fails for any focus the
      // browser doesn't classify as visible.
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to content
    </a>
  );
}
