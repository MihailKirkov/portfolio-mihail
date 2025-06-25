import { useState, useEffect } from "react";
import { fetchExperienceFromJSON, fetchExperiencesFromFirestore } from "@/services/experience";
import { Experience } from "@/types/experience";

export function useExperiences() {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    const fetchExperiences = async () => {
        setLoading(true);
        try {
            const experiences: Experience[] = await fetchExperiencesFromFirestore();
            if (!experiences || experiences.length == 0) {
                const fallbackExperiences = fetchExperienceFromJSON();
                setExperiences(fallbackExperiences);
            } else {
                setExperiences(experiences);
            }
        } catch (err) {
            console.error("Erorr fetching projects from JSON: ", err)
            setError("No projects found.")
            setExperiences(fetchExperienceFromJSON());
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchExperiences();
    }, []);

    return { experiences, loading, error, fetchExperiences };
}