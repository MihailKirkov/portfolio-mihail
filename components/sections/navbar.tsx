'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { LanguageSwitcher } from "../language-switcher";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import ResumeMenu from "../resume-menu";

const Navbar = () => {
    const t = useTranslations("navbar");
    const [resumeUrls, setResumeUrls] = useState<{
    pdfUrl: string | null;
    docUrl: string | null;
}>({
    pdfUrl: null,
    docUrl: null
});

    const [previewOpen, setPreviewOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const fetchResumeUrls = async () => {
        try {
            const docSnap = await getDoc(doc(db, "other-setup", "resume"));
            if (docSnap.exists()) {
            const data = docSnap.data() as { pdfUrl?: string; docUrl?: string };
            setResumeUrls({
                pdfUrl: data.pdfUrl ?? null,
                docUrl: data.docUrl ?? null
            });
            }
        } catch (error) {
            console.error("Failed to fetch resume URLs:", error);
        }
        };
        fetchResumeUrls();
    }, []);

    return (
    <>
        <header className="fixed top-0 z-50 w-full border-b border-white/10 backdrop-blur-md">
            <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-light tracking-wider text-cyan-500">
                <span className="font-bold text-primary">Mihail</span>K
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden space-x-8 md:flex">
                <NavLink href="#about" label={t("about")} />
                <NavLink href="#projects" label={t("projects")} />
                <NavLink href="#experience" label={t("experience")} />
                <NavLink href="#contact" label={t("contact")} />
            </nav>

            {/* Resume + Language Switcher */}
            <div className="hidden md:flex items-center gap-2">
                <ResumeMenu resumeUrls={resumeUrls} t={t} />
                <LanguageSwitcher />
            </div>

            {/* Mobile Hamburger */}
            <div className="md:hidden">
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="text-white"
                >
                <Menu className="h-6 w-6" />
                </Button>
            </div>
            </div>
        </header>

        {/* PDF Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] p-0 overflow-hidden bg-gray-900 rounded-md">
            <DialogHeader className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
                <DialogTitle className="text-lg text-white">
                {t("resume_preview_title")}
                </DialogTitle>
            </DialogHeader>
            <iframe
                src={resumeUrls.pdfUrl ?? ""}
                className="w-full h-[75vh]"
                frameBorder="0"
                title="Resume PDF Preview"
            />
            </DialogContent>
        </Dialog>

        {/* Mobile Menu Dialog */}
        <MobileMenu
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            resumeUrls={resumeUrls}
            t={t}
        />
        </>
    );
};

const NavLink = ({ href, label }: { href: string; label: string }) => (
    <Link
        href={href}
        className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors scroll-smooth"
    >
        {label}
    </Link>
);

const MobileMenu = ({
    open,
    onClose,
    resumeUrls,
    t
}: {
    open: boolean;
    onClose: () => void;
    resumeUrls: { pdfUrl: string | null; docUrl: string | null };
    t: any;
}) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="w-full max-w-sm mx-auto bg-gray-900 text-white p-6 rounded-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg">{t("menu")}</DialogTitle>
                </DialogHeader>

                <nav className="flex flex-col gap-4 mt-4">
                {["about", "projects", "experience", "contact"].map((key) => (
                    <Link
                        key={key}
                        href={`#${key}`}
                        onClick={onClose}
                        className="text-sm hover:text-cyan-500 transition-colors"
                    >
                        {t(key)}
                    </Link>
                ))}

                <hr className="border-white/10" />

                <div className="block md:hidden mt-4">
                    <ResumeMenu resumeUrls={resumeUrls} t={t} />
                </div>

                <hr className="border-white/10" />
                    <div className="ml-auto">
                        <LanguageSwitcher />
                    </div>
                </nav>
                </DialogContent>
            </Dialog>

            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] p-0 overflow-hidden bg-gray-900 rounded-md">
                <DialogHeader className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
                    <DialogTitle className="text-lg text-white">
                    {t("resume_preview_title")}
                    </DialogTitle>
                </DialogHeader>
                <iframe
                    src={resumeUrls.pdfUrl ?? ""}
                    className="w-full h-[75vh]"
                    frameBorder="0"
                    title="Resume PDF Preview"
                />
                </DialogContent>
            </Dialog>
        </>
    );
};


export default Navbar;
