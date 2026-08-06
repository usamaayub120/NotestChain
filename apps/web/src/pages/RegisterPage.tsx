import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@noteschain/validation";
import { brand } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { useRegister } from "@/hooks/useAuth";
import { ApiClientError } from "@/lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    try {
      await register.mutateAsync(values);
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

            {form.formState.errors.root && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={register.isPending}>
              {register.isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
