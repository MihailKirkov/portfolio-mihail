import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Experience } from "@/types/experience";

interface ExperienceCardProps {
    exp: Experience;
}

export default function ExperienceCard({ exp }: ExperienceCardProps) {
    if (!exp) return null;
    return (
        <Card className="max-w-md bg-white dark:bg-zinc-900 border border-white/10 rounded-2xl">
        <CardHeader>
            <CardTitle>{exp.role}</CardTitle>
            <CardDescription>{exp.company} — {exp.period}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{exp.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
            {exp.technologies.map((tech) => (
                <Badge key={tech} variant="outline">{tech}</Badge>
            ))}
            </div>
        </CardContent>
        </Card>
    );
}
