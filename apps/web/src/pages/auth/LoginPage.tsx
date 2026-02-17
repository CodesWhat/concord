import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { MailIcon, LockIcon } from "../../components/icons";
import { AuthLayout } from "./AuthLayout";
import { useAuthStore } from "../../stores/authStore";

function validateEmail(email: string): string | undefined {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  return undefined;
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuthStore();

  function validate() {
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    return !next.email && !next.password;
  }

  function handleBlur(field: "email" | "password") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") {
      setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else {
      setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!validate()) return;

    const success = await login(email, password);
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
        <p className="text-sm text-text-muted">Welcome back!</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {authError && (
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {authError}
          </div>
        )}

        <Input
          id="login-email"
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

        <Input
          id="login-password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          icon={<LockIcon />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => handleBlur("password")}
          error={touched.password ? errors.password : undefined}
          disabled={isLoading}
        />

        <Button type="submit" loading={isLoading} className="mt-2 w-full">
          Log In
        </Button>

        <div className="text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="flex items-center gap-3 text-text-muted">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <p className="text-center text-sm text-text-muted">
          Need an account?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export { LoginPage };
