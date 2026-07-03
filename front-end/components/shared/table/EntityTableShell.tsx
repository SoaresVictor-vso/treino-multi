import { ReactNode } from "react";

type EntityTableShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  emptyState: ReactNode;
};

export default function EntityTableShell({ title, subtitle, children, emptyState }: EntityTableShellProps) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-outline-variant bg-surface-container shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="border-b border-outline-variant bg-surface-variant/10 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="type-label-caps text-secondary-fixed-dim">{subtitle}</p>
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
          </div>
          <p className="hidden text-sm text-on-surface-variant md:block">Visual pensado para leitura rapida e alta densidade.</p>
        </div>
      </div>
      {children}
      {emptyState}
    </section>
  );
}
