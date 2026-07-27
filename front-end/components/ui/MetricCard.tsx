type MetricCardProps = {
  label: string;
  value: number;
  description: string;
};

export default function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <div className="rounded-[20px] border border-outline-variant bg-surface-container p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="type-label-caps text-secondary-fixed-dim">{label}</p>
      <p className="mt-3 font-mono text-3xl font-bold text-primary">{String(value).padStart(2, "0")}</p>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}
