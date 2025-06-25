'use client';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ResumeMenu = ({
    resumeUrls,
    t
}: {
    resumeUrls: { pdfUrl: string | null; docUrl: string | null };
    t: any;
}) => {
    const [previewOpen, setPreviewOpen] = useState(false);

    return (
        <>
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                className="rounded-full border border-white/20 px-6 text-xs font-light tracking-wider w-full justify-start md:justify-center"
            >
                {t('resume')}
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
            {resumeUrls.docUrl ? (
                <DropdownMenuItem asChild>
                <a href={resumeUrls.docUrl} download>
                    {t('download_docx')}
                </a>
                </DropdownMenuItem>
            ) : (
                <DropdownMenuItem disabled>{t('download_docx')}</DropdownMenuItem>
            )}

            {resumeUrls.pdfUrl ? (
                <>
                <DropdownMenuItem asChild>
                    <a href={resumeUrls.pdfUrl} download>
                    {t('download_pdf')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                    {t('preview_pdf')}
                </DropdownMenuItem>
                </>
            ) : (
                <>
                <DropdownMenuItem disabled>{t('download_pdf')}</DropdownMenuItem>
                <DropdownMenuItem disabled>{t('preview_pdf')}</DropdownMenuItem>
                </>
            )}
            </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] p-0 overflow-hidden bg-gray-900 rounded-md">
            <DialogHeader className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
                <DialogTitle className="text-lg text-white">
                {t('resume_preview_title')}
                </DialogTitle>
            </DialogHeader>
            <iframe
                src={resumeUrls.pdfUrl ?? ''}
                className="w-full h-[75vh]"
                frameBorder="0"
                title="Resume PDF Preview"
            />
            </DialogContent>
        </Dialog>
        </>
    );
};

export default ResumeMenu;
