import { utf8ByteLength } from "@noteschain/shared";
import { cn } from "@/lib/utils";

export function ByteCounter({ value, max }: { value: string; max: number }) {
  const bytes = utf8ByteLength(value);
  const over = bytes > max;
  return (
    <span className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
      {bytes}/{max} bytes
    </span>
  );
}
