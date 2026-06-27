import { EMAIL_REGEX } from "@/lib/constants";

export default function validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}
