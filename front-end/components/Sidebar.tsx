
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthCookie } from "@/lib/auth";
import { NavItemPublic } from "@/lib/navigation";
import React from "react";
import * as icons from "react-icons/ri";

export default function Sidebar({ items }: { items: NavItemPublic[] }) {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(true);

    function handleLogout() {
        clearAuthCookie();
        router.push("/login");
    }

    return (
        <aside
            className={
                `${collapsed ? "w-16" : "w-64"} min-h-screen flex flex-col ` +
                `transition-all duration-300 bg-surface-container `
            }        >
            <div className="px-3 py-4 border-b-4 border-outline-variant flex items-center justify-between">
                {!collapsed && (
                    <span className="text-xl font-bold tracking-tight truncate">Treino Multi</span>
                )}
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                    aria-label={collapsed ? "Abrir menu" : "Fechar menu"}
                >
                    {React.createElement(
                        (collapsed ? icons.RiMenuUnfoldLine : icons.RiMenuFoldLine) as React.ElementType,
                        { className: "w-5 h-5 text-primary" }
                    )}
                </button>
            </div>

            <nav className="flex-1 px-2 py-4 space-y-1 ">
                {items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const rawIcon = icons[item.icon as keyof typeof icons] || icons.RiFileForbidLine;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            // className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                            //     ? "bg-gray-600"
                            //     : " hover:bg-gray-500"
                            //     } ${collapsed ? "justify-center" : ""}`}

                            className={
                                "flex items-center gap-3 px-4 py-3 rounded" +
                                (isActive ?
                                    "text-primary font-bold border-r-2 border-primary bg-surface-variant/10 transition-transform scale-[0.98]" :
                                    "text-secondary-fixed-dim font-medium hover:text-primary hover:bg-surface-variant transition-colors duration-200")
                            }
                        >
                            {React.createElement(rawIcon as React.ElementType, { className: "w-5 h-5 shrink-0" })}
                            {!collapsed && <span className="text-xl ps-1">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-2 py-4 border-t border-gray-700">
                <button
                    onClick={handleLogout}
                    title={collapsed ? "Sair" : undefined}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xl font-medium  hover:text-white transition-colors ${collapsed ? "justify-center" : ""}`}
                >
                    {React.createElement(icons.RiLogoutBoxRLine as React.ElementType, { className: "w-5 h-5 shrink-0 text-primary" })}
                    {!collapsed && "Sair"}
                </button>
            </div>
        </aside>
    );
}
