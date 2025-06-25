'use client';

import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { ProjectCard } from "@/components/project-card";
import ProjectEditDialog from "@/components/dialogs/project-edit-dialog";
import ProjectCreateDialog from "@/components/dialogs/project-create-dialog";
import { Project } from "@/types/project";

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    async function fetchProjects() {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "projects"));
            setProjects(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
        } catch (err) {
            console.error("Error fetching projects!", err);
            window.alert("Error fetching projects. Check console.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        try {
            await deleteDoc(doc(db, "projects", id));
            fetchProjects();
            window.alert("Success!");
        } catch (err) {
            window.alert("Couldn't delete!")
            console.error("[handleDelete] :", err)
        }
    }

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Projects</h1>
        
        <Button className="mb-4" onClick={() => setCreateOpen(true)}>+ New Project</Button>
        <ProjectCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchProjects} />

        {loading ? (
            <div className="flex justify-center items-center w-full h-full">
            Loading...
            </div>
        ) : (
            <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project, index) => (
                <div key={project.id} className="relative max-w-lg w-lg h-full">
                    <ProjectCard project={project} key={String(index)}/>
                    <div className="absolute top-2 right-2 flex gap-2">
                        <Button variant="outline" onClick={() => setEditingProject(project)}>Edit</Button>
                        <Button variant="destructive" onClick={() => handleDelete(project.id)}>Delete</Button>
                    </div>
                </div>
            ))}
            </div>
        )}

        {editingProject && (
            <ProjectEditDialog
            open={!!editingProject}
            onOpenChange={(open) => !open && setEditingProject(null)}
            project={editingProject}
            onSave={() => {
                fetchProjects();
                setEditingProject(null);
            }}
            />
        )}
        </div>
    );
}
