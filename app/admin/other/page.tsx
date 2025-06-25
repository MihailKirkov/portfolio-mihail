"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadBytes, ref, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

type ResumeType = "pdf" | "doc";

interface ResumeUrls {
    pdfUrl: string | null;
    docUrl: string | null;
}

const ACCEPTED_EXTENSIONS = {
    pdf: [".pdf"],
    doc: [".doc", ".docx"],
};

const OtherPage = () => {
    const [resumeUrls, setResumeUrls] = useState<ResumeUrls>({
        pdfUrl: null,
        docUrl: null,
    });
    const [uploading, setUploading] = useState<{ pdf: boolean; doc: boolean }>({
        pdf: false,
        doc: false,
    });

    const inputRefs = {
        pdf: useRef<HTMLInputElement | null>(null),
        doc: useRef<HTMLInputElement | null>(null),
    };

    // Load existing resume URLs once on mount
    useEffect(() => {
        const fetchResumeUrls = async () => {
        try {
            const docSnap = await getDoc(doc(db, "other-setup", "resume"));
            if (docSnap.exists()) {
            const data = docSnap.data() as Partial<ResumeUrls>;
            setResumeUrls({
                pdfUrl: data.pdfUrl ?? null,
                docUrl: data.docUrl ?? null,
            });
            }
        } catch (error) {
            console.error("Error fetching resume URLs:", error);
        }
        };
        fetchResumeUrls();
    }, []);

    // Validate file extension matches expected for the resume type
    const isValidFileExtension = (fileName: string, type: ResumeType) =>
        ACCEPTED_EXTENSIONS[type].some((ext) =>
        fileName.toLowerCase().endsWith(ext)
        );

    // Generic upload handler for both PDF and DOC resumes
    const handleUpload = async (
        e: ChangeEvent<HTMLInputElement>,
        type: ResumeType
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isValidFileExtension(file.name, type)) {
        alert(
            `Invalid file type. Please upload a ${ACCEPTED_EXTENSIONS[
            type
            ].join(" or ")} file.`
        );
        resetInput(type);
        return;
        }

        setUploading((prev) => ({ ...prev, [type]: true }));

        try {
        const storageRef = ref(
            storage,
            `resumes/${type}/${Date.now()}_${file.name}`
        );

        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // Update Firestore document with merge to preserve both URLs
        await setDoc(
            doc(db, "other-setup", "resume"),
            { [`${type}Url`]: downloadUrl },
            { merge: true }
        );

        setResumeUrls((prev) => ({ ...prev, [`${type}Url`]: downloadUrl }));
        } catch (error) {
        console.error(`Error uploading ${type} resume:`, error);
        alert(`Failed to upload ${type.toUpperCase()} resume.`);
        } finally {
        setUploading((prev) => ({ ...prev, [type]: false }));
        resetInput(type);
        }
    };

    // Helper to clear file input value to allow reuploading same file if needed
    const resetInput = (type: ResumeType) => {
        const ref = inputRefs[type];
        if (ref.current) ref.current.value = "";
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-12">
        {(["pdf", "doc"] as ResumeType[]).map((type) => (
            <Card key={type}>
            <CardHeader>
                <CardTitle className="text-lg">
                Manage {type.toUpperCase()} Resume
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Label
                htmlFor={`${type}-upload`}
                className="mb-2 block"
                >
                Upload new resume file (
                {type === "pdf" ? ".pdf" : ".doc or .docx"})
                </Label>
                <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    onClick={() => inputRefs[type].current?.click()}
                    disabled={uploading[type]}
                >
                    {uploading[type]
                    ? `Uploading ${type.toUpperCase()}...`
                    : `Upload ${type.toUpperCase()} Resume`}
                </Button>
                {resumeUrls[`${type}Url`] && (
                    <a
                    href={resumeUrls[`${type}Url`] as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline"
                    >
                    View Current {type.toUpperCase()} Resume
                    </a>
                )}
                </div>
                <Input
                id={`${type}-upload`}
                type="file"
                accept={ACCEPTED_EXTENSIONS[type].join(",")}
                className="hidden"
                ref={inputRefs[type]}
                onChange={(e) => handleUpload(e, type)}
                disabled={uploading[type]}
                />

                {/* Inline preview only for PDF */}
                {type === "pdf" && resumeUrls.pdfUrl && (
                <iframe
                    src={resumeUrls.pdfUrl}
                    className="w-full h-[500px] border rounded mt-4"
                    title="PDF Resume Preview"
                />
                )}
            </CardContent>
            </Card>
        ))}
        </div>
    );
};

export default OtherPage;
