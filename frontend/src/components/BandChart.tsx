import { useLayoutEffect, useRef, useState } from "react";
import type { ProgressPoint } from "../api/student";
import type { SectionType } from "../api/teacher";
import { SECTION_COLORS, SECTION_LABELS } from "../lib/questionTypes";
import { locale, t } from "../i18n";

const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type Hover = { x: number; y: number; type: SectionType; point: ProgressPoint } | null;

/** Band по секциям во времени: одна шкала 0–9, линия на секцию */
export function BandChart({
  series,
  height = 260,
  yTicks = [0, 1.5, 3, 4.5, 6, 7.5, 9],
}: {
  series: [SectionType, ProgressPoint[]][];
  height?: number;
  yTicks?: number[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover>(null);
  const pad = { top: 16, right: 24, bottom: 32, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const times = series.flatMap(([, pts]) => pts.map((p) => new Date(p.date).getTime()));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const x = (t: number) => pad.left + (max === min ? innerW / 2 : ((t - min) / (max - min)) * innerW);
  const y = (band: number) => pad.top + innerH - (band / 9) * innerH;
  const xTicks = max === min ? [min] : [min, min + (max - min) / 2, max];

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t("Band score over time by section")}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e8edf5" strokeWidth={1} />
              <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
              {dateFmt.format(new Date(t))}
            </text>
          ))}
          {series.map(([type, pts]) => {
            const color = SECTION_COLORS[type];
            const d = pts.map((p, i) => `${i ? "L" : "M"}${x(new Date(p.date).getTime())},${y(Number(p.band))}`).join(" ");
            return (
              <g key={type}>
                {pts.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
                {pts.map((p, i) => {
                  const cx = x(new Date(p.date).getTime());
                  const cy = y(Number(p.band));
                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
                      {/* зона наведения больше самой точки */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="transparent"
                        onMouseEnter={() => setHover({ x: cx, y: cy, type, point: p })}
                        onMouseLeave={() => setHover(null)}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: hover.x, top: hover.y - 12 }}
        >
          <div className="font-semibold">
            {SECTION_LABELS[hover.type]} · band {hover.point.band}
          </div>
          <div className="text-white/70">
            {hover.point.test_title} · {dateFmt.format(new Date(hover.point.date))}
          </div>
        </div>
      )}
    </div>
  );
}
