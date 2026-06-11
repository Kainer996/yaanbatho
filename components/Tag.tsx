import { cn } from "@/lib/utils";

interface TagProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Tag({ label, active, onClick }: TagProps) {
  const Component = onClick ? "button" : "span";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border transition-colors",
        active
          ? "bg-fg text-bg border-fg"
          : "bg-transparent text-fg/60 border-border/40 hover:border-glow/30 hover:text-fg",
        onClick && "cursor-pointer"
      )}
    >
      {label}
    </Component>
  );
}


