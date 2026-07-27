"use client";

import React, { startTransition, useDeferredValue, useEffect } from "react";
import Button from "@/components/ui/Button";
import { TenantService } from "@/api/services/tenant";
import { UsersService } from "@/api/services/users";
import { UserListItemDto } from "@/api/dto/user/list-user.dto";
import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import ErrorBox from "@/components/ui/ErrorBox";
import Select from "@/components/ui/Select";
import { getSessionUser } from "@/lib/auth";
import { Role } from "@/lib/roles";
import UsersFilters, { type UserRoleFilter, type UserSortOption } from "@/app/(open)/login/UsersFilters";
import UsersTable from "@/app/(open)/login/UsersTable";
import MetricCard from "@/components/ui/MetricCard";
import UserModal from "@/components/users/modal";

const usersService = new UsersService();
const tenantService = new TenantService();

export default function UsersPage() {
  const sessionUser = getSessionUser();
  const isOrgActor = !!sessionUser?.roles?.some((role) => role.startsWith("org:"));
  const [users, setUsers] = React.useState<UserListItemDto[]>([]);
  const [tenants, setTenants] = React.useState<TenantListItemDto[]>([]);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRoleFilter>("all");
  const [sortBy, setSortBy] = React.useState<UserSortOption>("recent");
  const [tenantFilter, setTenantFilter] = React.useState(sessionUser?.tenantId ?? "");
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "view" | "edit">("create");
  const [selectedUser, setSelectedUser] = React.useState<UserListItemDto | null>(null);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!isOrgActor) return;

    void (async () => {
      const result = await tenantService.findMultiple({ filter: "all", includeInactive: false });
      if (!result.success || !result.data) return;
      setTenants(result.data);
    })();
  }, [isOrgActor]);

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
    if (isOrgActor) setTenantFilter("");
  };

  const handleUserSaved = async () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setSearch("");
    setRoleFilter("all");
    setSortBy("recent");
    if (isOrgActor) setTenantFilter("");
    setLoadError(null);
    setIsLoading(true);

    const refreshed = await usersService.findMultiple({
      tenantId: sessionUser?.tenantId ?? (tenantFilter || undefined),
      limit: 100,
    });

    if (refreshed.success && refreshed.data) {
      startTransition(() => setUsers(refreshed?.data?.data || []));
      setLoadError(null);
    } else {
      setLoadError(refreshed.error || "Nao foi possivel recarregar a listagem de usuarios.");
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 p-4">
      <UserMetrics users={users} isOrgActor={isOrgActor} />
      {loadError && <ErrorBox message={loadError} />}
      {isLoading && <p className="text-sm text-on-surface-variant">Carregando usuários...</p>}

      {isOrgActor && (
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
      <div className="flex items-center justify-end">
        <Button onClick={() => { setIsModalOpen(true); setModalMode("create"); }}>Novo usuário</Button>
      </div>
      <UsersTable users={users}
        onView={(user) => { setSelectedUser(user); setIsModalOpen(true); setModalMode("view"); }}
        onEdit={(user) => { setSelectedUser(user); setIsModalOpen(true); setModalMode("edit"); }}
      />
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleUserSaved}
        isOrgActor={isOrgActor}
        sessionTenantId={sessionUser?.tenantId ?? null}
        tenants={tenants}
        mode={modalMode}
        user={selectedUser}
      />
    </div>
  );
}

function countUsersWithRole(users: UserListItemDto[], role: Role) {
  return users.filter((user) => user.userRoles.some((userRole) => userRole.role === role)).length;
}

function UserMetrics(props: { users: UserListItemDto[], isOrgActor: boolean }) {
  const { users, isOrgActor } = props;
  return (
    <section className={`grid gap-3 sm:grid-cols-2 ${isOrgActor ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {isOrgActor && (<MetricCard
        label="Organização"
        value={users.filter((user) => user.tenantId === null).length}
        description="Usuários da Organização."
      />)
      }
      <MetricCard
        label="Administradores"
        value={countUsersWithRole(users, Role.TENANT_ADMIN)}
        description="Usuários com perfil de administrador de um Cliente."
      />
      <MetricCard
        label="Treinadores"
        value={countUsersWithRole(users, Role.TENANT_TRAINER)}
        description="Usuários com perfil de treinador."
      />
      <MetricCard
        label="Alunos"
        value={countUsersWithRole(users, Role.TENANT_CLIENT)}
        description="Usuários com perfil de aluno."
      />
    </section>
  )
}
