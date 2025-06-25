
export interface Experience {
    id?: string; // Firestore doc ID
    role: string;
    company: string;
    period: string;
    description: string;
    technologies: string[];
    order: number;
}