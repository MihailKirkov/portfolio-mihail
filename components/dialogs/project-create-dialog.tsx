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

interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void; // callback to refresh list after creation
}

const ProjectCreateDialog = ({ open, onOpenChange, onCreated }: ProjectCreateDialogProps) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkPreview, setLinkPreview] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);

  const handleSubmit = async () => {
    if (!title || !summary) return alert("Title and Summary are required");

    setSubmitting(true);
    try {
      await addDoc(collection(db, "projects"), {
        title,
        summary,
        description,
        image,
        link_code: linkCode,
        link_preview: linkPreview,
        tags,
      });
      onOpenChange(false);
      onCreated(); // callback to refresh project list
      // Reset fields
      setTitle("");
      setSummary("");
      setDescription("");
      setImage("");
      setLinkCode("");
      setLinkPreview("");
      setTagsInput("");
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
          <Input placeholder="Image URL" value={image} onChange={e => setImage(e.target.value)} />
          <Input placeholder="GitHub URL" value={linkCode} onChange={e => setLinkCode(e.target.value)} />
          <Input placeholder="Live Preview URL" value={linkPreview} onChange={e => setLinkPreview(e.target.value)} />
          <Input
            placeholder="Tags (comma-separated)"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {tags.map((tag,index) => (
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
