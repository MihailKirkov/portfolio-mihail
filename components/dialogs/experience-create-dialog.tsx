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
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function ExperienceCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [techInput, setTechInput] = useState("");
  const [loading, setLoading] = useState(false);

  const technologies = techInput.split(",").map(t => t.trim()).filter(Boolean);

  async function handleCreate() {
    if (!role || !company) return alert("Role and Company are required.");
    setLoading(true);
    try {
      await addDoc(collection(db, "experience"), {
        role,
        company,
        period,
        description,
        technologies,
      });
      onCreated();
      onOpenChange(false);
      setRole(""); setCompany(""); setPeriod(""); setDescription(""); setTechInput("");
    } catch (err) {
      console.error("Error creating experience:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Add Experience</DialogTitle>
        </DialogHeader>

        <Input placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
        <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
        <Input placeholder="Period (e.g., Feb 2024 - current)" value={period} onChange={e => setPeriod(e.target.value)} />
        <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <Input placeholder="Technologies (comma-separated)" value={techInput} onChange={e => setTechInput(e.target.value)} />
        <div className="flex flex-wrap gap-2 mt-2">
          {technologies.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
