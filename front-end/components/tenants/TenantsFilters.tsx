import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { RiFilter3Line, RiListCheck3, RiSearchLine, RiSortDesc } from "react-icons/ri";

type TenantStatusFilter = "all" | "active" | "inactive" | "archived";
type TenantSortOption = "recent" | "name-asc" | "name-desc";

type TenantsFiltersProps = {
  search: string;
  status: TenantStatusFilter;
  sort: TenantSortOption;
  visibleCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: TenantStatusFilter) => void;
  onSortChange: (value: TenantSortOption) => void;
  onReset: () => void;
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "archived", label: "Arquivados" },
];

const sortOptions = [
  { value: "recent", label: "Mais recentes" },
  { value: "name-asc", label: "Nome A-Z" },
  { value: "name-desc", label: "Nome Z-A" },
];

export type { TenantSortOption, TenantStatusFilter };

export default function TenantsFilters(props: TenantsFiltersProps) {
  const hasActiveFilters = props.search.length > 0 || props.status !== "all" || props.sort !== "recent";

  return (
    <section className="rounded-[20px] border border-outline-variant bg-surface-container p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-surface-variant/20 text-primary-fixed-dim">
            <RiFilter3Line className="text-lg" />
          </div>
          <div>
            <p className="type-label-caps text-secondary-fixed-dim">Filtros</p>
            <p className="text-sm text-on-surface-variant">Refine a lista por nome, status ou ordenacao.</p>
          </div>
        </div>

        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_220px_220px_auto]">
          <Input
            id="tenants-search"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Buscar por nome do tenant"
            leadingIcon={<RiSearchLine className="text-lg" />}
          />
          <Select
            id="tenants-status"
            value={props.status}
            onChange={(event) => props.onStatusChange(event.target.value as TenantStatusFilter)}
            options={statusOptions}
            leadingIcon={<RiListCheck3 className="text-lg" />}
          />
          <Select
            id="tenants-sort"
            value={props.sort}
            onChange={(event) => props.onSortChange(event.target.value as TenantSortOption)}
            options={sortOptions}
            leadingIcon={<RiSortDesc className="text-lg" />}
          />
          <Button
            variant={hasActiveFilters ? "outline" : "ghost"}
            className="w-full xl:w-auto"
            onClick={props.onReset}
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/70 pt-4 text-sm text-on-surface-variant md:flex-row md:items-center md:justify-between">
        <span className="type-label-caps text-secondary-fixed-dim">
          {props.visibleCount} de {props.totalCount} tenants exibidos
        </span>
        <span>Busca conectada ao service de tenants, com filtro por nome no backend.</span>
      </div>
    </section>
  );
}
