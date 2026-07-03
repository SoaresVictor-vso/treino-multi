export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const CPF_REGEX = /^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_REGEX = /^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/;

export type MaskRegex = {
  regex: RegExp;
  replacement: string;
};

export const CNPJ_MASK_REGEX: MaskRegex = {
  regex: /^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2}).*$/,
  replacement: "$1.$2.$3/$4-$5",
};
export const CPF_MASK_REGEX: MaskRegex = {
  regex: /^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2}).*$/,
  replacement: "$1.$2.$3-$4",
};
export const PHONE_MASK_REGEX: MaskRegex = {
  regex: /^(\d{0,2})(\d{0,5})(\d{0,4}).*$/,
  replacement: "($1) $2-$3",
};

export const applyMask = (value: string, mask: MaskRegex) => value.replace(mask.regex, mask.replacement);
