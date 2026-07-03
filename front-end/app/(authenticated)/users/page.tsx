"use client";

import React, { startTransition, useDeferredValue, useEffect } from "react";
import { TenantService } from "@/api/services/tenant";
import { UsersService } from "@/api/services/users";
import { UserListItemDto } from "@/api/dto/user/list-user.dto";
import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import ErrorBox from "@/components/ui/ErrorBox";
import Select from "@/components/ui/Select";
import { getSessionUser } from "@/lib/auth";
import UsersFilters, { type UserRoleFilter, type UserSortOption } from "@/components/users/UsersFilters";
import UsersTable from "@/components/users/UsersTable";

const usersService = new UsersService();
const tenantService = new TenantService();

export default function UsersPage() {
  const sessionUser = getSessionUser();
  const [users, setUsers] = React.useState<UserListItemDto[]>([]);
  const [tenants, setTenants] = React.useState<TenantListItemDto[]>([]);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRoleFilter>("all");
  const [sortBy, setSortBy] = React.useState<UserSortOption>("recent");
  const [tenantFilter, setTenantFilter] = React.useState(sessionUser?.tenantId ?? "");
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (sessionUser?.tenantId) return;

    void (async () => {
      const result = await tenantService.findMultiple({ filter: "all", includeInactive: false });
      if (!result.success || !result.data) return;
      setTenants(result.data);
    })();
  }, [sessionUser?.tenantId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trimmedSearch = deferredSearch.trim();
      const resolvedTenantId = sessionUser?.tenantId ?? (tenantFilter || undefined);
      const result = await usersService.findMultiple({
        tenantId: resolvedTenantId,
        name: trimmedSearch || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        orderBy: sortBy === "name-asc" ? "name" : sortBy === "name-desc" ? "name" : "createdAt",
        limit: 100,
      });
      if (cancelled) return;
      if (!result.success || !result.data) {
        setLoadError(result.error || "Nao foi possivel carregar a listagem de usuarios.");
        setIsLoading(false);
        return;
      }
      startTransition(() => setUsers(result.data?.data || []));
      setLoadError(null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [deferredSearch, roleFilter, sortBy, tenantFilter, sessionUser?.tenantId]);

  const handleReset = () => {
    setSearch("");
    setRoleFilter("all");
    setSortBy("recent");
    if (!sessionUser?.tenantId) setTenantFilter("");
  };

  return (
    <div className="space-y-6 p-4">
      {loadError && <ErrorBox message={loadError} />}
      {isLoading && <p className="text-sm text-on-surface-variant">Carregando usuários...</p>}
      {!sessionUser?.tenantId && (
        <Select
          id="users-tenant"
          value={tenantFilter}
          onChange={(event) => setTenantFilter(event.target.value)}
          options={[
            { value: "", label: "Todos os tenants ativos" },
            ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.tradeName || tenant.name })),
          ]}
        />
      )}
      <UsersFilters
        search={search}
        role={roleFilter}
        sort={sortBy}
        visibleCount={users.length}
        totalCount={users.length}
        onSearchChange={setSearch}
        onRoleChange={setRoleFilter}
        onSortChange={setSortBy}
        onReset={handleReset}
      />
      <UsersTable users={users} />
    </div>
  );
}
