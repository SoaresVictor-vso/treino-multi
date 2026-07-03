
export type BadgeTypes = "primary" | "secondary" | "error"

type StatusBadgeProps = {
  label: string;
  type: BadgeTypes;
};

function getBadgeClassName(type: StatusBadgeProps["type"]) {
  switch (type) {
    case "primary":
      return "border-primary-fixed-dim/20 bg-primary-fixed-dim/10 text-primary-fixed-dim";
    case "secondary":
      return "border-outline-variant/70 bg-surface-variant/40 text-secondary-fixed-dim";
    case "error":
      return "border-error/20 bg-error/10 text-error";
    default:
      return "";
  }
}

export default function Badge({ label, type }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getBadgeClassName(type)}`}>
      {label}
    </span>
  );
}
