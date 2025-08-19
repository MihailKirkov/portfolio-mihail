"use client";

import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
    src: string;
    alt?: string;
    fallback?: string; // e.g., "AI"
    size?: number;     // avatar size in px
    previewSize?: number; // preview size in px
    className?: string;
};

export default function AvatarWithPreview({
    src,
    alt = "Avatar",
    fallback = "AI",
    size = 28,
    previewSize = 160,
    className,
}: Props) {
    return (
        <HoverCard openDelay={80} closeDelay={80}>
            <HoverCardTrigger asChild>
                {/* button = keyboard-focusable trigger */}
                <button
                    type="button"
                    aria-label={`${alt} preview`}
                    className={cn("rounded-full focus:outline-none focus:ring-2 focus:ring-ring", className)}
                    style={{ width: size, height: size }}
                >
                <Avatar style={{ width: size, height: size }}>
                    <AvatarImage src={src} alt={alt}/>
                    <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
                </button>
            </HoverCardTrigger>

            <HoverCardContent className="p-2" align="start" sideOffset={8}>
                <img
                src={src}
                alt={alt}
                width={previewSize}
                height={previewSize}
                className="rounded-xl shadow-md object-cover"
                style={{ width: previewSize, height: previewSize }}
                />
            </HoverCardContent>
        </HoverCard>
    );
}
