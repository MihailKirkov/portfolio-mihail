"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project } from "@/services/projects";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
    onSave: () => void;
}

export default function ProjectEditDialog({ open, onOpenChange, project, onSave }: Props) {
    const [formData, setFormData] = useState<Project>(project);

    useEffect(() => {
        setFormData(project); // update form data when dialog is opened for a new project
    }, [project]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const tags = e.target.value.split(",").map((tag) => tag.trim());
        setFormData((prev) => ({ ...prev, tags }));
    };

    const handleSave = async () => {
        try {
            await updateDoc(doc(db, "projects", project.id), { ...formData });
            onSave();
            onOpenChange(false);
            window.alert("Success!");
        } catch (err) {
            console.error("[handleSave in project-edit-dialog]", err);
            window.alert("Failed to update project");
        }
    };

    const { title, summary, description, image, tags, link_code, link_preview } = formData;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-6 sm:p-8 bg-white dark:bg-zinc-900 text-black dark:text-white max-h-[80dvh] overflow-auto">
            <DialogHeader className="flex flex-row justify-between items-start gap-4">
            <DialogTitle className="text-2xl font-bold">
                <Input
                name="title"
                value={title}
                onChange={handleChange}
                placeholder="Title"
                className="bg-transparent border-none text-xl font-bold px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
            </DialogTitle>
            <DialogClose />
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

            <Input
            name="image"
            value={image}
            onChange={handleChange}
            placeholder="Image URL"
            className="mt-2"
            />

            <Textarea
                name="summary"
                value={summary}
                onChange={handleChange}
                placeholder="Summary"
                className="bg-transparent resize-none"
            />
            <DialogDescription className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            <Textarea
                name="description"
                value={description}
                onChange={handleChange}
                placeholder="Description"
                className="bg-transparent resize-none"
            />
            </DialogDescription>

            <div className="mt-6">
            <Input
                name="tags"
                value={tags.join(", ")}
                onChange={handleTagsChange}
                placeholder="Comma-separated tags"
            />
            <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                <Badge key={`${tag}-${index}`} variant="outline" className="text-xs font-light border-zinc-300 dark:border-zinc-600">
                    {tag}
                </Badge>
                ))}
            </div>
            </div>

            <div className="mt-6 space-y-2">
            <Input
                name="link_code"
                value={link_code}
                onChange={handleChange}
                placeholder="Source Code URL"
            />
            <Input
                name="link_preview"
                value={link_preview}
                onChange={handleChange}
                placeholder="Live Preview URL"
            />
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    );
}
