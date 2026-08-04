import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { createIdentitySchema, type CreateIdentityInput } from "@noteschain/validation";
import { IdentityType } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateIdentity } from "@/hooks/useIdentities";
import { ApiClientError } from "@/lib/api";

// react-hook-form types against the schema's *input* shape (fields still
// optional pre-parse); zod fills defaults in on submit, producing the
// stricter CreateIdentityInput output type the API expects.
type IdentityFormValues = z.input<typeof createIdentitySchema>;

export function NewIdentityPage() {
  const navigate = useNavigate();
  const createIdentity = useCreateIdentity();
  const form = useForm<IdentityFormValues, unknown, CreateIdentityInput>({
    resolver: zodResolver(createIdentitySchema),
    defaultValues: { type: IdentityType.PSEUDONYM, username: "", displayName: "", bio: "", isVisible: true },
  });

  async function onSubmit(values: CreateIdentityInput) {
    try {
      await createIdentity.mutateAsync(values);
      navigate("/identities");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      form.setError("root", { message });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl">New identity</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-2 gap-2">
                    {[IdentityType.REAL_NAME, IdentityType.PSEUDONYM].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => field.onChange(type)}
                        className={`rounded-md border px-3 py-2 text-sm ${field.value === type ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                      >
                        {type === IdentityType.REAL_NAME ? "Real name" : "Pseudonym"}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="lowercase-with-dashes" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={createIdentity.isPending}>
            {createIdentity.isPending ? "Creating…" : "Create identity"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
