import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@noteschain/validation";
import { brand } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { useLogin } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      await login.mutateAsync(values);
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong.";
      form.setError("root", { message });
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col md:flex-row">
      <AuthSidePanel />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-2xl">Sign in to {brand.name}</h1>
        <p className="mt-1 text-muted-foreground">Welcome back.</p>

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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
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

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
