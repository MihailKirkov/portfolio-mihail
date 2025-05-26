// services/projects.ts
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import projectsJSON from "@/data/projects.json";

export interface Project {
    id: string;
    title: string;
    summary: string;
    description: string;
    tags: string[];
    image: string;
    link_code: string;
    link_preview: string;
}

export async function fetchProjectsFromFirestore(): Promise<Project[]> {
    const projectsCol = collection(db, "projects");
    const projectSnapshot = await getDocs(projectsCol);
    if (projectSnapshot.empty) {
        throw new Error("No projects found in Firestore");
    }
    return projectSnapshot.docs.map(doc => doc.data() as Project);
}

export function fetchProjectsFromJSON(): Project[] {
    return projectsJSON;
}
