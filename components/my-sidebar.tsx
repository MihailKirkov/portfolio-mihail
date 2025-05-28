import Link from "next/link";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader } from "./ui/sidebar";

export default function MySidebar() {
    return (
        <Sidebar>
            <SidebarHeader />
            <SidebarContent>
                <SidebarGroup />
                <li><Link href="/">Home</Link></li>
                <SidebarGroup />
                <li><Link href="/admin/projects">Projects</Link></li>
                <SidebarGroup />
                <li><Link href="/admin/experience">Experience</Link></li>
            </SidebarContent>
            <SidebarFooter />
        </Sidebar>
    );
}
