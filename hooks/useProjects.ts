import { useState, useEffect } from "react";
import { fetchProjectsFromFirestore, fetchProjectsFromJSON } from "../services/projects";
import { Project } from "@/types/project";

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const projects: Project[] = await fetchProjectsFromFirestore();
            if (!projects || projects.length == 0) {
                const fallbackProjects = fetchProjectsFromJSON();
                setProjects(fallbackProjects);
            } else {
                setProjects(projects);
            }
        } catch (err) {
            console.error("Erorr fetching projects from JSON: ", err)
            setError("No projects found.")
            setProjects(fetchProjectsFromJSON());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadProjects();
    }, []);

    return { projects, loading, error };
}