import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { MailIcon, LockIcon, AtSignIcon } from "../../components/icons";
import { AuthLayout } from "./AuthLayout";
import { useAuthStore } from "../../stores/authStore";

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateUsername(v: string): string | undefined {
  if (!v) return "Username is required";
  if (v.length < 3) return "Must be at least 3 characters";
  if (v.length > 32) return "Must be 32 characters or fewer";
  if (!/^[a-zA-Z0-9_]+$/.test(v))
    return "Only letters, numbers, and underscores";
  return undefined;
}

function validateEmail(v: string): string | undefined {
  if (!v) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Invalid email format";
  return undefined;
}

function validatePassword(v: string): string | undefined {
  if (!v) return "Password is required";
  if (v.length < 8) return "Must be at least 8 characters";
  return undefined;
}

function validateConfirm(pw: string, confirm: string): string | undefined {
  if (!confirm) return "Please confirm your password";
  if (pw !== confirm) return "Passwords do not match";
  return undefined;
}

function getPasswordStrength(pw: string): {
  level: "weak" | "fair" | "strong";
  width: string;
  color: string;
} {
  if (!pw) return { level: "weak", width: "0%", color: "bg-zinc-600" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { level: "weak", width: "33%", color: "bg-red-500" };
  if (score <= 3) return { level: "fair", width: "66%", color: "bg-yellow-500" };
  return { level: "strong", width: "100%", color: "bg-green-500" };
}

function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuthStore();

  const strength = getPasswordStrength(password);

  function validateAll(): FieldErrors {
    return {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirm(password, confirmPassword),
    };
  }

  function handleBlur(field: keyof FieldErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const validators: Record<keyof FieldErrors, () => string | undefined> = {
      username: () => validateUsername(username),
      email: () => validateEmail(email),
      password: () => validatePassword(password),
      confirmPassword: () => validateConfirm(password, confirmPassword),
    };
    setErrors((prev) => ({ ...prev, [field]: validators[field]() }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, confirmPassword: true });
    const next = validateAll();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const success = await register(username, email, password);
    if (success) {
      navigate("/app");
    }
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-2 mb-6">
        <img src="/icon0.svg" alt="Concord" className="h-16 w-16" />
        <h1 className="text-2xl font-bold text-primary-light">
          Concord
        </h1>
        <p className="text-sm text-text-muted">Create an account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {authError && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {authError}
          </div>
        )}

        <Input
          id="reg-username"
          label="Username"
          type="text"
          placeholder="your_username"
          autoComplete="username"
          icon={<AtSignIcon />}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => handleBlur("username")}
          error={touched.username ? errors.username : undefined}
          disabled={isLoading}
        />

        <Input
          id="reg-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          icon={<MailIcon />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur("email")}
          error={touched.email ? errors.email : undefined}
          disabled={isLoading}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            id="reg-password"
            label="Password"
            type="password"
            placeholder="8+ characters"
            autoComplete="new-password"
            icon={<LockIcon />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur("password")}
            error={touched.password ? errors.password : undefined}
            disabled={isLoading}
          />
          {password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-zinc-700">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }}
                />
              </div>
              <span className="text-xs text-text-muted capitalize">
                {strength.level}
              </span>
            </div>
          )}
        </div>

        <Input
          id="reg-confirm"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter password"
          autoComplete="new-password"
          icon={<LockIcon />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => handleBlur("confirmPassword")}
          error={touched.confirmPassword ? errors.confirmPassword : undefined}
          disabled={isLoading}
        />

        <Button type="submit" loading={isLoading} className="mt-2 w-full">
          Create Account
        </Button>

        <p className="text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export { RegisterPage };
