import { getMDXContent } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bio",
  description: "Learn about Yaan Batho - nomad creator focused on AI, futurism, and media.",
};

const timelineItems = [
  {
    year: "2015-2018",
    title: "Music Production (Kainer)",
    description:
      "Started creating electronic music under the alias Kainer, exploring techno and experimental sounds.",
  },
  {
    year: "2019-2021",
    title: "Brand Building (Robotique)",
    description:
      "Founded Robotique, a lifestyle brand with Shopify store, educational content, and visual identity.",
  },
  {
    year: "2022",
    title: "AI Media Experiments",
    description:
      "Began exploring AI video generation with projects like Orion's Barrel and Pun Reel Engine.",
  },
  {
    year: "2023",
    title: "Game Development",
    description: "Prototyped Mini Diggerz, an isometric excavator game in Unreal Engine 5.",
  },
  {
    year: "2024-Present",
    title: "AI Agents & Social Tech",
    description:
      "Building companion agents, social platforms like Chifftown, and AR safety tools.",
  },
];

export default async function BioPage() {
  const content = await getMDXContent("bio.mdx");

  if (!content) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Bio</h1>
        <p className="text-xl text-fg/60">
          Nomad creator focused on AI, futurism, and media
        </p>
      </header>

      <div className="prose prose-invert prose-lg max-w-none mb-16">
        <MDXRemote source={content.content} />
      </div>

      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8">Timeline</h2>
        <Timeline items={timelineItems} />
      </section>

      <section>
        <h2 className="text-3xl font-bold mb-8">Skills & Interests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold mb-4">Technical</h3>
            <ul className="space-y-2 text-fg/60">
              <li>AI & LLMs (prompt engineering, agents)</li>
              <li>Web Development (Next.js, React)</li>
              <li>Game Development (Unreal Engine 5)</li>
              <li>Video Production (AI tools, CapCut)</li>
              <li>WebRTC & Real-time Communication</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Creative</h3>
            <ul className="space-y-2 text-fg/60">
              <li>Brand Strategy & Marketing</li>
              <li>Music Production (Electronic/Techno)</li>
              <li>Creative Writing & Storytelling</li>
              <li>Product Design & UX</li>
              <li>Future of Work & BCIs</li>
            </ul>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Yaan Batho",
            description: "Nomad creator focused on AI, futurism, and media",
            jobTitle: "Creator & Developer",
            knowsAbout: [
              "Artificial Intelligence",
              "Futurism",
              "Media Production",
              "Game Development",
              "Music Production",
            ],
          }),
        }}
      />
    </div>
  );
}


