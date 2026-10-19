import { useState, type PointerEvent } from "react";
import type { GrowthPoint } from "../../api/admin";
import { locale, t, tn } from "../../i18n";
import { useWidth } from "../../lib/useWidth";

const COLOR = "#2f6bff";
const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
const numberFmt = new Intl.NumberFormat(locale);

/** Красивые деления оси: 0 … max с шагом 1/2/5 × 10ⁿ */
function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / (count - 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Всего пользователей по дням: линия с заливкой, перекрестие и подсказка на ближайший день */
export function GrowthChart({ points, height = 240 }: { points: GrowthPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 16, bottom: 28, left: 44 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(...points.map((p) => p.users), 0));
  const top = ticks[ticks.length - 1];
  const x = (i: number) => pad.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.users)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  // подписи дат: не больше 7, всегда первая и последняя
  const every = Math.max(1, Math.ceil(points.length / 7));
  const labelled = points.map((_, i) => i).filter((i) => i % every === 0 || i === points.length - 1);
  if (labelled.length > 1 && labelled[labelled.length - 1] - labelled[labelled.length - 2] < every / 2) labelled.splice(-2, 1);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  }

  const h = hover !== null ? points[hover] : null;
  const last = points[points.length - 1];

  return (
    <div ref={ref} className="relative">
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t("Total users by day: {n} on {date}", { n: last.users, date: dateFmt.format(new Date(last.date)) })}
        >
          <defs>
            <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="#e8edf5" strokeWidth={1} />
              <text x={pad.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px]">
                {numberFmt.format(v)}
              </text>
            </g>
          ))}
          {labelled.map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {dateFmt.format(new Date(points[i].date))}
            </text>
          ))}
          <path d={area} fill="url(#growth-fill)" />
          <path d={line} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* последняя точка — сегодняшнее значение */}
          <circle cx={x(points.length - 1)} cy={y(last.users)} r={5} fill={COLOR} stroke="#fff" strokeWidth={2} />
          {h && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(h.users)} r={5} fill={COLOR} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          {/* зона наведения — вся область графика: курсор ищет день, а не линию */}
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: y(h.users) - 12 }}
        >
          <div className="text-ink-muted">{dateFmt.format(new Date(h.date))}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: COLOR }} aria-hidden />
            <span className="font-bold text-ink">{tn(h.users, "{n} user", "{n} users")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
