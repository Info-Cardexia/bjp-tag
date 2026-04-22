import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Eye, GripVertical } from "lucide-react";

interface SortableAreaCardProps {
  id: string;
  name: string;
  slug: string;
  visitCount: number;
  onEdit: () => void;
}

export function SortableAreaCard({ id, name, slug, visitCount, onEdit }: SortableAreaCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="campaign-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                {...attributes}
                {...listeners}
                className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
                aria-label="Drag to reorder"
                type="button"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <span className="truncate">{name}</span>
            </div>
            <span className="text-xs font-normal text-muted-foreground shrink-0">/{slug}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-primary">{visitCount}</p>
              <p className="text-sm text-muted-foreground">total visits</p>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4 mr-1" /> View
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
