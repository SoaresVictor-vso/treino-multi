"use client";

import {
    createTenantInitialValues,
    createTenantYupSchema,
    type CreateTenantDto,
} from "@/api/dto/tenant/create-tenant.dto";
import {
    updateTenantYupSchema,
    type UpdateTenantDto,
} from "@/api/dto/tenant/update-tenant.dto";
import {
    createTenantAdminInitialValues,
    createTenantAdminYupSchema,
    type CreateTenantAdminDto,
} from "@/api/dto/tenant/create-tenant-admin.dto";
import { TenantDetailsDto } from "@/api/dto/tenant/detail-tenant.dto";
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

type TenantModalState =
    | { mode: "create" }
    | {
        mode: "view";
        tenantId: string;
        tenantDetails: TenantDetailsDto | null;
        isLoadingDetails: boolean;
        detailsError: string | null;
    }
    | {
        mode: "edit";
        tenantId: string;
        tenantDetails: TenantDetailsDto | null;
        isLoadingDetails: boolean;
        detailsError: string | null;
    };

type TenantFormValues = CreateTenantDto & {
    isActive: boolean;
};

const createTenantFormInitialValues = (): TenantFormValues => ({
    ...createTenantInitialValues,
    isActive: true,
});

const mapTenantDetailsToFormValues = (tenantDetails: TenantDetailsDto): TenantFormValues => ({
    trade_name: tenantDetails.tradeName || tenantDetails.name,
    slug: tenantDetails.slug,
    cnpj: tenantDetails.cnpj || undefined,
    registered_name: tenantDetails.registeredName || undefined,
    phone: tenantDetails.phone || "",
    email: tenantDetails.email || "",
    isActive: !!(tenantDetails.isActive && !tenantDetails.deletedAt),
});

const mapTenantFormToUpdatePayload = (tenant: TenantFormValues): UpdateTenantDto => ({
    trade_name: tenant.trade_name,
    cnpj: tenant.cnpj || "",
    registered_name: tenant.registered_name || "",
    phone: tenant.phone,
    email: tenant.email,
    isActive: tenant.isActive,
});

const tenantService = new TenantService();

