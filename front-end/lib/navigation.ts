import { Role } from "./roles";

interface NavItem {
    href: string;
    label: string;
    icon: string;
    allowedRoles: Role[];
    hidden: boolean;
}

/** Subconjunto seguro de NavItem enviado ao cliente — sem metadados de autorização. */
export interface NavItemPublic {
    href: string;
    label: string;
    icon: string;
}

/**
 * Itens de navegação do menu lateral.
 * allowedRoles deve ser mantido em sincronia com ROUTE_PERMISSIONS.
 * NAV_ITEMS nunca deve ser exportado nem importado em componentes cliente.
 */
const NAV_ITEMS: { [href: string]: NavItem } = {
    "/home": {
        href: "/home",
        label: "Início",
        icon: "RiHome2Line",
        allowedRoles: [Role.ALL],
        hidden: false,
    },
    "/tenants": {
        href: "/tenants",
        label: "Tenants",
        icon: "RiBuilding4Line",
        allowedRoles: [Role.ORG_ADMIN, Role.ORG_SUPPORT],
        hidden: false,
    },
    "/users": {
        href: "/users",
        label: "Usuários",
        icon: "RiGroupLine",
        allowedRoles: [Role.ORG_ADMIN, Role.ORG_SUPPORT],
        hidden: false,
    },
    "/teste": {
        href: "/tenants",
        label: "Tenants",
        icon: "tenants",
        allowedRoles: [Role.ORG_ADMIN, Role.ORG_SUPPORT],
        hidden: true,
    },
};

/** Retorna os itens de navegação permitidos para os roles dados, sem metadados de autorização. */
export function getNavItemsForRoles(roles: Role[]): NavItemPublic[] {
    return Object.values(NAV_ITEMS)
        .filter((item) =>
            !item.hidden &&
            (item.allowedRoles.includes(Role.ALL) ||
                item.allowedRoles.some((r) => roles.includes(r)))
        )
        .map(({ href, label, icon }) => ({ href, label, icon }));
}

/** Retorna os roles permitidos para o pathname dado, ou null se a rota não estiver mapeada. */
export function getAllowedRoles(pathname: string): Role[] | null {
    const conf = NAV_ITEMS[pathname];
    return conf ? conf.allowedRoles : null;
}
