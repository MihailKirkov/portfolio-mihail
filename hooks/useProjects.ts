import { useState, useEffect } from "react";
import type { Project } from "../services/projects";
import { fetchProjectsFromFirestore, fetchProjectsFromJSON } from "../services/projects";

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const fallbackProjects = fetchProjectsFromJSON();
            setProjects(fallbackProjects);
        } catch (err) {
            console.error("Erorr fetching projects from JSON: ", err)
            setError("No projects found.")
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadProjects();
    }, []);

    return { projects, loading, error };
}