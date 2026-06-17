"use client";

import { NavItemPublic } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import { RiArrowLeftDoubleFill } from "react-icons/ri";

export default function Header({ navItems }: { navItems: NavItemPublic[] }) {
    const pathname = usePathname();
    const navItem = navItems.find((item) => item.href === pathname);

    return (
        <div className="w-full py-8 border-b-4 border-outline-variant sticky top-0 z-50 h-16" >
            <div className="inline-flex">
                {/* <h1 className="text-2xl font-bold px-6 py-2 my-2 border-e-2 border-gray-100 hover:bg-gray-700">
                    <button onClick={() => window.history.back()} className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <RiArrowLeftDoubleFill />
                            Voltar
                        </div>
                    </button>
                </h1>
                <h1 className="text-2xl font-bold px-4 py-2 my-2 ">{navItem?.label}</h1> */}
            </div>
        </div>
    )
}
