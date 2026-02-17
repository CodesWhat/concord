import { type ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg-deepest p-4"
      style={{
        backgroundImage: [
          "linear-gradient(rgba(124, 58, 237, 0.03) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(124, 58, 237, 0.03) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-lg border border-border bg-bg-sidebar p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export { AuthLayout };
