"use client";

import { CreateTenantDto } from "@/api/dto/create-tenant.dto";
import { TenantService } from "@/api/services/tenant";
import Button from "@/components/ui/Button";
import ErrorBox from "@/components/ui/ErrorBox";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Stepper, { StepperStep } from "@/components/ui/Stepper";
import Switch from "@/components/ui/Switch";
import validateEmail from "@/utilities/validators/email";
import React from "react";
import { RiFunctionAddLine } from "react-icons/ri";
import * as yup from "yup";

type TenantStep = 1 | 2;
type TenantField = keyof CreateTenantDto;
type TenantErrorField = TenantField | "confirmAdminPassword";

const STEP_1_FIELDS: TenantErrorField[] = ["name", "slug"];
const STEP_2_FIELDS: TenantErrorField[] = [
    "adminName",
    "adminEmail",
    "adminDocument",
    "adminPhone",
    "adminPassword",
    "confirmAdminPassword",
];

const filterSchema = yup.object().shape({
    tipoFiltro: yup.string().oneOf(["all", "name"]).required("Tipo de filtro é obrigatório"),
    name: yup.string().when("tipoFiltro", (tipoFiltro, schema) => {
        return String(tipoFiltro) === "name"
            ? schema.required("Nome é obrigatório").min(1, "Nome deve ter pelo menos 1 caractere")
            : schema;
    }),
});

