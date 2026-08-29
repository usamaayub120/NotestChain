import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { changeUsernameSchema, updateIdentitySchema, type UpdateIdentityInput } from "@noteschain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageLoader } from "@/components/Loader";
import { ErrorState } from "@/components/ErrorState";
import { useChangeKeeperUsername, useIdentities, useUpdateIdentity } from "@/hooks/useIdentities";
import { ApiClientError } from "@/lib/api";

type IdentityFormValues = z.input<typeof updateIdentitySchema>;

export function EditIdentityPage() {
  const { id } = useParams<{ id: string }>();
  const { data: identities, isLoading } = useIdentities();
  const identity = identities?.find((i) => i.id === id);

  if (isLoading) return <PageLoader label="Loading" />;
  if (!identity) return <ErrorState message="That byline couldn't be found." />;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <p className="text-sm text-muted-foreground">
        <Link to="/identities" className="hover:underline">
          ← Pen names
        </Link>
      </p>
      <h1 className="mt-1 text-2xl">
        {identity.isPrimary ? "Your Keeper profile" : `Edit ${identity.displayName}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        @{identity.username} · {identity.isPrimary ? "This is your own profile -  always visible and findable." : "Pen name"}
      </p>

      {identity.isPrimary && identity.canChangeUsername && <UsernameChangeForm currentUsername={identity.username} />}

      <IdentityFieldsForm identityId={identity.id} isPrimary={identity.isPrimary} defaults={identity} />
    </div>
  );
}

function UsernameChangeForm({ currentUsername }: { currentUsername: string }) {
  const changeUsername = useChangeKeeperUsername();
  const form = useForm<z.infer<typeof changeUsernameSchema>>({
    resolver: zodResolver(changeUsernameSchema),
    defaultValues: { username: currentUsername },
  });

  async function onSubmit(values: z.infer<typeof changeUsernameSchema>) {
    try {
      await changeUsername.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        form.setError("username", { message: err.message });
        return;
      }
      form.setError("root", { message: err instanceof ApiClientError ? err.message : "Something went wrong." });
    }
  }

  return (
    <div className="mt-6 rounded-md border border-border bg-surface p-4">
      <p className="text-sm font-medium">Your username was generated for you</p>
      <p className="mt-1 text-xs text-muted-foreground">
        You can change it once. After that, it's permanent -  it's already how people will find and link to you.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 flex items-start gap-2" noValidate>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...field} onChange={(e) => field.onChange(e.target.value.toLowerCase())} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" disabled={changeUsername.isPending}>
            {changeUsername.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
        {changeUsername.isSuccess && <p className="mt-2 text-xs text-success">Saved. This is permanent now.</p>}
        {form.formState.errors.root && (
          <p role="alert" className="mt-2 text-xs font-medium text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
      </Form>
    </div>
  );
}

function IdentityFieldsForm({
  identityId,
  isPrimary,
  defaults,
}: {
  identityId: string;
  isPrimary: boolean;
  defaults: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    location: string | null;
    pronouns: string | null;
    birthDate: string | null;
    showBirthDate: boolean;
    gender: string | null;
    showGender: boolean;
    isVisible: boolean;
  };
}) {
  const navigate = useNavigate();
  const update = useUpdateIdentity(identityId);
  // updateIdentitySchema coerces birthDate to a Date; the API returns it as
  // an ISO string, so it's converted once here rather than at every call site.
  const formDefaults = { ...defaults, birthDate: defaults.birthDate ? new Date(defaults.birthDate) : null };
  const form = useForm<IdentityFormValues, unknown, UpdateIdentityInput>({
    resolver: zodResolver(updateIdentitySchema),
    defaultValues: formDefaults,
  });

  // Reset once identities finish loading (initial defaults may be stale
  // placeholders before the query resolves).
  useEffect(() => form.reset(formDefaults), [defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: UpdateIdentityInput) {
    try {
      await update.mutateAsync(values);
    } catch (err) {
      form.setError("root", { message: err instanceof ApiClientError ? err.message : "Something went wrong." });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
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
          <p className="text-xs text-muted-foreground">Both are optional and stay off your profile until you turn them on here.</p>

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

        {!isPrimary && (
          <FormField
            control={form.control}
            name="isVisible"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-border p-4">
                <div>
                  <FormLabel className="font-normal">Visible to readers</FormLabel>
                  <p className="text-xs text-muted-foreground">Hide this pen name's profile without deleting it.</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {form.formState.errors.root && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/identities")}>
            Done
          </Button>
        </div>
        {update.isSuccess && !form.formState.isDirty && <p className="text-xs text-success">Saved.</p>}
      </form>
    </Form>
  );
}
