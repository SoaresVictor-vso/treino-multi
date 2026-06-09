import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTE_PERMISSIONS } from "./lib/route-permissions";
import { Role } from "./lib/roles";

const PUBLIC_PATHS = ["/login", "/unauthorized"];

interface JwtPayload {
    sub: string;
    roles: Role[];
    exp: number;
    [key: string]: unknown;
}

function parseJwt(token: string): JwtPayload | null {
    try {
        const encodedPayload = token.split(".")[1];
        const decodedPayload = atob(encodedPayload);
        return JSON.parse(decodedPayload) as JwtPayload;
    } catch {
        return null;
    }
}

/** Retorna as roles permitidas para o pathname dado, ou null se a rota não estiver mapeada. */
function getAllowedRoles(pathname: string): Role[] | null {
    // Ordena por comprimento decrescente para fazer match do mais específico primeiro
    const sortedRoutes = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
    const match = sortedRoutes.find((route) => pathname.startsWith(route));
    return match ? ROUTE_PERMISSIONS[match] : null;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    const token = request.cookies.get("accessToken")?.value;

    if (!token) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    const payload = parseJwt(token);

    if (!payload) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    const allowedRoles = getAllowedRoles(pathname);

    console.log(`Acessando ${pathname} com token de usuário ${payload.sub}`);
    console.log(allowedRoles);
    console.log(payload);

    if (allowedRoles !== null && !(
        allowedRoles.includes('*' as Role) ||
        allowedRoles.some((role) => payload.roles?.includes(role))
    )) {
        const unauthorizedUrl = new URL("/unauthorized", request.url);
        return NextResponse.redirect(unauthorizedUrl);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Authorization", `Bearer ${token}`);

    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
