import { CPF_REGEX } from "@/lib/constants";

export default function validateCPF(cpf: string): boolean {
    if (!CPF_REGEX.test(cpf)) return false;

    cpf = cpf.replace(/\D/g, ""); // Remove non-digit characters

    let soma1 = 0;
    let soma2 = 0;

    for (let i = 0; i < 9; i++) {
        soma1 += parseInt(cpf.charAt(i)) * (10 - i);
        soma2 += parseInt(cpf.charAt(i)) * (11 - i);
    }

    const resto1 = soma1 % 11;
    const digito1 = resto1 < 2 ? 0 : 11 - resto1;

    soma2 = soma2 + (digito1 * 2);
    const resto2 = soma2 % 11;
    const digito2 = resto2 < 2 ? 0 : 11 - resto2;

    return cpf.endsWith(`${digito1}${digito2}`);
}