export default function TenantsPage() {
    const [tenants, setTenants] = React.useState<TenantListItemDto[]>([]);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<TenantStatusFilter>("all");
    const [sortBy, setSortBy] = React.useState<TenantSortOption>("recent");
    const [modalState, setModalState] = React.useState<TenantModalState | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const deferredSearch = useDeferredValue(search);
    const debounceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const requestTenants = async (searchValue: string) => {
        const trimmedSearch = searchValue.trim();
        const result = await tenantService.findMultiple({
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
        const trimmedSearch = deferredSearch.trim();

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (!trimmedSearch) {
            const syncAllTenants = async () => {
                const result = await tenantService.findMultiple({
                    filter: "all",
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

            void syncAllTenants();
        } else if (trimmedSearch.length > 3) {
            debounceTimeoutRef.current = setTimeout(() => {
                void (async () => {
                    const result = await tenantService.findMultiple({
                        filter: "name",
                        name: trimmedSearch,
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
                })();
            }, 1000);
        }

        return () => {
            isCancelled = true;
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
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
        const result = await tenantService.create(tenant, admin);

        if (result.success) {
            setIsLoading(true);
            handleResetFilters();
            await requestTenants("");
        }

        return result;
    };

    const handleOpenTenant = (mode: "view" | "edit", tenant: TenantListItemDto) => {
        setModalState({
            mode,
            tenantId: tenant.id,
            tenantDetails: null,
            isLoadingDetails: true,
            detailsError: null,
        });

        void (async () => {
            const result = await tenantService.findDetails(tenant.id);

            setModalState((current) => {
                if (!current || current.mode !== mode || current.tenantId !== tenant.id) {
                    return current;
                }

                if (!result.success || !result.data) {
                    return {
                        ...current,
                        isLoadingDetails: false,
                        detailsError: result.error || "Nao foi possivel carregar os dados do tenant.",
                    };
                }

                return {
                    ...current,
                    tenantDetails: result.data,
                    isLoadingDetails: false,
                    detailsError: null,
                };
            });
        })();
    };

    const handleViewTenant = (tenant: TenantListItemDto) => {
        handleOpenTenant("view", tenant);
    };

    const handleEditTenant = (tenant: TenantListItemDto) => {
        handleOpenTenant("edit", tenant);
    };

    const handleUpdateTenant = async (tenantId: string, tenant: UpdateTenantDto) => {
        const result = await tenantService.update(tenantId, tenant);

        if (result.success) {
            await requestTenants(search);
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
                            <Button className="w-full lg:w-auto" onClick={() => setModalState({ mode: "create" })}>
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
                        <span className="animate-spin text-xl text-primary-fixed-dim">
                            <RiLoader4Line size={20} />
                        </span>
                        <span>Carregando tenants...</span>
                    </div>
                </section>
            ) : (
                <TenantsTable tenants={filteredTenants} onViewTenant={handleViewTenant} onEditTenant={handleEditTenant} />
            )}

            {modalState ? (
                <ModalTenant
                    key={modalState.mode === "create" ? "create-tenant" : `${modalState.mode}-${modalState.tenantId}`}
                    state={modalState}
                    onClose={() => setModalState(null)}
                    onCreate={handleCreateTenant}
                    onUpdate={handleUpdateTenant}
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
    state: TenantModalState;
    onClose: () => void;
    onCreate: (tenant: CreateTenantDto, admin: CreateTenantAdminDto) => Promise<ApiResponse<TenantListItemDto>>;
    onUpdate: (tenantId: string, tenant: UpdateTenantDto) => Promise<ApiResponse<TenantListItemDto>>;
}) {
    const [currentStep, setCurrentStep] = React.useState(0);
    const [tenantDraft, setTenantDraft] = React.useState<TenantFormValues | null>(
        props.state.mode === "create" ? createTenantFormInitialValues : null,
    );
    const [admin, setAdmin] = React.useState<CreateTenantAdminDto>({
        ...createTenantAdminInitialValues,
    });
    const [tenantErrors, setTenantErrors] = React.useState<Partial<Record<keyof CreateTenantDto, string>>>({});
    const [adminErrors, setAdminErrors] = React.useState<Partial<Record<keyof CreateTenantAdminDto, string>>>({});
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const isViewMode = props.state.mode === "view";
    const isEditMode = props.state.mode === "edit";
    const isReadOnlyAdmin = props.state.mode !== "create";
    const isLoadingDetails = props.state.mode === "create" ? false : props.state.isLoadingDetails;
    const detailsError = props.state.mode === "create" ? null : props.state.detailsError;
    const effectiveTenant = tenantDraft
        ?? (props.state.mode !== "create" && props.state.tenantDetails
            ? mapTenantDetailsToFormValues(props.state.tenantDetails)
            : createTenantFormInitialValues());
    const effectiveAdmin = props.state.mode !== "create" && props.state.tenantDetails
        ? {
            name: props.state.tenantDetails.admin?.name || "",
            email: props.state.tenantDetails.admin?.email || "",
            cpf: props.state.tenantDetails.admin?.cpf || "",
            phone: props.state.tenantDetails.admin?.phone || "",
            password: "",
        }
        : admin;

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
            const validationSchema = isEditMode ? updateTenantYupSchema : createTenantYupSchema;
            const values = isEditMode ? mapTenantFormToUpdatePayload(effectiveTenant) : effectiveTenant;

            await validationSchema.validate(values, { abortEarly: false });
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
                description: isViewMode
                    ? "Etapa 1 de 2: consulte os dados principais do tenant."
                    : isEditMode
                        ? "Etapa 1 de 2: atualize os dados editaveis do tenant."
                        : "Etapa 1 de 2: dados principais do tenant.",
                children: <CompanyForm tenant={effectiveTenant} setTenant={setTenantDraft} errors={tenantErrors} disabled={isViewMode} isSlugLocked={isEditMode} />,
            },
            validate: validateTenantForm,
        },
        {
            conf: {
                title: "Administrador",
                description: isViewMode
                    ? "Etapa 2 de 2: consulte os dados do administrador responsavel."
                    : isEditMode
                        ? "Etapa 2 de 2: consulte os dados do administrador. Essa tela nao altera esse usuario."
                        : "Etapa 2 de 2: crie o usuario administrador.",
                children: <AdminForm admin={effectiveAdmin} setAdmin={setAdmin} errors={adminErrors} errorMessage={submitError} disabled={isReadOnlyAdmin} />,
            },
            validate: validateAdminForm,
        },
    ];
    const stepConfigs: StepperStep[] = steppers.map((step) => step.conf);

    const handleSubmit = async () => {
        if (isViewMode) {
            props.onClose();
            return;
        }

        if (isEditMode) {
            const isTenantValid = await validateTenantForm();
            if (!isTenantValid) return;
        } else {
            const isAdminValid = await validateAdminForm();
            if (!isAdminValid) return;
        }

        setIsSubmitting(true);
        const result = props.state.mode === "edit"
            ? await props.onUpdate(props.state.tenantId, mapTenantFormToUpdatePayload(effectiveTenant))
            : await props.onCreate(effectiveTenant, admin);
        setIsSubmitting(false);

        if (!result.success) {
            setSubmitError(result.error || (isEditMode
                ? "Nao foi possivel salvar as alteracoes do contratante."
                : "Nao foi possivel criar o contratante."));
            return;
        }

        props.onClose();
    };

    const validateStep = async (): Promise<boolean> => {
        if (isViewMode) return true;
        return steppers[currentStep].validate();
    };

    const onNextStep = async (target: number) => {
        const isValid = await validateStep();
        if (!isValid) return;

        setCurrentStep(target);
    };

    const handleStepChange = async (target: number) => {
        if (target === currentStep) return;

        if (target < currentStep || isViewMode) {
            setCurrentStep(target);
            return;
        }

        const isValid = await validateStep();
        if (!isValid) return;

        setCurrentStep(target);
    };

    return (
        <Modal
            isOpen
            onClose={props.onClose}
            title={isViewMode ? "Visualizar contratante" : isEditMode ? "Editar contratante" : "Novo contratante"}
            description={
                isViewMode
                    ? "Consulte os dados do tenant e do administrador responsavel. Todos os campos ficam bloqueados para edicao."
                    : isEditMode
                        ? "Atualize os dados do tenant. O slug permanece bloqueado e o administrador e exibido apenas para consulta."
                        : "Preencha os dados do contratante e finalize a criacao do administrador responsavel pelo tenant."
            }
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

                {detailsError ? <ErrorBox message={detailsError} /> : null}

                {isLoadingDetails ? (
                    <div className="rounded-[22px] border border-outline-variant bg-surface-container p-8">
                        <div className="flex items-center justify-center gap-3 text-on-surface-variant">
                            <span className="animate-spin text-xl text-primary-fixed-dim">
                                <RiLoader4Line size={20} />
                            </span>
                            <span>Carregando dados do tenant...</span>
                        </div>
                    </div>
                ) : detailsError ? null : (
                    <Stepper
                        steps={stepConfigs}
                        currentStep={currentStep}
                        labels={{
                            cancel: isViewMode ? "Fechar" : "Cancelar",
                            prev: "Voltar",
                            next: "Avancar",
                            done: isViewMode ? "Fechar" : isEditMode ? "Salvar alteracoes" : "Criar contratante",
                        }}
                        onCancel={props.onClose}
                        onStepChange={handleStepChange}
                        onPrev={(target) => setCurrentStep(target)}
                        onNext={onNextStep}
                        onDone={handleSubmit}
                        isSubmitting={isSubmitting}
                    />
                )}
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
    tenant: TenantFormValues;
    setTenant: React.Dispatch<React.SetStateAction<TenantFormValues | null>>;
    errors: Partial<Record<keyof CreateTenantDto, string>>;
    disabled?: boolean;
    isSlugLocked?: boolean;
}) {
    const updateField = (field: keyof CreateTenantDto, value: string | boolean) => {
        if (props.disabled) return;

        props.setTenant((current) => ({
            ...(current || props.tenant),
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
                        disabled={props.disabled}
                        onChange={(event) => updateField("trade_name", event.target.value)}
                    />
                    <Input
                        id="tenant-slug"
                        label="Slug *"
                        hint={props.isSlugLocked ? "Slug bloqueado apos a criacao do tenant." : "Usado na identificacao tecnica do tenant."}
                        value={props.tenant.slug}
                        error={props.errors.slug}
                        disabled={props.disabled || props.isSlugLocked}
                        onChange={(event) => updateField("slug", event.target.value.toLowerCase().trim())}
                    />
                    <Input
                        id="tenant-registered-name"
                        label="Razao social"
                        value={props.tenant.registered_name || ""}
                        error={props.errors.registered_name}
                        disabled={props.disabled}
                        onChange={(event) => updateField("registered_name", event.target.value)}
                        className="md:col-span-2"
                    />
                    <Input
                        id="tenant-cnpj"
                        label="CNPJ"
                        hint="Opcional. Informe 14 digitos, sem pontuacao."
                        value={props.tenant.cnpj || ""}
                        error={props.errors.cnpj}
                        disabled={props.disabled}
                        mask={CNPJ_MASK_REGEX}
                        onChange={(event) => updateField("cnpj", event.target.value.replace(/\D/g, "").slice(0, 14))}
                    />
                    <div className="md:self-end">
                        <Switch
                            id="tenant-is-active"
                            label="Tenant ativo"
                            description={props.disabled
                                ? "Status atual do tenant no ambiente."
                                : "Ative ou inative o tenant diretamente por esta tela."}
                            checked={props.tenant.isActive}
                            disabled={props.disabled}
                            onChange={(event) => props.setTenant((current) => ({
                                ...(current || props.tenant),
                                isActive: event.target.checked,
                            }))}
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
                        disabled={props.disabled}
                        mask={PHONE_MASK_REGEX}
                        onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-email"
                        label="E-mail *"
                        type="email"
                        value={props.tenant.email}
                        error={props.errors.email}
                        disabled={props.disabled}
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
    disabled?: boolean;
}) {
    const updateField = (field: keyof CreateTenantAdminDto, value: string) => {
        if (props.disabled) return;

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
                        disabled={props.disabled}
                        onChange={(event) => updateField("name", event.target.value)}
                        className="md:col-span-2"
                    />
                    <Input
                        id="tenant-admin-email"
                        label="E-mail do administrador"
                        type="email"
                        value={props.admin.email}
                        error={props.errors.email}
                        disabled={props.disabled}
                        onChange={(event) => updateField("email", event.target.value.trim())}
                    />
                    <Input
                        id="tenant-admin-phone"
                        label="Telefone do administrador"
                        hint="Informe 11 digitos, com DDD."
                        value={props.admin.phone}
                        error={props.errors.phone}
                        disabled={props.disabled}
                        mask={PHONE_MASK_REGEX}
                        onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-admin-cpf"
                        label="CPF do administrador"
                        hint="Informe 11 digitos, sem pontuacao."
                        value={props.admin.cpf}
                        error={props.errors.cpf}
                        disabled={props.disabled}
                        mask={CPF_MASK_REGEX}
                        onChange={(event) => updateField("cpf", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                    <Input
                        id="tenant-admin-password"
                        label="Senha do administrador"
                        type={props.disabled ? "text" : "password"}
                        hint={props.disabled ? "A senha nao e exibida por seguranca." : "Minimo de 8 caracteres."}
                        value={props.disabled ? "Nao disponivel" : props.admin.password}
                        error={props.errors.password}
                        disabled={props.disabled}
                        onChange={(event) => updateField("password", event.target.value)}
                    />
                </div>
            </FormSection>
        </form>
    );
}
