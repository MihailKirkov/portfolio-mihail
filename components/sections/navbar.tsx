"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../ui/dialog";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Navbar = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [resumeUrls, setResumeUrls] = useState<{ pdfUrl: string | null; docUrl: string | null }>({
        pdfUrl: "https://firebasestorage.googleapis.com/v0/b/portfolio-mihail.firebasestorage.app/o/resumes%2Fpdf%2F1750722988638_CV%20test%20test%20%231.pdf?alt=media&token=3be93e67-7ff7-4271-ab1c-f80a692c378e",
        docUrl: "https://firebasestorage.googleapis.com/v0/b/portfolio-mihail.firebasestorage.app/o/resumes%2Fdoc%2F1750722570921_CV_MihailKirkov_official.docx?alt=media&token=c8f355a7-8388-42ac-b37d-ac7230bad937"
    });
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchResumeUrls = async () => {
        try {
            const docSnap = await getDoc(doc(db, "other-setup", "resume"));
            if (docSnap.exists()) {
            const data = docSnap.data() as { pdfUrl?: string; docUrl?: string };
            setResumeUrls({
                pdfUrl: data.pdfUrl ?? null,
                docUrl: data.docUrl ?? null,
            });
            }
        } catch (error) {
            console.error("Failed to fetch resume URLs:", error);
        }
        };
        fetchResumeUrls();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setDropdownOpen(false);
        }
        };
        if (dropdownOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        } else {
        document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownOpen]);

    return (
    <>
        <header className="fixed top-0 z-50 w-full border-b border-white/10 backdrop-blur-md">
            <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-light tracking-wider text-cyan-500">
                <span className="font-bold text-primary">Mihail</span>K
            </Link>
            <nav className="hidden space-x-8 md:flex">
                <Link href="#about" className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors scroll-smooth">
                About
                </Link>
                <Link href="#projects" className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors">
                Projects
                </Link>
                <Link href="#experience" className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors">
                Experience
                </Link>
                <Link href="#contact" className="text-sm font-light tracking-wider hover:text-cyan-500 transition-colors">
                Contact
                </Link>
            </nav>

            {/* Resume dropdown */}
            <div className="relative" ref={dropdownRef}>
                <Button
                variant="ghost"
                className="rounded-full border border-white/20 px-6 text-xs font-light tracking-wider"
                onClick={() => setDropdownOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                >
                Resume
                </Button>

                {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-700 bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <ul className="py-1 text-sm text-white">
                    {resumeUrls.docUrl ? (
                        <li>
                        <a
                            href={resumeUrls.docUrl}
                            download
                            className="block px-4 py-2 hover:bg-gray-700 cursor-pointer"
                            onClick={() => setDropdownOpen(false)}
                        >
                            Download .docx
                        </a>
                        </li>
                    ) : (
                        <li className="px-4 py-2 opacity-50 cursor-not-allowed">Download .docx</li>
                    )}

                    {resumeUrls.pdfUrl ? (
                        <>
                        <li>
                            <a
                            href={resumeUrls.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="block px-4 py-2 hover:bg-gray-700 cursor-pointer"
                            onClick={() => setDropdownOpen(false)}
                            >
                            Download .pdf
                            </a>
                        </li>
                        <li>
                            {/* Trigger Dialog for PDF Preview */}
                            <button
                            type="button"
                            onClick={() => {
                                setPreviewOpen(true);
                                setDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 cursor-pointer"
                            >
                            Preview .pdf
                            </button>
                        </li>
                        </>
                    ) : (
                        <>
                        <li className="px-4 py-2 opacity-50 cursor-not-allowed">Download .pdf</li>
                        <li className="px-4 py-2 opacity-50 cursor-not-allowed">Preview .pdf</li>
                        </>
                    )}
                    </ul>
                </div>
                )}
            </div>
            </div>
        </header>

        {/* PDF Preview Dialog using shadCN Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] p-0 overflow-hidden bg-gray-900 rounded-md">
            <DialogHeader className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
                <DialogTitle className="text-lg text-white">Resume Preview</DialogTitle>
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
