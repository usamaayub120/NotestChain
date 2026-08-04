export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start px-4 py-16 text-left">
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm text-muted-foreground">
        This part of NotesChain is being built next — see IMPLEMENTATION_PLAN.md, Phase 2.
      </p>
    </div>
  );
}
