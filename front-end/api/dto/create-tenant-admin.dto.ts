import * as yup from "yup";
import validateCPF from "@/utilities/validators/cpf";
import validateEmail from "@/utilities/validators/email";

export type CreateTenantAdminDto = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  password: string;
};

export const createTenantAdminInitialValues: CreateTenantAdminDto = {
  name: "",
  email: "",
  cpf: "",
  phone: "",
  password: "",
};

export const createTenantAdminYupSchema: yup.ObjectSchema<CreateTenantAdminDto> = yup.object({
  name: yup
    .string()
    .required("Nome do administrador é obrigatório")
    .min(2, "Nome do administrador deve ter pelo menos 2 caracteres")
    .max(120, "Nome do administrador deve ter no máximo 120 caracteres"),
  email: yup
    .string()
    .required("E-mail do administrador é obrigatório")
    .test("is-valid-email", "Digite um e-mail válido", (value) => !!value && validateEmail(value)),
  cpf: yup
    .string()
    .required("CPF do administrador é obrigatório")
    .length(11, "CPF do administrador deve conter 11 dígitos")
    .test("is-valid-cpf", "Digite um CPF válido", (value) => !!value && validateCPF(value)),
  phone: yup
    .string()
    .required("Telefone do administrador é obrigatório")
    .length(11, "Telefone do administrador deve conter 11 dígitos"),
  password: yup
    .string()
    .required("Senha do administrador é obrigatória")
    .min(8, "Senha deve ter pelo menos 8 caracteres"),
});
