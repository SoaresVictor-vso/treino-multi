"use client";

import {
    createTenantInitialValues,
    createTenantYupSchema,
    type CreateTenantDto,
} from "@/api/dto/tenant/create-tenant.dto";
import {
    createTenantAdminInitialValues,
    createTenantAdminYupSchema,
    type CreateTenantAdminDto,
} from "@/api/dto/tenant/create-tenant-admin.dto";
import { TenantListItemDto } from "@/api/dto/tenant/list-tenant.dto";
import { ApiResponse } from "@/api/client";
import { TenantService } from "@/api/services/tenant";
import ErrorBox from "@/components/ui/ErrorBox";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Stepper, { StepperStep } from "@/components/ui/Stepper";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
import TenantsFilters, {
    type TenantSortOption,
    type TenantStatusFilter,
} from "@/components/tenants/TenantsFilters";
import TenantsTable from "@/components/tenants/TenantsTable";
import { CNPJ_MASK_REGEX, CPF_MASK_REGEX, PHONE_MASK_REGEX } from "@/lib/constants";
import React, { startTransition, useDeferredValue, useEffect } from "react";
import { RiAddLine, RiAdminLine, RiBuilding2Line, RiLoader4Line, RiRefreshLine, RiShieldCheckLine } from "react-icons/ri";
import * as yup from "yup";

