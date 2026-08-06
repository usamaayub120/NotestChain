import { useEffect, useRef, useState } from "react";

/**
 * Fades a section in as it scrolls into view. Reduced-motion users still
 * get the content — the global `prefers-reduced-motion` rule in
 * globals.css collapses the transition to near-zero rather than this hook
 * skipping it, so nothing ever stays invisible.
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);

    // This is decoration, not content — if IntersectionObserver never
    // fires for any reason (an unusual embedding context, a browser quirk),
    // the section must still show up rather than staying invisible forever.
    const fallback = setTimeout(() => setIsVisible(true), 2000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [threshold]);

  return { ref, isVisible };
}
