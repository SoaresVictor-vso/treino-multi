import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FiltersPanel from "@/components/shared/filters/FiltersPanel";
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
    <FiltersPanel
      title="Filtros"
      description="Refine a lista por nome, status ou ordenacao."
      hasActiveFilters={hasActiveFilters}
      onReset={props.onReset}
      icon={<RiFilter3Line size={22} />}
      summary={
        <>
          {props.visibleCount} de {props.totalCount} tenants exibidos
        </>
      }
    >
      <Input
        id="tenants-search"
        value={props.search}
        onChange={(event) => props.onSearchChange(event.target.value)}
        placeholder="Buscar por nome do tenant"
        leadingIcon={<RiSearchLine size={22} />}
      />
      <Select
        id="tenants-status"
        value={props.status}
        onChange={(event) => props.onStatusChange(event.target.value as TenantStatusFilter)}
        options={statusOptions}
        leadingIcon={<RiListCheck3 size={22} />}
      />
      <Select
        id="tenants-sort"
        value={props.sort}
        onChange={(event) => props.onSortChange(event.target.value as TenantSortOption)}
        options={sortOptions}
        leadingIcon={<RiSortDesc size={22} />}
      />
      <div className="hidden xl:block" />
    </FiltersPanel>
  );
}
