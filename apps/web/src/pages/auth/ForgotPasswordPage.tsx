import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { MailIcon } from "../../components/icons";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "../../api/auth";

// Better Auth exposes POST /api/auth/forget-password but the client type
// doesn't surface `forgetPassword` unless the server plugin is inferred.
// Use $fetch to call the endpoint directly.
const forgetPassword = (body: { email: string; redirectTo: string }) =>
  authClient.$fetch("/forget-password", { method: "POST", body });

function validateEmail(email: string): string | undefined {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return undefined;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleBlur() {
    setTouched(true);
    setError(validateEmail(email));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;

    setIsLoading(true);
    try {
      await forgetPassword({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Always show success to avoid email enumeration
    }
    setIsLoading(false);
    setSent(true);
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-2 mb-6">
        <img src="/icon0.svg" alt="Concord" className="h-16 w-16" />
        <h1 className="text-2xl font-bold text-primary-light">
          Concord
        </h1>
        <p className="text-sm text-text-muted">Reset your password</p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">
            If an account with that email exists, we've sent a password reset link.
          </div>
          <p className="text-center text-sm text-text-muted">
            <Link to="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="forgot-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon={<MailIcon />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleBlur}
            error={touched ? error : undefined}
            disabled={isLoading}
          />

          <Button type="submit" loading={isLoading} className="mt-2 w-full">
            Send Reset Link
          </Button>

          <p className="text-center text-sm text-text-muted">
            <Link to="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export { ForgotPasswordPage };
