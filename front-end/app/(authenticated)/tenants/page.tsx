"use client";

import Button from "@/components/ui/Button";
import {
    createTenantInitialValues,
    createTenantYupSchema,
    type CreateTenantDto,
} from "@/api/dto/tenant/create-tenant.dto";
import {
    createTenantAdminYupSchema,
    createTenantAdminInitialValues,
    type CreateTenantAdminDto,
} from "@/api/dto/tenant/create-tenant-admin.dto";
import ErrorBox from "@/components/ui/ErrorBox";
import Input, { type InputMask } from "@/components/ui/Input";
import React, { useEffect } from "react";
import { RiFunctionAddLine } from "react-icons/ri";
import * as yup from "yup";
import { ResultCreateTenant, TenantService } from "@/api/services/tenant";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import Stepper, { StepperStep } from "@/components/ui/Stepper";
import { CNPJ_MASK_REGEX, CPF_MASK_REGEX, PHONE_MASK_REGEX } from "@/lib/constants";

export default function TenantsPage() {
    const [tipoFiltro, setTipoFiltro] = React.useState<"all" | "name">("all");
    const [name, setName] = React.useState("");
    const [errors, setErrors] = React.useState<{ name?: string }>({});
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const tenantService = new TenantService();

    const buscarTodos = () => {
        setTipoFiltro("all");
        setName("");
        setErrors({});
        handleSubmit("all");
    };

    const buscarPorNome = (nome: string) => {
        const trimmedName = nome.trim();
        setName(trimmedName);
        if (!trimmedName) return;
        setTipoFiltro("name");
        handleSubmit("name", trimmedName);
    };

    const handleSubmit = async (filter?: "all" | "name", filterName?: string) => {
        try {
            await filterSchema.validate({ tipoFiltro: filter, name: filterName }, { abortEarly: false });
            setErrors({});

            const result = await tenantService.findMultiple({
                filter: filter || undefined,
                name: filterName || "",
            });
            console.log("Filter applied:", { tipoFiltro: filter, name: filterName }, result);
        } catch (error) {
            if (error instanceof yup.ValidationError) {
                const newErrors: Record<string, string> = {};
                error.inner.forEach((err) => {
                    if (err.path) {
                        newErrors[err.path] = err.message;
                    }
                });
                setErrors(newErrors);
            }
        }
    };

    const filterSchema = yup.object().shape({
        tipoFiltro: yup.string().oneOf(["all", "name"]).required("Tipo de filtro é obrigatório"),
        name: yup.string().when("tipoFiltro", (tipoFiltro, schema) =>
            String(tipoFiltro) === "name"
                ? schema.required("Nome é obrigatório").min(1, "Nome deve ter pelo menos 1 caractere")
                : schema,
        ),
    });

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-headline-lg text-primary tracking-tight">Contratantes</h2>
                    <p className="text-on-surface-variant text-body-md">Gerencie e monitore métricas de desempenho para todos os contratantes.</p>
                </div>
                <Button className="w-auto" onClick={() => setIsModalOpen(true)} variant="default">
                    <span className="font-label-caps text-label-caps text-md flex items-center gap-2">
                        <RiFunctionAddLine size={20} />
                        Adicionar Contratante
                    </span>
                </Button>
            </div>
            <div className="inline-flex items-center gap-4 mt-6">
                <Button variant={tipoFiltro === "all" ? "default" : "outline"} onClick={buscarTodos}>
                    Todos
                </Button>
                <Input
                    label="Nome do Tenant"
                    id="name"
                    value={name}
                    onBlur={(e) => buscarPorNome(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            buscarPorNome(name);
                        }
                    }}
                    onChange={(e) => setName(e.target.value)}
                />
                <ErrorBox message={errors.name || null} />
            </div>
            <ModalTenant
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                onSubmit={tenantService.create.bind(tenantService)}
                callback={buscarTodos}
            />
        </>
    );
}

