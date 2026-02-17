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
          "radial-gradient(ellipse at center, rgba(124, 58, 237, 0.08) 0%, transparent 70%)",
          "linear-gradient(rgba(124, 58, 237, 0.03) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(124, 58, 237, 0.03) 1px, transparent 1px)",
          `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        ].join(", "),
        backgroundSize: "100% 100%, 40px 40px, 256px 256px",
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
