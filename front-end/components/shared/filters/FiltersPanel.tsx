import Button from "@/components/ui/Button";
import { ReactNode } from "react";

export type FiltersPanelProps = {
  title: string;
  description: string;
  summary: ReactNode;
  hasActiveFilters: boolean;
  onReset: () => void;
  children: ReactNode;
  icon: ReactNode;
};

export default function FiltersPanel(props: FiltersPanelProps) {
  return (
    <section className="rounded-[20px] border border-outline-variant bg-surface-container p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-surface-variant/20 text-primary-fixed-dim">
            {props.icon}
          </div>
          <div>
            <p className="type-label-caps text-secondary-fixed-dim">{props.title}</p>
            <p className="text-sm text-on-surface-variant">{props.description}</p>
          </div>
        </div>

        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_220px_220px_auto]">
          {props.children}
          <Button variant={props.hasActiveFilters ? "outline" : "ghost"} className="w-full xl:w-auto" onClick={props.onReset}>
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/70 pt-4 text-sm text-on-surface-variant md:flex-row md:items-center md:justify-between">
        <span className="type-label-caps text-secondary-fixed-dim">{props.summary}</span>
      </div>
    </section>
  );
}
