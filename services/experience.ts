import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import experienceJSON from '@/data/experience.json';

export interface Experience {
    id?: string; // Firestore doc ID
    role: string;
    company: string;
    period: string;
    description: string;
    technologies: string[];
}

export async function fetchExperiencesFromFirestore(): Promise<Experience[]> {
    const experienceCol = collection(db, "experience");
    const experienceSnapshot = await getDocs(experienceCol);
    if (experienceSnapshot.empty) {
        throw new Error("No experiences found in Firestore");
    }
    return experienceSnapshot.docs.map(doc => doc.data() as Experience);
}

export function fetchExperienceFromJSON(): Experience[] {
    return experienceJSON;
}
