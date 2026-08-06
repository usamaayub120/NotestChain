/**
 * Ambient light for the hero — two soft, slow-drifting blurred shapes, warm
 * gold and moss green, meant to read as sunlight through a canopy rather
 * than a decoration you consciously notice. Purely atmospheric: never sits
 * under interactive content, never used for contrast/reading purposes.
 */
export function CanopyGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-glow opacity-[0.18] blur-[90px] animate-drift" />
      <div className="absolute -right-32 top-10 h-[360px] w-[360px] rounded-full bg-verified opacity-[0.12] blur-[100px] animate-drift-reverse" />
    </div>
  );
}
