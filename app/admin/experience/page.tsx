'use client';

import { useEffect, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import ExperienceCard from "@/components/experience-card";
import ExperienceCreateDialog from "@/components/dialogs/experience-create-dialog";
import ExperienceEditDialog from "@/components/dialogs/experience-edit-dialog";
import { Experience } from "@/types/experience";
import { useExperiences } from "@/hooks/useExperiences";

export default function ExperiencePage() {
    const { experiences, loading, error, fetchExperiences } = useExperiences();
    const [editData, setEditData] = useState<Experience | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    console.log('experiences:',experiences);

    async function handleDelete(id: string) {
      await deleteDoc(doc(db, "experience", id));
      fetchExperiences();
    }

    useEffect(() => {
      fetchExperiences();
    }, []);

    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Experience</h1>
        <Button className="mb-4" onClick={() => setCreateOpen(true)}>+ Add Experience</Button>

        <ExperienceCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchExperiences} />
        {editData && (
          <ExperienceEditDialog open={!!editData} onOpenChange={() => setEditData(null)} experience={editData} onSaved={fetchExperiences} />
        )}

        {loading ? (
          <div className="text-center">Loading...</div>
        ) : (
          <div className="flex flex-wrap gap-8">
            {experiences.map((exp) => (
              <div key={exp.id} className="relative">
                <ExperienceCard exp={exp} />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditData(exp)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(exp.id!)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
}
