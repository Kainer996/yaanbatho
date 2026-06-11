import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ title, description, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-12", className)}>
      <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
      {description && <p className="text-lg text-fg/60 max-w-3xl">{description}</p>}
    </div>
  );
}


