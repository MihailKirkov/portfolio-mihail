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

const Navbar = () => {
    const t = useTranslations("navbar");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [resumeUrls, setResumeUrls] = useState<{
        pdfUrl: string | null;
        docUrl: string | null;
    }>({
        pdfUrl: null,
        docUrl: null
    });

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
        <header className="fixed top-0 z-50 w-full border-b border-white/10 backdrop-blur-md overflow-y-scroll">
            <div className="container flex h-16 items-center justify-between">
            <Link
                href="/"
                className="text-xl font-light tracking-wider text-cyan-500"
            >
                <span className="font-bold text-primary">Mihail</span>K
            </Link>
            <nav className="hidden space-x-8 md:flex">
                <Link
                href="#about"
                className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors scroll-smooth"
                >
                {t("about")}
                </Link>
                <Link
                href="#projects"
                className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors"
                >
                {t("projects")}
                </Link>
                <Link
                href="#experience"
                className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors"
                >
                {t("experience")}
                </Link>
                <Link
                href="#contact"
                className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors"
                >
                {t("contact")}
                </Link>
            </nav>

            <div className="flex items-center gap-2">
                {/* <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                    variant="ghost"
                    className="rounded-full border border-white/20 px-6 text-xs font-light tracking-wider"
                    >
                    {t("resume")}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {resumeUrls.docUrl ? (
                    <DropdownMenuItem asChild>
                        <a href={resumeUrls.docUrl} download>
                        {t("download_docx")}
                        </a>
                    </DropdownMenuItem>
                    ) : (
                    <DropdownMenuItem disabled>
                        {t("download_docx")}
                    </DropdownMenuItem>
                    )}

                    {resumeUrls.pdfUrl ? (
                    <>
                        <DropdownMenuItem asChild>
                        <a href={resumeUrls.pdfUrl} download>
                            {t("download_pdf")}
                        </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                        {t("preview_pdf")}
                        </DropdownMenuItem>
                    </>
                    ) : (
                    <>
                        <DropdownMenuItem disabled>
                        {t("download_pdf")}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                        {t("preview_pdf")}
                        </DropdownMenuItem>
                    </>
                    )}
                </DropdownMenuContent>
                </DropdownMenu>
                <LanguageSwitcher /> */}
            </div>
            </div>
        </header>

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
        </>
    );
};

export default Navbar;
