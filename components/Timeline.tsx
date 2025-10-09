interface TimelineItem {
  year?: string;
  title: string;
  description: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-8">
      {items.map((item, index) => (
        <div key={index} className="relative pl-8 border-l border-border/40">
          <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-fg" />
          {item.year && <p className="text-sm text-fg/40 mb-1">{item.year}</p>}
          <h3 className="font-bold mb-2">{item.title}</h3>
          <p className="text-fg/60">{item.description}</p>
        </div>
      ))}
    </div>
  );
}


