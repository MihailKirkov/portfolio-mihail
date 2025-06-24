"use client";

import { useState } from "react";
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
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { uploadFile } from "@/services/files";
import { X } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const SortableImage = ({
  file,
  url,
  index,
  onRemove,
}: {
  file: File;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: index,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group"
    >
      <img src={url} alt={`Image ${index}`} className="h-24 rounded border" />
      <button
        onClick={() => onRemove(index)}
        className="absolute top-0 right-0 p-1 bg-white rounded-bl z-10 opacity-0 group-hover:opacity-100 transition"
      >
        <X className="w-4 h-4 text-red-600" />
      </button>
    </div>
  );
};

const ProjectCreateDialog = ({ open, onOpenChange, onCreated }: ProjectCreateDialogProps) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkPreview, setLinkPreview] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [order, setOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailURL, setThumbnailURL] = useState<string>("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageURLs, setImageURLs] = useState<string[]>([]);

  const tags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailURL(URL.createObjectURL(file));
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailURL("");
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setImageFiles(prev => [...prev, ...files]);
    setImageURLs(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]);
  };

  const handleReorder = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setImageFiles(items => arrayMove(items, active.id, over.id));
      setImageURLs(items => arrayMove(items, active.id, over.id));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImageURLs(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setDescription("");
    setLinkCode("");
    setLinkPreview("");
    setTagsInput("");
    setOrder(0);
    setThumbnailFile(null);
    setThumbnailURL("");
    setImageFiles([]);
    setImageURLs([]);
  };

  const handleSubmit = async () => {
    if (!title || !summary) return alert("Title and Summary are required");

    setSubmitting(true);
    try {
      let uploadedThumbnailURL = "";
      let uploadedImages: string[] = [];

      if (thumbnailFile) {
        uploadedThumbnailURL = await uploadFile(thumbnailFile, "thumbnails");
      }

      for (const file of imageFiles) {
        const url = await uploadFile(file, "project-images");
        uploadedImages.push(url);
      }

      await addDoc(collection(db, "projects"), {
        title,
        summary,
        description,
        thumbnail: uploadedThumbnailURL,
        images: uploadedImages,
        order,
        link_code: linkCode,
        link_preview: linkPreview,
        tags,
      });

      onOpenChange(false);
      onCreated();
      resetForm();
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Check console.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 sm:p-8 bg-white dark:bg-zinc-900 text-black dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="Summary" value={summary} onChange={e => setSummary(e.target.value)} />
          <Textarea
            placeholder="Description"
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <Input placeholder="GitHub URL" value={linkCode} onChange={e => setLinkCode(e.target.value)} />
          <Input placeholder="Live Preview URL" value={linkPreview} onChange={e => setLinkPreview(e.target.value)} />
          <Input
            placeholder="Tags (comma-separated)"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Order (e.g. 0, 1, 2...)"
            value={order}
            onChange={e => setOrder(parseInt(e.target.value, 10) || 0)}
          />

          {/* Thumbnail Upload */}
          <div>
            <label className="block font-medium">Thumbnail Image</label>
            <Input type="file" accept="image/*" onChange={handleThumbnailChange} />
            {thumbnailURL && (
              <div className="relative w-fit mt-2">
                <img src={thumbnailURL} alt="Thumbnail" className="h-32 rounded border" />
                <button
                  onClick={handleRemoveThumbnail}
                  className="absolute top-0 right-0 bg-white p-1 rounded-bl text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Gallery Upload with DnD */}
          <div>
            <label className="block font-medium">Project Images</label>
            <Input type="file" accept="image/*" multiple onChange={handleGalleryChange} />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
              <SortableContext items={imageFiles.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                <div className="flex gap-2 flex-wrap mt-3">
                  {imageURLs.map((url, index) => (
                    <SortableImage
                      key={index}
                      file={imageFiles[index]}
                      url={url}
                      index={index}
                      onRemove={handleRemoveImage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Tag badges */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge key={`${tag}-${index}`} variant="outline" className="text-xs font-light border-zinc-300 dark:border-zinc-600">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectCreateDialog;
