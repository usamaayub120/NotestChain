import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { registerSchema, usernameSchema } from "@noteschain/validation";
import { brand, LIMITS } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useRegister } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

// registerSchema leaves username/displayName optional so an already-installed
// mobile binary that doesn't send them still registers (the server generates
// a handle from the email instead). The web sign-up form is the new front
// door, so it requires both -  this is a stricter local schema, not the wire
// contract, and its own inferred type (not RegisterInput) is what the form
// itself is typed against.
const webRegisterSchema = registerSchema.extend({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Give your Keeper profile a name.").max(LIMITS.DISPLAY_NAME_MAX_LENGTH),
});
type WebRegisterInput = z.infer<typeof webRegisterSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const register = useRegister();
  const [hasCaptchaToken, setHasCaptchaToken] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const form = useForm<WebRegisterInput>({
    resolver: zodResolver(webRegisterSchema),
    defaultValues: { email: "", password: "", captchaToken: "", username: "", displayName: "" },
  });

  async function onSubmit(values: WebRegisterInput) {
    try {
      await register.mutateAsync(values);
      const next = new URLSearchParams(location.search).get("next");
      navigate(next?.startsWith("/") ? next : "/dashboard");
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
    <div className="flex min-h-[70dvh] flex-col md:flex-row">
      <AuthSidePanel />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl">Join {brand.name}</h1>
        <p className="mt-1 text-muted-foreground">A place to keep the thoughts worth keeping.</p>

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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>At least 10 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Marguerite Vale" {...field} />
                  </FormControl>
                  <FormDescription>Shown on your Keeper profile -  you can change it any time.</FormDescription>
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
                    <div className="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                      <span className="pl-3 text-sm text-muted-foreground">@</span>
                      <Input
                        autoComplete="username"
                        placeholder="marguerite"
                        className="border-0 focus-visible:ring-0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Your profile's address. Lowercase letters, numbers, - or _ only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <TurnstileWidget
              onVerify={(token) => {
                form.setValue("captchaToken", token);
                setHasCaptchaToken(true);
              }}
            />

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  form.setValue("acceptedTerms", e.target.checked as true);
                }}
                className="mt-1 h-4 w-4"
              />
              I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </label>

            {form.formState.errors.root && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending || !hasCaptchaToken || !acceptedTerms}
            >
              {register.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to={`/login${location.search}`} className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
