import MySidebar from "@/components/my-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <MySidebar />
            <main className="w-full h-screen">
                <SidebarTrigger />
                {children}
            </main>
        </SidebarProvider>
    );
}
