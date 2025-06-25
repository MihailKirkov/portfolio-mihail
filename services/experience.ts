import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import experienceJSON from '@/data/experience.json';
import { Experience } from "@/types/experience";

export async function fetchExperiencesFromFirestore(): Promise<Experience[]> {
    const experienceQuery = query(collection(db, "experience"), orderBy("order"));
    const experienceSnapshot = await getDocs(experienceQuery);

    if (experienceSnapshot.empty) {
        throw new Error("No experiences found in Firestore");
    }

    return experienceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Experience));
}


export function fetchExperienceFromJSON(): Experience[] {
    return experienceJSON;
}
