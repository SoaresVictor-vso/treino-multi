import { cookies } from "next/headers";
import { Role } from "./roles";

interface JwtPayload {
    sub: string;
    roles: Role[];
    exp: number;
}

export interface ServerSessionUser {
    sub: string;
    roles: Role[];
}

/** Lê o usuário da sessão a partir do cookie JWT — exclusivo para Server Components. */
export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return null;
    try {
        const encodedPayload = token.split(".")[1];
        const decodedPayload = atob(encodedPayload);
        const payload = JSON.parse(decodedPayload) as JwtPayload;
        return { sub: payload.sub, roles: payload.roles ?? [] };
    } catch {
        return null;
    }
}
