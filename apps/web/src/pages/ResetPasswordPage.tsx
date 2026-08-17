import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { resetPasswordSchema } from "@noteschain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { useResetPassword } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

// The token comes from the URL, not typed by hand — the form itself only
// ever collects the new password.
const formSchema = resetPasswordSchema.omit({ token: true });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const resetPassword = useResetPassword();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!token) return;
    try {
      await resetPassword.mutateAsync({ token, ...values });
      navigate("/login");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      form.setError("root", { message });
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col md:flex-row">
      <AuthSidePanel />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl">Set a new password</h1>

        {!token ? (
          <p className="mt-4 text-muted-foreground">
            This link is missing its token — check the URL, or{" "}
            <Link to="/forgot-password" className="font-medium text-primary">
              request a new one
            </Link>
            .
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>At least 10 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div role="alert" className="text-sm font-medium text-destructive">
                  <p>{form.formState.errors.root.message}</p>
                  <p className="mt-1 font-normal text-muted-foreground">
                    If this link has expired,{" "}
                    <Link to="/forgot-password" className="font-medium text-primary">
                      request a new one
                    </Link>
                    .
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Setting password…" : "Set new password"}
              </Button>
            </form>
          </Form>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
