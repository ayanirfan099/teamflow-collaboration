import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in · TeamFlow',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="hidden flex-col justify-between bg-accent px-10 py-12 text-accent-contrast lg:flex"
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-contrast text-accent">
            T
          </span>
          TeamFlow
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Plan, ship and celebrate — together.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-accent-contrast">
            Boards, tasks and conversations in one calm workspace. Built for teams that value focus
            over noise.
          </p>
        </div>
        <p className="text-xs text-accent-contrast">Multi-tenant · Secure by default</p>
      </div>
    </div>
  );
}
