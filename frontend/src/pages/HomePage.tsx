import { LogOut } from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

// Временная главная страница — дашборд ученика будет следующим шагом
export function HomePage() {
  const { user, logout } = useAuth();
  const name = user?.profile?.first_name || user?.email;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex items-center justify-between">
        <Logo />
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-white hover:text-ink"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </header>
      <h1 className="mt-16 text-3xl font-extrabold text-ink">Hi, {name}!</h1>
      <p className="mt-2 text-ink-muted">Your dashboard is coming soon.</p>
    </div>
  );
}
