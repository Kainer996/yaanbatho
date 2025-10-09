import { SectionHeader } from "@/components/SectionHeader";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Now",
  description: "What Yaan Batho is currently working on and focused on.",
};

export default function NowPage() {
  const lastUpdated = "October 2025";

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeader
        title="Now"
        description={`Last updated: ${lastUpdated}`}
      />

      <div className="prose prose-invert prose-lg max-w-none">
        <h2>Current Focus</h2>
        <p>
          Right now, I'm deep in the intersection of AI and creative media, exploring how
          emerging technologies can reshape storytelling and human connection.
        </p>

        <h3>Active Projects</h3>
        <ul>
          <li>
            <strong>Robotique AI Companion</strong> - Building a Tamagotchi-style cross-device
            companion with games, learning modules, and smart reminders.
          </li>
          <li>
            <strong>Orion's Barrel</strong> - Continuing the social sitcom series set in a
            space bar, experimenting with AI video generation and character development.
          </li>
          <li>
            <strong>Chifftown/Chifly</strong> - Refining the virtual social platform with
            webcam chat, virtual pubs, and interactive spaces.
          </li>
        </ul>

        <h3>Learning & Exploring</h3>
        <ul>
          <li>Brain-Computer Interfaces (BCI) and neural technology</li>
          <li>Advanced AI video generation techniques</li>
          <li>Real-time communication protocols (WebRTC)</li>
          <li>Future of remote work and digital nomadism</li>
        </ul>

        <h3>Location</h3>
        <p>
          Currently exploring as a digital nomad, building a self-sustaining remote brand
          while experiencing different cultures and environments.
        </p>

        <h3>Reading</h3>
        <ul>
          <li>"The Singularity is Near" by Ray Kurzweil</li>
          <li>"Life 3.0" by Max Tegmark</li>
          <li>Various AI research papers and futurist blogs</li>
        </ul>

        <div className="mt-12 p-6 border border-border/40 rounded-lg bg-muted/50">
          <p className="text-sm text-fg/60 mb-0">
            This is a "now page" inspired by Derek Sivers. It's a snapshot of what I'm
            currently focused on. For past work, check out my{" "}
            <a href="/projects">projects</a> or <a href="/bio">bio</a>.
          </p>
        </div>
      </div>
    </div>
  );
}


