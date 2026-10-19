import { useState } from "react";
import type { UserRole } from "../../api/types";
import { locale, t } from "../../i18n";
import { ROLE_COLORS, ROLE_ORDER, ROLE_PLURAL } from "../../lib/roles";

const ORDER = ROLE_ORDER;
const numberFmt = new Intl.NumberFormat(locale);
const percentFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

/** Пользователи по ролям: кольцо (части целого, 3 категории) + легенда с числами */
export function RoleDonut({ roles }: { roles: { role: UserRole; count: number }[] }) {
  const [hover, setHover] = useState<UserRole | null>(null);
  const counts = Object.fromEntries(roles.map((r) => [r.role, r.count])) as Record<UserRole, number>;
  const total = ORDER.reduce((s, r) => s + (counts[r] ?? 0), 0);
  const size = 168;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const GAP = 2; // зазор цвета фона между сегментами
  const visible = ORDER.filter((role) => counts[role] > 0);

  const lengths = visible.map((role) => (counts[role] / total) * c);
  const arcs = visible.map((role, i) => ({
    role,
    start: lengths.slice(0, i).reduce((a, b) => a + b, 0),
    len: Math.max(lengths[i] - (visible.length > 1 ? GAP : 0), 1.5),
  }));
  const share = (role: UserRole) => (total ? (counts[role] / total) * 100 : 0);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={t("Users by role")}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f8" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle
              key={a.role}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ROLE_COLORS[a.role]}
              strokeWidth={hover === a.role ? stroke + 4 : stroke}
              strokeDasharray={`${a.len} ${c}`}
              strokeDashoffset={-a.start}
              className="cursor-default transition-[stroke-width]"
              onPointerEnter={() => setHover(a.role)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hover ? (
            <>
              <span className="text-2xl font-extrabold text-ink">{numberFmt.format(counts[hover])}</span>
              <span className="max-w-[92px] text-xs leading-tight text-ink-muted">
                {t(ROLE_PLURAL[hover])} · {percentFmt.format(share(hover))}%
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-extrabold text-ink">{numberFmt.format(total)}</span>
              <span className="max-w-[92px] text-xs leading-tight text-ink-muted">{t("Total users")}</span>
            </>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" aria-label={t("Legend")}>
        {ORDER.map((role) => (
          <li
            key={role}
            className="flex items-start gap-2.5"
            onPointerEnter={() => setHover(role)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: ROLE_COLORS[role] }} aria-hidden />
            <span>
              <span className="block font-medium text-ink">{t(ROLE_PLURAL[role])}</span>
              <span className="text-xs text-ink-muted">
                {numberFmt.format(counts[role] ?? 0)} ({percentFmt.format(share(role))}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
