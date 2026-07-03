type StatusBadgeProps = {
  label: string;
  className: string;
};

export default function Badge({ label, className }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}>
      {label}
    </span>
  );
}
