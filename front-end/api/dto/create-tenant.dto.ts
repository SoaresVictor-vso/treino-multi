import * as yup from "yup";
import validateCPF from "@/utilities/validators/cpf";
import validateEmail from "@/utilities/validators/email";

export type CreateTenantDto = {
  trade_name: string;
  slug: string;
  cnpj?: string;
  registered_name?: string;
  phone: string;
  email: string;
  isActive: boolean;
};

export const createTenantInitialValues: CreateTenantDto = {
  trade_name: "",
  slug: "",
  cnpj: "",
  registered_name: "",
  phone: "",
  email: "",
  isActive: true,
};

export const createTenantYupSchema: yup.ObjectSchema<CreateTenantDto> = yup.object({
  trade_name: yup
    .string()
    .required("Nome fantasia é obrigatório")
    .min(2, "Nome fantasia deve ter pelo menos 2 caracteres")
    .max(120, "Nome fantasia deve ter no máximo 120 caracteres"),
  slug: yup
    .string()
    .required("Slug é obrigatório")
    .min(2, "Slug deve ter pelo menos 2 caracteres")
    .max(60, "Slug deve ter no máximo 60 caracteres")
    .matches(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  cnpj: yup
    .string()
    .optional()
    .test("cnpj-length", "CNPJ deve conter 14 dígitos", (value) => !value || value.length === 14),
  registered_name: yup
    .string()
    .optional()
    .max(120, "Razão social deve ter no máximo 120 caracteres"),
  phone: yup
    .string()
    .required("Telefone é obrigatório")
    .length(11, "Telefone deve conter 11 dígitos"),
  email: yup
    .string()
    .required("E-mail é obrigatório")
    .test("is-valid-email", "Digite um e-mail válido", (value) => !!value && validateEmail(value)),
  isActive: yup.boolean().required(),
});
