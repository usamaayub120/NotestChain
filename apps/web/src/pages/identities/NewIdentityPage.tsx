import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { createIdentitySchema, type CreateIdentityInput } from "@noteschain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateIdentity } from "@/hooks/useIdentities";
import { ApiClientError } from "@/lib/api";

// react-hook-form types against the schema's *input* shape (fields still
// optional pre-parse); zod fills defaults in on submit, producing the
// stricter CreateIdentityInput output type the API expects.
type IdentityFormValues = z.input<typeof createIdentitySchema>;

// Every pen name created here IS a pen name -  a REAL_NAME byline only ever
// exists as the Keeper profile made at registration, and the API ignores
// `type` on this route regardless of what's sent (identities.service.ts).
export function NewIdentityPage() {
  const navigate = useNavigate();
  const createIdentity = useCreateIdentity();
  const form = useForm<IdentityFormValues, unknown, CreateIdentityInput>({
    resolver: zodResolver(createIdentitySchema),
    defaultValues: { username: "", displayName: "", bio: "", isVisible: true, showBirthDate: false, showGender: false },
  });

  async function onSubmit(values: CreateIdentityInput) {
    try {
      await createIdentity.mutateAsync(values);
      navigate("/identities");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        form.setError("username", { message: err.message });
        return;
      }
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      form.setError("root", { message });
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl">New pen name</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Readers never see that this belongs to the same account as any of your other bylines.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="lowercase-with-dashes" {...field} onChange={(e) => field.onChange(e.target.value.toLowerCase())} />
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

          <FormField
            control={form.control}
            name="avatarUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input placeholder="Optional -  a link to an image" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pronouns"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pronouns</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3 rounded-md border border-border p-4">
            <p className="text-sm font-medium">Personal details</p>
            <p className="text-xs text-muted-foreground">
              Both are optional and stay off this pen name's profile until you turn them on here.
            </p>

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birth date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ? field.value.toISOString().slice(0, 10) : ""}
                      onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="showBirthDate"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 space-y-0">
                  <FormLabel className="font-normal">Show birth date on profile</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="showGender"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-3 space-y-0">
                  <FormLabel className="font-normal">Show gender on profile</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {form.formState.errors.root && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={createIdentity.isPending}>
            {createIdentity.isPending ? "Creating…" : "Create pen name"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
