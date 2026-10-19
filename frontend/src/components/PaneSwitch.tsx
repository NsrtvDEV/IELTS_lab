/** На телефоне две половины экрана теста (текст и вопросы, задание и ответ) показываются по очереди */
export function PaneSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold lg:hidden ${className}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 ${value === o.value ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
