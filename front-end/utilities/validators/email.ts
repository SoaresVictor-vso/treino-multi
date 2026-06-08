import { Constants } from "../constants";

export default function validateEmail(email: string): boolean {
    const { EMAIL_REGEX } = Constants;
    return EMAIL_REGEX.test(email);
}