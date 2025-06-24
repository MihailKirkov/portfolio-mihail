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
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Experience } from "@/types/experience";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experience: Experience;
  onSaved: () => void;
}

export default function ExperienceEditDialog({ open, onOpenChange, experience, onSaved }: Props) {
  const [role, setRole] = useState(experience.role);
  const [company, setCompany] = useState(experience.company);
  const [period, setPeriod] = useState(experience.period);
  const [description, setDescription] = useState(experience.description);
  const [techInput, setTechInput] = useState(experience.technologies.join(", "));
  const [order, setOrder] = useState(experience.order || 0);
  const [loading, setLoading] = useState(false);

  const technologies = techInput.split(",").map(t => t.trim()).filter(Boolean);

  async function handleSave() {
    if (!role || !company || !experience.id) return alert("Missing fields");
    setLoading(true);
    try {
      await updateDoc(doc(db, "experience", experience.id), {
        role,
        company,
        period,
        description,
        technologies,
        order
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating experience:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle>Edit Experience</DialogTitle>
        </DialogHeader>

        <Input placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
        <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
        <Input placeholder="Period" value={period} onChange={e => setPeriod(e.target.value)} />
        <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <Input placeholder="Technologies (comma-separated)" value={techInput} onChange={e => setTechInput(e.target.value)} />
        <div className="flex flex-wrap gap-2 mt-2">
          {technologies.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        <Input placeholder="Order" type='number' value={order} onChange={e => setOrder(parseInt(e.target.value, 10) || 0)}/>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
