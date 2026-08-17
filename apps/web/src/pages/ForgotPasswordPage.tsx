import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@noteschain/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { useForgotPassword } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await forgotPassword.mutateAsync(values);
      // Shown regardless of whether the email has an account — the server
      // gives the same response either way, and repeating that here in the
      // UI is what actually makes the guarantee hold end to end.
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      form.setError("root", { message });
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col md:flex-row">
      <AuthSidePanel />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl">Reset your password</h1>

        {submitted ? (
          <p className="mt-4 text-muted-foreground">
            If that email has an account, a reset link is on its way. It's good for 30 minutes.
          </p>
        ) : (
          <>
            <p className="mt-1 text-muted-foreground">We'll send a link to set a new one.</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
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

                <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                  {forgotPassword.isPending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </Form>
          </>
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
