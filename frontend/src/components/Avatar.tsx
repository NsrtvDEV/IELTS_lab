import { resolveMediaUrl } from "../api/client";
import { initials } from "../lib/format";

/** Фото профиля или инициалы, если фото нет */
export function Avatar({
  name,
  url,
  className = "h-10 w-10 text-sm",
  fallback = "bg-brand-500 text-white", // цвет кружка с инициалами
}: {
  name: string;
  url?: string | null;
  className?: string;
  fallback?: string;
}) {
  if (url) return <img src={resolveMediaUrl(url)} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${fallback} ${className}`}>
      {initials(name)}
    </span>
  );
}
