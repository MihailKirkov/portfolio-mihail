import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import projectsJSON from "@/data/projects.json";
import { Project } from "@/types/project";

export async function fetchProjectsFromFirestore(): Promise<Project[]> {
    const projectsCol = collection(db, "projects");
    const projectsQuery = query(projectsCol, orderBy("order", "asc"));
    const projectSnapshot = await getDocs(projectsQuery);

    if (projectSnapshot.empty) {
        throw new Error("No projects found in Firestore");
    }

    return projectSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Project, "id">)
    }));
}

export function fetchProjectsFromJSON(): Project[] {
    return projectsJSON;
}