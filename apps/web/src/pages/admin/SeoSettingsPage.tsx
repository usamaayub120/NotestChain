import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateSiteSettingsSchema, type UpdateSiteSettingsInput } from "@noteschain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { useSiteSettings, useUpdateSiteSettings } from "@/hooks/useAdmin";
import { errorMessage } from "@/lib/api";

export function SeoSettingsPage() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const [justSaved, setJustSaved] = useState(false);

  // Unlike NewIdentityPage's schema, this one has no .transform() -  the
  // "" -> null normalization happens server-side in settings.service.ts
  // so the form's values and the submitted values are the same type.
  const form = useForm<UpdateSiteSettingsInput>({
    resolver: zodResolver(updateSiteSettingsSchema),
    // `values` (rather than defaultValues) keeps the form in sync once the
    // async GET resolves -  there's nothing sensible to show before that.
    values: settings
      ? {
          ga4MeasurementId: settings.ga4MeasurementId ?? "",
          searchConsoleVerification: settings.searchConsoleVerification ?? "",
          defaultMetaDescription: settings.defaultMetaDescription ?? "",
          defaultOgImageUrl: settings.defaultOgImageUrl ?? "",
          twitterHandle: settings.twitterHandle ?? "",
          indexingEnabled: settings.indexingEnabled,
          androidLatestBuild: settings.androidLatestBuild,
          androidMinimumBuild: settings.androidMinimumBuild,
          androidLatestVersion: settings.androidLatestVersion,
        }
      : undefined,
    defaultValues: {
      indexingEnabled: true,
      androidLatestBuild: 1,
      androidMinimumBuild: 1,
      androidLatestVersion: "1.0.0",
    },
  });

  async function onSubmit(values: UpdateSiteSettingsInput) {
    setJustSaved(false);
    try {
      await updateSettings.mutateAsync(values);
      setJustSaved(true);
    } catch (err) {
      const message = errorMessage(err, "Something went wrong.");
      form.setError("root", { message });
    }
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 lg:px-10 lg:py-10">
        <AdminPageHeader title="Settings" />
        <div className="mt-6">
          <CardSkeletonList count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 lg:px-10 lg:py-10">
      <AdminPageHeader
        title="Settings"
        description="Site metadata and Android release policy. Changes apply right away."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 max-w-4xl space-y-5" noValidate>
          <FormField
            control={form.control}
            name="indexingEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-4">
                <div>
                  <FormLabel>Allow search engines to index this site</FormLabel>
                  <FormDescription>
                    Turn off while staging or testing. Every page gets marked noindex, and robots.txt blocks all crawling.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ga4MeasurementId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Google Analytics 4 Measurement ID</FormLabel>
                <FormControl>
                  <Input placeholder="G-XXXXXXXXXX" {...field} />
                </FormControl>
                <FormDescription>From a GA4 property's web data stream. Leave blank to turn off analytics.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="searchConsoleVerification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Google Search Console verification</FormLabel>
                <FormControl>
                  <Input placeholder="the verification code" {...field} />
                </FormControl>
                <FormDescription>From Search Console's HTML tag verification method.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultMetaDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default meta description</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Used on pages that don't have their own description." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultOgImageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default social share image URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://…/og-image.png" {...field} />
                </FormControl>
                <FormDescription>Shown when a page without its own image is shared. Recommended size: 1200×630.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="twitterHandle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>X / Twitter handle</FormLabel>
                <FormControl>
                  <Input placeholder="@noteschain" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset className="space-y-4 rounded-md border border-border bg-surface p-4">
            <legend className="px-1 text-sm font-semibold">Android release policy</legend>
            <p className="text-sm text-muted-foreground">
              Build numbers are Android versionCodes, not semantic versions. The release workflow advances the latest build after Google Play makes it available; only an administrator can choose when a build becomes mandatory.
            </p>

            <FormField
              control={form.control}
              name="androidLatestBuild"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latest available Android build</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={2147483647}
                      step={1}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      readOnly
                    />
                  </FormControl>
                  <FormDescription>Maintained automatically after the release is available on Google Play.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="androidLatestVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latest display version</FormLabel>
                  <FormControl>
                    <Input placeholder="1.0.0" {...field} value={field.value ?? ""} readOnly />
                  </FormControl>
                  <FormDescription>Maintained by release automation and shown in the optional-update message.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="androidMinimumBuild"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum supported Android build</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={2147483647}
                      step={1}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    Raising this blocks every older build. Do this only after the matching build is available to the intended Google Play testers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>

          {form.formState.errors.root && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving…" : "Save settings"}
            </Button>
            {justSaved && !updateSettings.isPending && <span className="text-sm text-muted-foreground">Saved</span>}
          </div>
        </form>
      </Form>
    </div>
  );
}
