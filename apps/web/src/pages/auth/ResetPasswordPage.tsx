import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LockIcon } from "../../components/icons";
import { AuthLayout } from "./AuthLayout";
import { authClient } from "../../api/auth";

function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return undefined;
}

function validateConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return "Please confirm your password";
  if (password !== confirm) return "Passwords do not match";
  return undefined;
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [touched, setTouched] = useState<{ password?: boolean; confirm?: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleBlur(field: "password" | "confirm") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "password") {
      setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    } else {
      setErrors((prev) => ({ ...prev, confirm: validateConfirm(password, confirm) }));
    }
  }

  function validate() {
    const next = {
      password: validatePassword(password),
      confirm: validateConfirm(password, confirm),
    };
    setErrors(next);
    return !next.password && !next.confirm;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    if (!validate()) return;
    if (!token) {
      setResetError("Invalid or missing reset token.");
      return;
    }

    setIsLoading(true);
    setResetError(null);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        setResetError(error.message ?? "Failed to reset password. The link may have expired.");
      } else {
        setSuccess(true);
      }
    } catch {
      setResetError("Failed to reset password. The link may have expired.");
    }
    setIsLoading(false);
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/icon0.svg" alt="Concord" className="h-16 w-16" />
          <h1 className="text-2xl font-bold text-primary-light">
            Concord
          </h1>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            Invalid or missing reset token.
          </div>
          <p className="text-center text-sm text-text-muted">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Request a new reset link
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-2 mb-6">
        <img src="/icon0.svg" alt="Concord" className="h-16 w-16" />
        <h1 className="text-2xl font-bold text-primary-light">
          Concord
        </h1>
        <p className="text-sm text-text-muted">Set a new password</p>
      </div>

      {success ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">
            Password has been reset. You can now log in.
          </div>
          <p className="text-center text-sm text-text-muted">
            <Link to="/login" className="text-primary hover:underline">
              Go to login
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {resetError && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {resetError}
            </div>
          )}

          <Input
            id="reset-password"
            label="New Password"
            type="password"
            placeholder="Enter new password"
            autoComplete="new-password"
            icon={<LockIcon />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur("password")}
            error={touched.password ? errors.password : undefined}
            disabled={isLoading}
          />

          <Input
            id="reset-confirm"
            label="Confirm Password"
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            icon={<LockIcon />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => handleBlur("confirm")}
            error={touched.confirm ? errors.confirm : undefined}
            disabled={isLoading}
          />

          <Button type="submit" loading={isLoading} className="mt-2 w-full">
            Reset Password
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

export { ResetPasswordPage };
