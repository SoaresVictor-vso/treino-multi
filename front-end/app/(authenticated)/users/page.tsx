"use client";

import React, { startTransition, useDeferredValue, useEffect } from "react";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { TenantService } from "@/api/services/tenant";
import { UsersService } from "@/api/services/users";
import { CreateUserDto } from "@/api/dto/user/create-user.dto";
import { UserListItemDto } from "@/api/dto/user/list-user.dto";
import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import ErrorBox from "@/components/ui/ErrorBox";
import Select from "@/components/ui/Select";
import { getSessionUser } from "@/lib/auth";
import { Role } from "@/lib/roles";
import UsersFilters, { type UserRoleFilter, type UserSortOption } from "@/app/(open)/login/UsersFilters";
import UsersTable from "@/app/(open)/login/UsersTable";
import * as yup from "yup";
import { CNPJ_MASK_REGEX, CPF_MASK_REGEX, CPF_REGEX, EMAIL_REGEX, PHONE_MASK_REGEX, PHONE_REGEX } from "@/lib/constants";

const usersService = new UsersService();
const tenantService = new TenantService();

const createUserSchema = yup.object({
  name: yup.string().trim().required("Nome da pessoa é obrigatório").min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: yup.string().trim().required("E-mail é obrigatório").matches(EMAIL_REGEX, "Digite um e-mail válido"),
  document: yup.string().required("Documento é obrigatório").matches(CPF_REGEX, "Digite um CPF válido"),
  phone: yup.string().required("Telefone é obrigatório").matches(PHONE_REGEX, "Digite um telefone válido"),
  password: yup.string().required("Senha é obrigatória").min(8, "A senha deve ter pelo menos 8 caracteres"),
  passwordConfirmation: yup
    .string()
    .required("Confirmação de senha é obrigatória")
    .oneOf([yup.ref("password")], "As senhas não conferem."),
});

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
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
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

  const handleCreateUser = async (payload: CreateUserDto) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await usersService.create(payload);
    setIsSubmitting(false);

    if (!result.success || !result.data) {
      setSubmitError(result.error || "Nao foi possivel criar o usuario.");
      return;
    }

    setIsCreateOpen(false);
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
      {loadError && <ErrorBox message={loadError} />}
      {isLoading && <p className="text-sm text-on-surface-variant">Carregando usuários...</p>}
      <div className="flex items-center justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>Novo usuário</Button>
      </div>
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
      <UsersTable users={users} />
      <UserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateUser}
        isOrgActor={isOrgActor}
        sessionTenantId={sessionUser?.tenantId ?? null}
        tenants={tenants}
        isSubmitting={isSubmitting}
        error={submitError}
      />
    </div>
  );
}

function UserModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserDto) => Promise<void>;
  isOrgActor: boolean;
  sessionTenantId: string | null;
  tenants: TenantListItemDto[];
  isSubmitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    document: "",
    phone: "",
    tenantId: "",
    password: "",
    passwordConfirmation: "",
    isActive: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!props.isOpen) return;
    setForm({
      name: "",
      email: "",
      document: "",
      phone: "",
      tenantId: "",
      password: "",
      passwordConfirmation: "",
      isActive: true,
    });
    setErrors({});
  }, [props.isOpen]);

  const effectiveTenantId = props.isOrgActor ? form.tenantId || null : props.sessionTenantId;
  const context: CreateUserDto["context"] = props.isOrgActor
    ? (effectiveTenantId ? "tenant" : "organization")
    : "tenant";
  const roles = props.isOrgActor
    ? (effectiveTenantId ? [Role.TENANT_ADMIN] : [Role.ORG_ADMIN])
    : [Role.TENANT_ADMIN];

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.document.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.password.length >= 8 &&
    form.password === form.passwordConfirmation &&
    !props.isSubmitting;

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createUserSchema.validate(form, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (!(error instanceof yup.ValidationError)) return;

      const nextErrors: Record<string, string> = {};
      error.inner.forEach((validationError) => {
        if (validationError.path && !nextErrors[validationError.path]) {
          nextErrors[validationError.path] = validationError.message;
        }
      });
      setErrors(nextErrors);
      return;
    }

    await props.onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      document: form.document.trim() || null,
      phone: form.phone.trim() || null,
      tenantId: effectiveTenantId,
      context,
      password: form.password,
      isActive: form.isActive,
      roles,
    });
  }

  return (
    <Modal
      isOpen={props.isOpen}
      title="Novo usuário"
      description="Cadastre os dados pessoais e de acesso."
      onClose={props.onClose}
    >
      <form
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        <section className="grid gap-4 md:grid-cols-2">
          <Input
            id="user-name"
            label="Nome da pessoa"
            required
            error={errors.name}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
          <Input
            id="user-email"
            label="E-mail"
            type="email"
            required
            error={errors.email}
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
          <Input
            id="user-document"
            label="Documento"
            required
            error={errors.document}
            value={form.document}
            onChange={(event) => updateField("document", event.target.value.replace(/\D/g, "").slice(0, 14))}
            mask={[
              { ...CPF_MASK_REGEX, maxLength: 11 },
              { ...CNPJ_MASK_REGEX, minLength: 12 }
            ]}
          />
          <Input
            id="user-phone"
            label="Telefone"
            required
            error={errors.phone}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
            mask={PHONE_MASK_REGEX}
          />
        </section>

        {props.isOrgActor ? (
          <Select
            id="user-tenant"
            label="Tenant"
            value={form.tenantId}
            onChange={(event) => updateField("tenantId", event.target.value)}
            placeholder="Organização"
            options={[
              // { tradeName: "Limpar", id: '', name: '' },
              ...props.tenants
            ].map((tenant) => ({
              value: tenant.id,
              label: tenant.tradeName || tenant.name,
            }))}
            canClear
          />
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
            Tenant fixo: {props.sessionTenantId ?? "indisponível"}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <Input
            id="user-password"
            label="Senha"
            type="password"
            required
            error={errors.password}
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
          />
          <Input
            id="user-password-confirmation"
            label="Confirmação"
            type="password"
            required
            error={errors.passwordConfirmation}
            value={form.passwordConfirmation}
            onChange={(event) => updateField("passwordConfirmation", event.target.value)}
          />
        </section>

        <Switch
          id="user-active"
          label="Ativo"
          checked={form.isActive}
          onChange={(event) => updateField("isActive", event.target.checked)}
        />

        {props.error && <ErrorBox message={props.error} />}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={props.onClose} disabled={props.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {props.isSubmitting ? "Salvando..." : "Criar usuário"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
