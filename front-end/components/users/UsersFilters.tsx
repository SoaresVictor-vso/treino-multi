import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import FiltersPanel from "@/components/shared/filters/FiltersPanel";
import { RiFilter3Line, RiListCheck3, RiSearchLine, RiSortDesc } from "react-icons/ri";
import { Role } from "@/lib/roles";

type UserRoleFilter = "all" | Role;
type UserSortOption = "recent" | "name-asc" | "name-desc";

type UsersFiltersProps = {
  search: string;
  role: UserRoleFilter;
  sort: UserSortOption;
  visibleCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: UserRoleFilter) => void;
  onSortChange: (value: UserSortOption) => void;
  onReset: () => void;
};

const roleOptions = [
  { value: "all", label: "Todos" },
  { value: Role.ORG_ADMIN, label: "Org Admin" },
  { value: Role.ORG_SUPPORT, label: "Support" },
  { value: Role.TENANT_ADMIN, label: "Tenant Admin" },
  // { value: Role.TENANT_FINANCIAL, label: "Financeiro" },
  // { value: Role.TENANT_ATTENDANT, label: "Atendimento" },
];

const sortOptions = [
  { value: "recent", label: "Mais recentes" },
  { value: "name-asc", label: "Nome A-Z" },
  { value: "name-desc", label: "Nome Z-A" },
];

export type { UserRoleFilter, UserSortOption };

export default function UsersFilters(props: UsersFiltersProps) {
  const hasActiveFilters = props.search.length > 0 || props.role !== "all" || props.sort !== "recent";

  return (
    <FiltersPanel
      title="Filtros"
      description="Refine a lista por nome, papel ou ordenacao."
      hasActiveFilters={hasActiveFilters}
      onReset={props.onReset}
      icon={<RiFilter3Line size={22} />}
      summary={<>{props.visibleCount} de {props.totalCount} usuários exibidos</>}
    >
      <Input
        id="users-search"
        value={props.search}
        onChange={(event) => props.onSearchChange(event.target.value)}
        placeholder="Buscar por nome"
        leadingIcon={<RiSearchLine size={22} />}
      />
      <Select
        id="users-role"
        value={props.role}
        onChange={(event) => props.onRoleChange(event.target.value as UserRoleFilter)}
        options={roleOptions}
        leadingIcon={<RiListCheck3 size={22} />}
      />
      <Select
        id="users-sort"
        value={props.sort}
        onChange={(event) => props.onSortChange(event.target.value as UserSortOption)}
        options={sortOptions}
        leadingIcon={<RiSortDesc size={22} />}
      />
    </FiltersPanel>
  );
}