export default function TenantsPage() {
    const tenantServiceRef = React.useRef(new TenantService());
    const [tenants, setTenants] = React.useState<TenantListItemDto[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<TenantStatusFilter>("all");
    const [sortBy, setSortBy] = React.useState<TenantSortOption>("recent");
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const deferredSearch = useDeferredValue(search);

    const requestTenants = async (searchValue: string) => {
        const trimmedSearch = searchValue.trim();
        const result = await tenantServiceRef.current.findMultiple({
            filter: trimmedSearch ? "name" : "all",
            name: trimmedSearch || undefined,
            includeInactive: true,
        });

        if (!result.success || !result.data) {
            setLoadError(result.error || "Nao foi possivel carregar a listagem de tenants.");
            setIsLoading(false);
            return;
        }

        startTransition(() => {
            setTenants(result.data || []);
        });
        setIsLoading(false);
    };

    useEffect(() => {
        let isCancelled = false;

        const syncTenants = async () => {
            const trimmedSearch = deferredSearch.trim();
            const result = await tenantServiceRef.current.findMultiple({
                filter: trimmedSearch ? "name" : "all",
                name: trimmedSearch || undefined,
                includeInactive: true,
            });

            if (isCancelled) return;

            if (!result.success || !result.data) {
                setLoadError(result.error || "Nao foi possivel carregar a listagem de tenants.");
                setIsLoading(false);
                return;
            }

            startTransition(() => {
                setTenants(result.data || []);
            });
            setLoadError(null);
            setIsLoading(false);
        };

        void syncTenants();

        return () => {
            isCancelled = true;
        };
    }, [deferredSearch]);

    const filteredTenants = tenants
        .filter((tenant) => {
            if (statusFilter === "active") return tenant.isActive && !tenant.deletedAt;
            if (statusFilter === "inactive") return !tenant.isActive && !tenant.deletedAt;
            if (statusFilter === "archived") return !!tenant.deletedAt;

            return true;
        })
        .sort((left, right) => {
            if (sortBy === "name-asc") {
                return (left.tradeName || left.name).localeCompare(right.tradeName || right.name);
            }

            if (sortBy === "name-desc") {
                return (right.tradeName || right.name).localeCompare(left.tradeName || left.name);
            }

            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });

    const activeCount = tenants.filter((tenant) => tenant.isActive && !tenant.deletedAt).length;
    const inactiveCount = tenants.filter((tenant) => !tenant.isActive && !tenant.deletedAt).length;
    const archivedCount = tenants.filter((tenant) => !!tenant.deletedAt).length;

    const handleResetFilters = () => {
        setIsLoading(true);
        setSearch("");
        setStatusFilter("all");
        setSortBy("recent");
    };

    const handleCreateTenant = async (tenant: CreateTenantDto, admin: CreateTenantAdminDto) => {
        const result = await tenantServiceRef.current.create(tenant, admin);

        if (result.success) {
            setIsLoading(true);
            handleResetFilters();
            await requestTenants("");
        }

        return result;
    };

    return (
        <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-[24px] border border-outline-variant bg-[radial-gradient(circle_at_top_left,rgba(195,244,0,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <p className="type-label-caps text-secondary-fixed-dim">Tenant management</p>
                    <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl space-y-3">
                            <h2 className="text-3xl font-bold tracking-[-0.03em] text-primary md:text-4xl">
                                Listagem de tenants com foco em operacao, status e leitura rapida.
                            </h2>
                            <p className="max-w-xl text-sm leading-6 text-on-surface-variant md:text-base">
                                A tela agora usa o service real de tenants e segue a direcao visual das referencias em{" "}
                                <span className="font-mono text-primary">referencias-graficas</span>.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end lg:w-auto">
                            <Button
                                variant="outline"
                                className="w-full lg:w-auto"
                                onClick={async () => {
                                    setIsLoading(true);
                                    await requestTenants(deferredSearch);
                                }}
                                disabled={isLoading}
                            >
                                <span className="type-label-caps flex items-center gap-2">
                                    <RiRefreshLine size={20} />
                                    Atualizar
                                </span>
                            </Button>
                            <Button className="w-full lg:w-auto" onClick={() => setIsModalOpen(true)}>
                                <span className="type-label-caps flex items-center gap-2">
                                    <RiAddLine size={22} />
                                    Novo tenant
                                </span>
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <MetricCard label="Ativos" value={activeCount} description="Prontos para uso no ecossistema." />
                    <MetricCard label="Inativos" value={inactiveCount} description="Sem acesso, mas ainda nao arquivados." />
                    <MetricCard label="Arquivados" value={archivedCount} description="Registros mantidos apenas para historico." />
                </section>
            </div>

            <TenantsFilters
                search={search}
                status={statusFilter}
                sort={sortBy}
                visibleCount={filteredTenants.length}
                totalCount={tenants.length}
                onSearchChange={setSearch}
                onStatusChange={setStatusFilter}
                onSortChange={setSortBy}
                onReset={handleResetFilters}
            />

            {loadError ? (
                <section className="rounded-[20px] border border-error/30 bg-error-container/10 p-5">
                    <ErrorBox message={loadError} />
                    <div className="mt-4">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                setIsLoading(true);
                                await requestTenants(deferredSearch);
                            }}
                        >
                            <span className="type-label-caps flex items-center gap-2">
                                <RiRefreshLine size={18} />
                                Tentar novamente
                            </span>
                        </Button>
                    </div>
                </section>
            ) : null}

            {isLoading && tenants.length === 0 ? (
                <section className="rounded-[20px] border border-outline-variant bg-surface-container p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="flex items-center justify-center gap-3 text-on-surface-variant">
                        <RiLoader4Line className="animate-spin text-xl text-primary-fixed-dim" />
                        <span>Carregando tenants...</span>
                    </div>
                </section>
            ) : (
                <TenantsTable tenants={filteredTenants} />
            )}

            {isModalOpen ? (
                <ModalTenant
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    onSubmit={handleCreateTenant}
                />
            ) : null}
        </>
    );
}

function MetricCard(props: { label: string; value: number; description: string }) {
    return (
        <div className="rounded-[20px] border border-outline-variant bg-surface-container p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="type-label-caps text-secondary-fixed-dim">{props.label}</p>
            <p className="mt-3 font-mono text-3xl font-bold text-primary">{String(props.value).padStart(2, "0")}</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{props.description}</p>
        </div>
    );
}

function ModalTenant(props: {
    isModalOpen: boolean;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onSubmit: (tenant: CreateTenantDto, admin: CreateTenantAdminDto) => Promise<ApiResponse<TenantListItemDto>>;
}) {
    const [currentStep, setCurrentStep] = React.useState(0);
    const [tenant, setTenant] = React.useState<CreateTenantDto>({
        ...createTenantInitialValues,
    });
    const [admin, setAdmin] = React.useState<CreateTenantAdminDto>({
        ...createTenantAdminInitialValues,
    });
    const [tenantErrors, setTenantErrors] = React.useState<Partial<Record<keyof CreateTenantDto, string>>>({});
    const [adminErrors, setAdminErrors] = React.useState<Partial<Record<keyof CreateTenantAdminDto, string>>>({});
    const [submitError, setSubmitError] = React.useState<string | null>(null);

    const mapYupErrors = (error: unknown) => {
        if (!(error instanceof yup.ValidationError)) return {};

        const nextErrors: Record<string, string> = {};

        error.inner.forEach((item) => {
            if (item.path) {
                nextErrors[item.path] = item.message;
            }
        });

        return nextErrors;
    };

    const validateTenantForm = async () => {
        try {
            await createTenantYupSchema.validate(tenant, { abortEarly: false });
            setTenantErrors({});
            return true;
        } catch (error) {
            setTenantErrors(mapYupErrors(error) as Partial<Record<keyof CreateTenantDto, string>>);
            return false;
        }
    };

    const validateAdminForm = async () => {
        try {
            await createTenantAdminYupSchema.validate(admin, { abortEarly: false });
            setAdminErrors({});
            return true;
        } catch (error) {
            setAdminErrors(mapYupErrors(error) as Partial<Record<keyof CreateTenantAdminDto, string>>);
            return false;
        }
    };

    const steppers = [
        {
            conf: {
                title: "Empresa contratante",
                description: "Etapa 1 de 2: dados principais do tenant.",
                children: <CompanyForm tenant={tenant} setTenant={setTenant} errors={tenantErrors} />,
            },
            validate: validateTenantForm,
        },
        {
            conf: {
                title: "Administrador",
                description: "Etapa 2 de 2: crie o usuario administrador.",
                children: <AdminForm admin={admin} setAdmin={setAdmin} errors={adminErrors} errorMessage={submitError} />,
            },
            validate: validateAdminForm,
        },
    ];
    const stepConfigs: StepperStep[] = steppers.map((step) => step.conf);

    const handleSubmit = async () => {
        const isAdminValid = await validateAdminForm();
        if (!isAdminValid) return;

        const result = await props.onSubmit(tenant, admin);

        if (!result.success) {
            setSubmitError(result.error || "Nao foi possivel criar o contratante.");
            return;
        }

        props.setIsModalOpen(false);
    };

    const validateStep = async (): Promise<boolean> => {
        return steppers[currentStep].validate();
    };

    const onNextStep = async (target: number) => {
        const isValid = await validateStep();
        if (!isValid) return;

        setCurrentStep(target);
    };

    return (
        <Modal
            isOpen={props.isModalOpen}
            onClose={() => props.setIsModalOpen(false)}
            title="Novo contratante"
            description="Preencha os dados do contratante e finalize a criacao do administrador responsavel pelo tenant."
        >
            <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-3">
                    <ModalInfoCard
                        icon={<RiBuilding2Line size={22} />}
                        title="Tenant"
                        description="Nome, slug, documento e canais principais do contratante."
                    />
                    <ModalInfoCard
                        icon={<RiAdminLine size={22} />}
                        title="Administrador"
                        description="Usuario inicial para acessar e operar o ecossistema."
                    />
                    <ModalInfoCard
                        icon={<RiShieldCheckLine size={22} />}
                        title="Fluxo seguro"
                        description="Validacao por etapa para evitar cadastros incompletos."
                    />
                </div>
                <Stepper
                    steps={stepConfigs}
                    currentStep={currentStep}
                    labels={{
                        cancel: "Cancelar",
                        prev: "Voltar",
                        next: "Avancar",
                        done: "Criar contratante",
                    }}
                    onCancel={() => props.setIsModalOpen(false)}
                    onPrev={(target) => setCurrentStep(target)}
                    onNext={onNextStep}
                    onDone={handleSubmit}
                />
            </div>
        </Modal>
    );
}

function ModalInfoCard(props: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-high/50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant bg-surface-variant/30 text-primary-fixed-dim">
                {props.icon}
            </div>
            <h4 className="mt-4 text-sm font-semibold text-primary">{props.title}</h4>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{props.description}</p>
        </div>
    );
}

function FormSection(props: {
    eyebrow: string;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-[20px] border border-outline-variant bg-surface-container-high/40 p-4 sm:p-5">
            <div className="mb-5">
                <p className="type-label-caps text-secondary-fixed-dim">{props.eyebrow}</p>
                <h4 className="mt-2 text-base font-semibold text-primary">{props.title}</h4>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{props.description}</p>
            </div>
            {props.children}
        </section>
    );
}

function CompanyForm(props: {
    tenant: CreateTenantDto;
    setTenant: React.Dispatch<React.SetStateAction<CreateTenantDto>>;
    errors: Partial<Record<keyof CreateTenantDto, string>>;
}) {
    const updateField = (field: keyof CreateTenantDto, value: string | boolean) => {
        props.setTenant((current) => ({
            ...current,
            [field]: value,
        }));
    };

    return (
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            <FormSection
                eyebrow="Identidade"
                title="Dados principais do contratante"
                description="Defina como o tenant sera identificado nas listagens e no acesso interno."
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        id="tenant-trade-name"
                        label="Nome fantasia *"
                        value={props.tenant.trade_name}
                        error={props.errors.trade_name}
                        onChange={(event) => updateField("trade_name", event.target.value)}
                    />
                    <Input
                        id="tenant-slug"
                        label="Slug *"
                        hint="Usado na identificacao tecnica do tenant."
                        value={props.tenant.slug}
                        error={props.errors.slug}
                        onChange={(event) => updateField("slug", event.target.value.toLowerCase().trim())}
                    />
                    <Input
                        id="tenant-registered-name"
                        label="Razao social"
                        value={props.tenant.registered_name || ""}
                        error={props.errors.registered_name}
                        onChange={(event) => updateField("registered_name", event.target.value)}
                        className="md:col-span-2"
                    />
                    <Input
                        id="tenant-cnpj"
                        label="CNPJ"
                        hint="Opcional. Informe 14 digitos, sem pontuacao."
                        value={props.tenant.cnpj || ""}
                        error={props.errors.cnpj}
                        mask={CNPJ_MASK_REGEX}
                        onChange={(event) => updateField("cnpj", event.target.value.replace(/\D/g, "").slice(0, 14))}
                    />
                    <div className="md:self-end">
                        <Switch
                            id="tenant-is-active"
                            label="Tenant ativo"
                            description="Novos tenants sao criados como ativos neste fluxo."
                            checked
                            disabled
                        />
                    </div>
                </div>
            </FormSection>

            <FormSection
                eyebrow="Contato"
                title="Canais de comunicacao"
                description="Esses dados serao usados para suporte, notificacoes e identificacao operacional."
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        id="tenant-phone"
                        label="Telefone *"
                        hint="Informe 11 digitos, com DDD."
                        value={props.tenant.phone}
                        error={props.errors.phone}
                        mask={PHONE_MASK_REGEX}
                        onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-email"
                        label="E-mail *"
                        type="email"
                        value={props.tenant.email}
                        error={props.errors.email}
                        onChange={(event) => updateField("email", event.target.value.trim())}
                    />
                </div>
            </FormSection>
        </form>
    );
}

function AdminForm(props: {
    admin: CreateTenantAdminDto;
    setAdmin: React.Dispatch<React.SetStateAction<CreateTenantAdminDto>>;
    errors: Partial<Record<keyof CreateTenantAdminDto, string>>;
    errorMessage: string | null;
}) {
    const updateField = (field: keyof CreateTenantAdminDto, value: string) => {
        props.setAdmin((current) => ({
            ...current,
            [field]: value,
        }));
    };

    return (
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            <ErrorBox message={props.errorMessage || ""} />
            <FormSection
                eyebrow="Perfil"
                title="Dados do administrador"
                description="Crie o usuario inicial que vai acessar o tenant assim que o cadastro for concluido."
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        id="tenant-admin-name"
                        label="Nome do administrador *"
                        value={props.admin.name}
                        error={props.errors.name}
                        onChange={(event) => updateField("name", event.target.value)}
                        className="md:col-span-2"
                    />
                    <Input
                        id="tenant-admin-email"
                        label="E-mail do administrador"
                        type="email"
                        value={props.admin.email}
                        error={props.errors.email}
                        onChange={(event) => updateField("email", event.target.value.trim())}
                    />
                    <Input
                        id="tenant-admin-phone"
                        label="Telefone do administrador"
                        hint="Informe 11 digitos, com DDD."
                        value={props.admin.phone}
                        error={props.errors.phone}
                        mask={PHONE_MASK_REGEX}
                        onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-admin-cpf"
                        label="CPF do administrador"
                        hint="Informe 11 digitos, sem pontuacao."
                        value={props.admin.cpf}
                        error={props.errors.cpf}
                        mask={CPF_MASK_REGEX}
                        onChange={(event) => updateField("cpf", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-admin-password"
                        label="Senha do administrador"
                        type="password"
                        hint="Minimo de 8 caracteres."
                        value={props.admin.password}
                        error={props.errors.password}
                        onChange={(event) => updateField("password", event.target.value)}
                    />
                </div>
            </FormSection>
        </form>
    );
}
