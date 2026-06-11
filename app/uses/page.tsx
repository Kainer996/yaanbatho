import { SectionHeader } from "@/components/SectionHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uses",
  description: "Tools, software, and gear that Yaan Batho uses for creative work.",
};

export default function UsesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeader
        title="Uses"
        description="The tools, software, and gear I use for creative work."
      />

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold mb-6">Development</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Code Editor</h3>
              <p className="text-fg/60">
                VS Code with custom themes, extensions for Next.js, TypeScript, and Tailwind
                CSS.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Stack</h3>
              <p className="text-fg/60">
                Next.js 14, TypeScript, Tailwind CSS, Framer Motion, MDX for content.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Deployment</h3>
              <p className="text-fg/60">Vercel for web apps, GitHub for version control.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Creative Tools</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Video Production</h3>
              <p className="text-fg/60">
                CapCut for editing, Veo and other AI video tools for generation, custom LLM
                prompts for scripts.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Design</h3>
              <p className="text-fg/60">
                Figma for UI/UX design, Canva for quick graphics, Photoshop for advanced
                editing.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Music Production</h3>
              <p className="text-fg/60">
                Ableton Live for production, various VST plugins, external MIDI controllers.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Game Development</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Engine</h3>
              <p className="text-fg/60">Unreal Engine 5 with Blueprints for rapid prototyping.</p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Assets</h3>
              <p className="text-fg/60">
                Blender for 3D modeling, Quixel Megascans for textures.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Hardware</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Computer</h3>
              <p className="text-fg/60">High-spec laptop for mobile creative work.</p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Audio</h3>
              <p className="text-fg/60">
                Audio interface for music production, quality headphones for mixing.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Peripherals</h3>
              <p className="text-fg/60">
                Mechanical keyboard, precision mouse, portable monitors for multi-display
                setup.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6">Productivity</h2>
          <div className="space-y-4">
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">Organization</h3>
              <p className="text-fg/60">
                Notion for project management, Linear for task tracking, Obsidian for notes.
              </p>
            </div>
            <div className="border-l-2 border-border/40 pl-4">
              <h3 className="font-bold mb-2">AI Assistants</h3>
              <p className="text-fg/60">
                ChatGPT, Claude for brainstorming and coding, custom agents for specific
                workflows.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


