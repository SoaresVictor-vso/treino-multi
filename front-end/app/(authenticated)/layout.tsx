import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { getServerSessionUser } from "@/lib/auth.server";
import { getNavItemsForRoles } from "@/lib/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerSessionUser();
  const navItems = getNavItemsForRoles(user?.roles ?? []);

  return (
    <div className="flex min-h-screen">
      <Sidebar items={navItems} />
      <main className="flex-1 overflow-auto bg-background">
        <Header navItems={navItems} />
        <div className="md:ml-16 lg:p-16 ml-32 p-32 space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
