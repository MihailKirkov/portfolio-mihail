import { useState } from "react";
import { uploadFile } from "@/services/files";

interface ImageItem {
    file: File | null;
    url: string;
    isNew: boolean;
}

export function useImageUploadManager(initial: string[] = []) {
    const [images, setImages] = useState<ImageItem[]>(
        initial.map((url) => ({ file: null, url, isNew: false }))
    );

    const addFiles = (files: File[]) => {
        const newItems = files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isNew: true,
        }));
        setImages((prev) => [...prev, ...newItems]);
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const reorderImages = (from: number, to: number) => {
        setImages((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        return updated;
        });
    };

    const getUploadedImageURLs = async (): Promise<string[]> => {
        const result: string[] = [];
        for (const img of images) {
        if (img.isNew && img.file) {
            const uploaded = await uploadFile(img.file, "project-images");
            result.push(uploaded);
        } else {
            result.push(img.url);
        }
        }
        return result;
    };

    return {
        images,
        addFiles,
        removeImage,
        reorderImages,
        getUploadedImageURLs,
    };
}
