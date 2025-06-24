import { X, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { Button } from "./ui/button";

interface SortableImageProps {
  id: string;
  url: string;
  onRemove: () => void;
}

export default function SortableImage({ id, url, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group w-[120px] h-[80px] overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
    >
      <Image
        src={url}
        alt="Uploaded"
        fill
        className="object-cover"
      />

      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute bottom-0 left-0 p-1 bg-white/80 dark:bg-black/60 rounded-tr-lg z-10 cursor-grab"
      >
        <GripVertical size={16} />
      </div>

      {/* Remove button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation(); // <-- Prevent drag conflict
          console.log("onRemove triggered");
          onRemove();
        }}
        className="z-10 absolute top-0 right-0 p-1 m-1 bg-white/80 dark:bg-black/60 hover:bg-red-500 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={16} />
      </Button>
    </div>
  );
}
