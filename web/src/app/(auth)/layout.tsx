import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container py-5">
        <Logo />
      </header>
      <main
        id="contenido"
        className="container flex flex-1 items-start justify-center pb-12 pt-4 sm:items-center"
      >
        {children}
      </main>
    </div>
  );
}
