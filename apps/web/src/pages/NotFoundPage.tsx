import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start px-4 py-16">
      <h1 className="text-2xl">Nothing kept here</h1>
      <p className="mt-2 text-muted-foreground">This page doesn't exist, or it moved.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
