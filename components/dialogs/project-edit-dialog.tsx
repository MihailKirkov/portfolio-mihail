"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Project } from "@/types/project";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableImage from "@/components/sortable-image";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onSave: () => void;
}

export default function ProjectEditDialog({
  open,
  onOpenChange,
  project,
  onSave,
}: Props) {
  // Form state
  const [formData, setFormData] = useState<Project>(project);
  const [images, setImages] = useState<string[]>(project.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState(project.thumbnail || "");

  // Refs for file inputs
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  // Sync project updates on open or project change
  useEffect(() => {
    setFormData(project);
    setImages(project.images || []);
    setThumbnailPreview(project.thumbnail || "");
  }, [project]);

  // Generic input change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  // Tag input change, comma-separated
  const handleTagsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, tags }));
  }, []);

  // Upload project images handler
  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const storageRef = ref(storage, `projects/${project.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      });
      const uploadedUrls = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error("Project images upload error:", error);
      alert("Failed to upload project images.");
    } finally {
      setUploadingImages(false);
      if (imagesInputRef.current) imagesInputRef.current.value = "";
    }
  };

  // Upload thumbnail image handler
  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumbnail(true);
    try {
      const storageRef = ref(storage, `projects/${project.id}/thumbnail_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setThumbnailPreview(url);
      setFormData((prev) => ({ ...prev, thumbnail: url }));
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    } catch (error) {
      console.error("Thumbnail upload error:", error);
      alert("Failed to upload thumbnail image.");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  // Remove image from images array
  const handleImageRemove = useCallback((url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  }, []);

  // Drag & drop reordering
  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = images.findIndex((img) => img === active.id);
        const newIndex = images.findIndex((img) => img === over.id);
        setImages((imgs) => arrayMove(imgs, oldIndex, newIndex));
      }
    },
    [images]
  );

  // Save project updates
  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "projects", project.id), {
        ...formData,
        images,
      });
      onSave();
      onOpenChange(false);
      alert("Project updated successfully.");
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to update project.");
    }
  };

  const {
    title,
    summary,
    description,
    tags = [],
    link_code,
    link_preview,
    order,
  } = formData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 sm:p-8 bg-white dark:bg-zinc-900 text-black dark:text-white max-h-[80dvh] overflow-auto">
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle className="text-2xl font-bold">Edit Project</DialogTitle>
          <DialogClose />
        </DialogHeader>

        {/* Title */}
        <Input
          name="title"
          value={title}
          onChange={handleChange}
          placeholder="Project Title"
          className="mt-4"
          autoFocus
        />

        {/* Thumbnail Display */}
        {thumbnailPreview && (
          <div className="mt-6 flex justify-center rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 max-h-[50dvh]">
            <Image
              src={thumbnailPreview}
              alt={`${title} thumbnail`}
              width={800}
              height={600}
              className="object-contain"
            />
          </div>
        )}

        {/* Thumbnail Upload */}
        <div className="mt-4">
          <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Update Thumbnail Image
          </label>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={uploadingThumbnail}
              className="whitespace-nowrap"
            >
              {uploadingThumbnail ? "Uploading..." : "Upload Thumbnail"}
            </Button>
            {thumbnailPreview && (
              <img
                src={thumbnailPreview}
                alt="Thumbnail Preview"
                className="h-24 rounded border border-zinc-300 dark:border-zinc-600 object-contain"
              />
            )}
          </div>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailChange}
            disabled={uploadingThumbnail}
          />
        </div>

        {/* Summary */}
        <Textarea
          name="summary"
          value={summary}
          onChange={handleChange}
          placeholder="Project Summary"
          className="mt-6 resize-none"
          rows={3}
        />

        {/* Description */}
        <Textarea
          name="description"
          value={description}
          onChange={handleChange}
          placeholder="Detailed Description"
          className="mt-4 resize-none"
          rows={5}
        />

        {/* Order */}
        <Input
          name="order"
          type="number"
          value={order || 0}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              order: parseInt(e.target.value, 10) || 0,
            }))
          }
          placeholder="Display Order (e.g. 0, 1, 2...)"
          className="mt-4"
          min={0}
        />

        {/* Project Images Upload */}
        <section className="mt-8">
          <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Project Images
          </label>
          <div className="flex gap-3 mb-4">
            <Button
              variant="outline"
              onClick={() => imagesInputRef.current?.click()}
              disabled={uploadingImages}
              className="whitespace-nowrap"
            >
              {uploadingImages ? "Uploading..." : "Upload Images"}
            </Button>
          </div>
          <input
            ref={imagesInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagesChange}
            disabled={uploadingImages}
          />

          {/* Images List with Drag & Drop */}
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images} strategy={verticalListSortingStrategy}>
              <div className="flex flex-wrap gap-3">
                {images.map((url) => (
                  <SortableImage
                    key={url}
                    id={url}
                    url={url}
                    onRemove={() => handleImageRemove(url)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* Tags */}
        <section className="mt-8">
          <Input
            name="tags"
            value={tags.join(", ")}
            onChange={handleTagsChange}
            placeholder="Tags (comma separated)"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <Badge
                key={`${tag}-${i}`}
                variant="outline"
                className="text-xs font-light border-zinc-300 dark:border-zinc-600"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="mt-8 space-y-3">
          <Input
            name="link_code"
            value={link_code || ""}
            onChange={handleChange}
            placeholder="Source Code URL"
          />
          <Input
            name="link_preview"
            value={link_preview || ""}
            onChange={handleChange}
            placeholder="Live Preview URL"
          />
        </section>

        {/* Footer buttons */}
        <DialogFooter className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploadingImages || uploadingThumbnail}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={uploadingImages || uploadingThumbnail}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