function ModalTenant(props: {
    isModalOpen: boolean;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onSubmit: (tenant: CreateTenantDto, admin: CreateTenantAdminDto) => Promise<ResultCreateTenant>;
    callback?: () => void;
}) {
    const [currentStep, setCurrentStep] = React.useState(0);
    const [tenantErrors, setTenantErrors] = React.useState<Partial<Record<keyof CreateTenantDto, string>>>({});
    const [adminErrors, setAdminErrors] = React.useState<Partial<Record<keyof CreateTenantAdminDto, string>>>({});
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const tenantRef = React.useRef<CreateTenantDto>({
        ...createTenantInitialValues,
    });
    const adminRef = React.useRef<CreateTenantAdminDto>({
        ...createTenantAdminInitialValues,
    });

    useEffect(() => {
        tenantRef.current = { ...createTenantInitialValues };
        adminRef.current = { ...createTenantAdminInitialValues };
        setTenantErrors({});
        setAdminErrors({});
        setSubmitError(null);
        setCurrentStep(0);
    }, [props.isModalOpen]);

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
            await createTenantYupSchema.validate(tenantRef.current, { abortEarly: false });
            setTenantErrors({});
            return true;
        } catch (error) {
            console.error("Erro de validação do tenant:", error);
            setTenantErrors(mapYupErrors(error) as Partial<Record<keyof CreateTenantDto, string>>);
            return false;
        }
    };

    const validateAdminForm = async () => {
        try {
            await createTenantAdminYupSchema.validate(adminRef.current, { abortEarly: false });
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
                title: "Empresa Contratante",
                description: "Etapa 1 de 2: dados do contratante.",
                children: <CompanyForm tenantRef={tenantRef} errors={tenantErrors} />,
            },
            validate: validateTenantForm,
        }, {
            conf: {
                title: "Administrador",
                description: "Etapa 2 de 2: crie o usuário administrador.",
                children: <AdminForm adminRef={adminRef} errors={adminErrors} errorMessage={submitError} />,
            },
            validate: validateAdminForm,
        }
    ]



    const handleSubmit = async () => {
        const isAdminValid = await validateAdminForm();
        if (!isAdminValid) return;


        console.log("Submitting tenant data:", tenantRef.current, adminRef.current);
        try {
            const result =await props.onSubmit(tenantRef.current, adminRef.current);
            if (!result.success) {
                setSubmitError(result.error || "Não foi possível criar o contratante.");
                return;
            }

            props.setIsModalOpen(false);
            if (props.callback) {
                props.callback();
            }
        } catch (error) {
            console.error(error);
            setSubmitError("Não foi possível criar o contratante.");
            return;
        }
    };

    const validateStep = async (): Promise<boolean> => {
        console.log("Validating step:", currentStep);
        return await steppers[currentStep].validate()
    };

    const onNextStep = async (target: number) => {
        const isValid = await validateStep();
        if (!isValid) return;


        setCurrentStep(target);
    }

    return (
        <Modal
            isOpen={props.isModalOpen}
            onClose={() => props.setIsModalOpen(false)}
            title="Novo contratante"
            description="Preencha os dados do contratante."
        >
            <div className="space-y-4">
                <Stepper
                    steps={[steppers.map(s => s.conf) as StepperStep[]][0]}
                    currentStep={currentStep}
                    labels={{
                        cancel: "Cancelar",
                        prev: "Voltar",
                        next: "Avançar",
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

function CompanyForm(props: {
    tenantRef: React.RefObject<CreateTenantDto>;
    errors: Partial<Record<keyof CreateTenantDto, string>>;
}) {
    const updateField = (field: keyof CreateTenantDto, value: string | boolean) => {
        props.tenantRef.current = {
            ...props.tenantRef.current,
            [field]: value,
        };
    };

    return (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <div>
                <h4 className="text-sm font-semibold text-primary">Dados do tenant</h4>
                <p className="text-xs text-on-surface-variant">Informe os dados basicos.</p>
            </div>
            <Input
                id="tenant-trade-name"
                label="Nome fantasia *"
                defaultValue={props.tenantRef.current.trade_name}
                error={props.errors.trade_name}
                onChange={(e) => updateField("trade_name", e.target.value)}
            />
            <Input
                id="tenant-slug"
                label="Slug *"
                defaultValue={props.tenantRef.current.slug}
                error={props.errors.slug}
                onChange={(e) => updateField("slug", e.target.value.toLowerCase().trim())}
            />
            <Input
                id="tenant-cnpj"
                label="CNPJ"
                hint="Opcional. Informe 14 dígitos, sem pontuação."
                defaultValue={props.tenantRef.current.cnpj || ""}
                error={props.errors.cnpj}
                mask={CNPJ_MASK_REGEX}
                onChange={(e) => updateField("cnpj", e.target.value.replace(/\D/g, "").slice(0, 14))}
            />
            <Input
                id="tenant-registered-name"
                label="Razão social"
                defaultValue={props.tenantRef.current.registered_name || ""}
                error={props.errors.registered_name}
                onChange={(e) => updateField("registered_name", e.target.value)}
            />
            <Input
                id="tenant-phone"
                label="Telefone *"
                hint="Informe 11 dígitos, com DDD."
                defaultValue={props.tenantRef.current.phone}
                error={props.errors.phone}
                mask={PHONE_MASK_REGEX}
                onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
            <Input
                id="tenant-email"
                label="E-mail *"
                type="email"
                defaultValue={props.tenantRef.current.email}
                error={props.errors.email}
                onChange={(e) => updateField("email", e.target.value.trim())}
            />
            <Switch
                id="tenant-is-active"
                label="Tenant ativo"
                checked={true}
                disabled
            />
        </form>
    );
}

function AdminForm(props: {
    adminRef: React.RefObject<CreateTenantAdminDto>;
    errors: Partial<Record<keyof CreateTenantAdminDto, string>>;
    errorMessage: string | null;
}) {
    const updateField = (field: keyof CreateTenantAdminDto, value: string) => {
        props.adminRef.current = {
            ...props.adminRef.current,
            [field]: value,
        };
    };

    return (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <ErrorBox message={props.errorMessage || ""} />
            <div>
                <h4 className="text-sm font-semibold text-primary">Administrador</h4>
                <p className="text-xs text-on-surface-variant">Formulario isolado para os dados do administrador.</p>
            </div>
            <Input
                id="tenant-admin-name"
                label="Nome do administrador *"
                defaultValue={props.adminRef.current.name}
                error={props.errors.name}
                onChange={(e) => updateField("name", e.target.value)}
            />
            <Input
                id="tenant-admin-email"
                label="E-mail do administrador"
                type="email"
                defaultValue={props.adminRef.current.email}
                error={props.errors.email}
                onChange={(e) => updateField("email", e.target.value.trim())}
            />
            <Input
                id="tenant-admin-cpf"
                label="CPF do administrador"
                hint="Informe 11 dígitos, sem pontuação."
                defaultValue={props.adminRef.current.cpf}
                error={props.errors.cpf}
                mask={CPF_MASK_REGEX}
                onChange={(e) => updateField("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
            <Input
                id="tenant-admin-phone"
                label="Telefone do administrador"
                hint="Informe 11 dígitos, com DDD."
                defaultValue={props.adminRef.current.phone}
                error={props.errors.phone}
                mask={PHONE_MASK_REGEX}
                onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
            <Input
                id="tenant-admin-password"
                label="Senha do administrador"
                type="password"
                defaultValue={props.adminRef.current.password}
                error={props.errors.password}
                onChange={(e) => updateField("password", e.target.value)}
            />
        </form>
    );
}
