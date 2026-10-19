import { resolveMediaUrl } from "../api/client";
import { initials } from "../lib/format";

/** Фото профиля или инициалы, если фото нет */
export function Avatar({ name, url, className = "h-10 w-10 text-sm" }: { name: string; url?: string | null; className?: string }) {
  if (url) return <img src={resolveMediaUrl(url)} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white ${className}`}>
      {initials(name)}
    </span>
  );
}
