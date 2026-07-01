import * as yup from "yup";
import validateEmail from "@/utilities/validators/email";

export type UpdateTenantDto = {
  trade_name?: string;
  cnpj?: string | null;
  registered_name?: string | null;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

export const updateTenantYupSchema = yup.object({
  trade_name: yup
    .string()
    .required("Nome fantasia é obrigatório")
    .min(2, "Nome fantasia deve ter pelo menos 2 caracteres")
    .max(120, "Nome fantasia deve ter no máximo 120 caracteres"),
  cnpj: yup
    .string()
    .nullable()
    .test("cnpj-length", "CNPJ deve conter 14 dígitos", (value) => !value || value.length === 14),
  registered_name: yup
    .string()
    .nullable()
    .max(120, "Razão social deve ter no máximo 120 caracteres"),
  phone: yup
    .string()
    .required("Telefone é obrigatório")
    .length(11, "Telefone deve conter 11 dígitos"),
  email: yup
    .string()
    .required("E-mail é obrigatório")
    .test("is-valid-email", "Digite um e-mail válido", (value) => !!value && validateEmail(value)),
  isActive: yup
    .boolean()
    .required(),
});
