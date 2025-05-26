"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Project } from "@/services/projects";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

const ProjectDialog = ({ open, onOpenChange, project }: ProjectDialogProps) => {
  const { title, description, image, tags, link_code, link_preview } = project;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="lg:max-w-3xl p-2 sm:p-8 bg-white dark:bg-zinc-900 text-black dark:text-white max-h-[95dvh] overflow-y-auto overflow-x-hidden max-w-[90dvw]">
                <DialogHeader className="flex flex-row justify-between items-start gap-4">
                <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
                <DialogClose>
                </DialogClose>
                </DialogHeader>

                {image && (
                <div className="mt-4 rounded-lg overflow-hidden flex justify-center items-center">
                    <Image
                        src={image}
                        alt={title}
                        width={800}
                        height={600}
                        className="w-auto h-auto max-h-[50dvh] rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                </div>
                )}

                <DialogDescription className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {description}
                </DialogDescription>

                <div className="mt-6 flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                    <Badge key={`${tag}-${index}`} variant="outline" className="text-xs font-light border-zinc-300 dark:border-zinc-600">
                    {tag}
                    </Badge>
                ))}
                </div>

                <DialogFooter className="mt-6 flex justify-end gap-1 flex-row">
                {link_code && (
                    <a href={link_code} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">Source Code</Button>
                    </a>
                )}
                {link_preview && (
                    <a href={link_preview} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">Live Preview</Button>
                    </a>
                )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectDialog;
