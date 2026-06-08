const {EMAIL_REGEX} = require("@/lib/constants");

export default function validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}