const tenantStepSchema = yup.object({
    name: yup
        .string()
        .required("Nome é obrigatório")
        .min(2, "Nome deve ter pelo menos 2 caracteres")
        .max(120, "Nome deve ter no máximo 120 caracteres"),
    slug: yup
        .string()
        .required("Slug é obrigatório")
        .min(2, "Slug deve ter pelo menos 2 caracteres")
        .max(60, "Slug deve ter no máximo 60 caracteres")
        .matches(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
});

const adminStepSchema = yup.object({
    adminName: yup
        .string()
        .required("Nome do administrador é obrigatório")
        .min(2, "Nome do administrador deve ter pelo menos 2 caracteres")
        .max(120, "Nome do administrador deve ter no máximo 120 caracteres"),
    adminEmail: yup
        .string()
        .required("E-mail do administrador é obrigatório")
        .test("is-valid-email", "Digite um e-mail válido", (value) => !!value && validateEmail(value)),
    adminDocument: yup
        .string()
        .required("Documento do administrador é obrigatório")
        .matches(/^\d{11}$/, "Documento deve conter exatamente 11 dígitos"),
    adminPhone: yup
        .string()
        .optional()
        .max(30, "Telefone deve ter no máximo 30 caracteres"),
    adminPassword: yup
        .string()
        .required("Senha do administrador é obrigatória")
        .min(8, "Senha deve ter pelo menos 8 caracteres"),
    confirmAdminPassword: yup
        .string()
        .required("Confirmação de senha é obrigatória")
        .oneOf([yup.ref("adminPassword")], "As senhas devem ser iguais"),
    isActive: yup.boolean().required(),
});

export default function Tenants() {
    const [tipoFiltro, setTipoFiltro] = React.useState<"all" | "name" | null>(null);
    const [name, setName] = React.useState("");
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [tenantForm, setTenantForm] = React.useState(new CreateTenantDto());
    const [confirmAdminPassword, setConfirmAdminPassword] = React.useState("");
    const [tenantFormErrors, setTenantFormErrors] = React.useState<Record<string, string>>({});
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [currentStep, setCurrentStep] = React.useState<TenantStep>(1);
    const [nextDisabled, setNextDisabled] = React.useState(false);
    const [stepTouched, setStepTouched] = React.useState<Record<TenantStep, boolean>>({
        1: false,
        2: false,
    });

    const tenantService = new TenantService();

    const handleSubmit = async (filter?: "all" | "name", name?: string) => {
        try {
            await filterSchema.validate({ tipoFiltro: filter, name }, { abortEarly: false });
            setErrors({});
            // Handle filter submission here

            const result = await tenantService.findMultiple({
                filter: filter || undefined,
                name: name || ""
            });
            console.log("Filter applied:", { tipoFiltro: filter, name }, result);
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

    const buscarTodos = () => {
        setTipoFiltro("all");
        setName("");
        setErrors({});
        handleSubmit("all");
    }

    const buscarPorNome = (nome: string) => {
        nome = nome.trim();
        setName(nome);
        if (!nome) return;
        setTipoFiltro("name");
        handleSubmit("name", nome);
    }

    const handleOpenCreateModal = () => {
        setTenantForm(new CreateTenantDto());
        setConfirmAdminPassword("");
        setTenantFormErrors({});
        setSubmitError(null);
        setCurrentStep(1);
        setStepTouched({ 1: false, 2: false });
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        if (isSubmitting) return;
        setIsCreateModalOpen(false);
    };

    const clearFieldError = (field: TenantErrorField) => {
        setTenantFormErrors((current) => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    };

    const clearStepErrors = (fields: TenantErrorField[]) => {
        setTenantFormErrors((current) => {
            const next = { ...current };
            fields.forEach((field) => {
                delete next[field];
            });
            return next;
        });
    };

    const getFieldError = (field: TenantErrorField, step: TenantStep) => {
        return stepTouched[step] ? tenantFormErrors[field] : undefined;
    };

    const updateTenantForm = (field: keyof CreateTenantDto, value: string | boolean) => {
        setTenantForm((current) => new CreateTenantDto({ ...current, [field]: value }));
        clearFieldError(field);
    };

    const mapValidationErrors = (error: yup.ValidationError) => {
        const newErrors: Record<string, string> = {};
        error.inner.forEach((err) => {
            if (err.path) {
                newErrors[err.path] = err.message;
            }
        });
        return newErrors;
    };

    const validateStep = async (step: TenantStep) => {
        setStepTouched((current) => ({ ...current, [step]: true }));
        try {
            if (step === 1) {
                await tenantStepSchema.validate(tenantForm, { abortEarly: false });
                clearStepErrors(STEP_1_FIELDS);
                return true;
            }

            await adminStepSchema.validate(
                { ...tenantForm, confirmAdminPassword },
                { abortEarly: false }
            );
            clearStepErrors(STEP_2_FIELDS);
            return true;
        } catch (error) {
            if (error instanceof yup.ValidationError) {
                const fieldsToClear = step === 1 ? STEP_1_FIELDS : STEP_2_FIELDS;
                const nextErrors = mapValidationErrors(error);
                setTenantFormErrors((current) => {
                    const merged = { ...current };
                    fieldsToClear.forEach((field) => {
                        delete merged[field];
                    });
                    return { ...merged, ...nextErrors };
                });
            }
            return false;
        }
    };

    const handleNextStep = async () => {
        const isValid = await validateStep(1);
        if (!isValid) return;
        // disable next button momentarily to prevent double clicks
        setNextDisabled(true);
        setTimeout(() => setNextDisabled(false), 100);
        setCurrentStep(2);
        clearStepErrors(STEP_2_FIELDS);
    };

    const handlePreviousStep = () => {
        if (isSubmitting) return;
        clearStepErrors(STEP_1_FIELDS);
        setCurrentStep(1);
    };

    const handleCreateTenant = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const isValid = await validateStep(2);
        if (!isValid) return;

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            setTenantFormErrors({});

            const response = await tenantService.create(tenantForm);

            if (!response.success) {
                setSubmitError(response.error || "Não foi possível criar o contratante.");
                return;
            }

            setIsCreateModalOpen(false);
            setTenantForm(new CreateTenantDto());
            setConfirmAdminPassword("");
            setCurrentStep(1);
            setStepTouched({ 1: false, 2: false });
            await handleSubmit(tipoFiltro || "all", name);
        } catch (error) {
            if (error instanceof yup.ValidationError) {
                setTenantFormErrors(mapValidationErrors(error));
                return;
            }

            setSubmitError("Não foi possível criar o contratante.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const steps: StepperStep[] = [
        {
            title: "Tenant",
            children: (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-primary">Dados do tenant</h4>
                        <p className="text-xs text-on-surface-variant">Informe os dados básicos antes de seguir para o usuário administrador.</p>
                    </div>
                    <Input
                        id="tenant-name"
                        label="Nome"
                        value={tenantForm.name}
                        onChange={(e) => updateTenantForm("name", e.target.value)}
                        error={getFieldError("name", 1)}
                    />
                    <Input
                        id="tenant-slug"
                        label="Slug"
                        value={tenantForm.slug}
                        onChange={(e) => updateTenantForm("slug", e.target.value.toLowerCase().trim())}
                        error={getFieldError("slug", 1)}
                    />
                    <Switch
                        id="tenant-is-active"
                        label="Tenant ativo"
                        description="Ativado por padrão para novos contratantes."
                        checked={tenantForm.isActive}
                        disabled
                        onChange={() => undefined}
                    />
                </div>
            ),
        },
        {
            title: "Administrador",
            children: (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-primary">Administrador</h4>
                        <p className="text-xs text-on-surface-variant">Crie o usuário inicial com acesso administrativo ao tenant.</p>
                    </div>
                    <Input
                        id="tenant-admin-name"
                        label="Nome do administrador"
                        value={tenantForm.adminName}
                        onChange={(e) => updateTenantForm("adminName", e.target.value)}
                        error={getFieldError("adminName", 2)}
                    />
                    <Input
                        id="tenant-admin-email"
                        label="E-mail do administrador"
                        type="email"
                        value={tenantForm.adminEmail}
                        onChange={(e) => updateTenantForm("adminEmail", e.target.value.trim())}
                        error={getFieldError("adminEmail", 2)}
                    />
                    <Input
                        id="tenant-admin-document"
                        label="Documento do administrador"
                        value={tenantForm.adminDocument}
                        onChange={(e) => updateTenantForm("adminDocument", e.target.value.replace(/\D/g, "").slice(0, 11))}
                        error={getFieldError("adminDocument", 2)}
                        hint="Informe 11 dígitos, sem pontuação."
                    />
                    <Input
                        id="tenant-admin-phone"
                        label="Telefone do administrador"
                        value={tenantForm.adminPhone}
                        onChange={(e) => updateTenantForm("adminPhone", e.target.value)}
                        error={getFieldError("adminPhone", 2)}
                    />
                    <Input
                        id="tenant-admin-password"
                        label="Senha do administrador"
                        type="password"
                        value={tenantForm.adminPassword}
                        onChange={(e) => updateTenantForm("adminPassword", e.target.value)}
                        error={getFieldError("adminPassword", 2)}
                    />
                    <Input
                        id="tenant-admin-password-confirm"
                        label="Confirme a senha"
                        type="password"
                                value={confirmAdminPassword}
                                onChange={(e) => {
                                    setConfirmAdminPassword(e.target.value);
                                    clearFieldError("confirmAdminPassword");
                                }}
                                error={getFieldError("confirmAdminPassword", 2)}
                            />
                </div>
            ),
        },
    ];

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-headline-lg text-primary tracking-tight">Contratantes</h2>
                    <p className="text-on-surface-variant text-body-md">Gerencie e monitore métricas de desempenho para todos os contratantes.</p>
                </div>
                <Button className="w-auto" onClick={handleOpenCreateModal}>
                    <span className="font-label-caps text-label-caps text-md flex items-center gap-2">
                        <RiFunctionAddLine size={20} />
                        Adicionar Contratante
                    </span>
                </Button>
            </div>
            <div className="inline-flex items-center gap-4 mt-6">
                <Button
                    variant={tipoFiltro === "all" ? "default" : "outline"}
                    onClick={buscarTodos}>
                    Todos
                </Button>
                <Input
                    label="Nome do Tenant" id="name" value={name}
                    onBlur={(e) => buscarPorNome(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            buscarPorNome(name);
                        }
                    }}
                    onChange={(e) => setName(e.target.value)}
                />
                <ErrorBox message={errors.name} />

            </div>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                title="Novo contratante"
                description={currentStep === 1 ? "Etapa 1 de 2: dados do tenant." : "Etapa 2 de 2: crie o usuário administrador."}
            >
                <form className="space-y-4" onSubmit={handleCreateTenant}>
                    <ErrorBox message={submitError} />
                    <Stepper
                        steps={steps}
                        currentStep={currentStep - 1}
                        labels={{
                            cancel: "Cancelar",
                            prev: "Voltar",
                            next: "Avançar",
                            done: isSubmitting ? "Salvando..." : "Criar contratante",
                        }}
                        onCancel={handleCloseCreateModal}
                        onPrev={handlePreviousStep}
                        onNext={handleNextStep}
                        doneButtonType="submit"
                        isSubmitting={isSubmitting}
                        isNextDisabled={nextDisabled}
                    />
                </form>
            </Modal>
        </>
    )

    // return (
    //     <div className="p-4">
    //         <form onSubmit={handleSubmit}>
    //             <div className="grid grid-cols-3 gap-4">
    //                 <div>
    //                     <Select
    //                         options={TENTANT_SELECT_TYPES}
    //                         label="Filtro" value={tipoFiltro}
    //                         onChange={(e) => setTipoFiltro(e.target.value as "all" | "name")}
    //                         error={errors.tipoFiltro}
    //                     />
    //                 </div>

    //                 {tipoFiltro === "name" && (
    //                     <div>
    //                         <Input 
    //                         label="Nome do Tenant" id="name" 
    //                         value={name} 
    //                         onChange={(e) => setName(e.target.value)}
    //                         error={errors.name}
    //                         />
    //                     </div>
    //                 )}
    //                 <div className="mt-10 w-36">
    //                     <Button type="submit" className="">
    //                         Filtrar
    //                     </Button>
    //                 </div>
    //             </div>

    //         </form>
    //     </div>
    // );
}
