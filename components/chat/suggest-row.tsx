"use client";

import { Card, CardContent } from "@/components/ui/card";

type Props = {
    items: string[];
    disabled?: boolean;
    onSelect: (text: string) => void;
};

export default function SuggestRow({ items, disabled, onSelect }: Props) {
    if (!items.length || disabled) return null;

    return (
        <div className="mb-4 grid grid-cols-3 gap-3" aria-hidden>
        {items.map((text) => (
            <Card
            key={text}
            className="cursor-pointer border hover:shadow-md transition-shadow flex items-center justify-center"
            onClick={() => onSelect(text)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(text)}
            >
            <CardContent className="p-3 text-xs font-medium leading-snug text-center hover:bg-muted ease-in-out">
                {text}
            </CardContent>
            </Card>
        ))}
        </div>
    );
}
