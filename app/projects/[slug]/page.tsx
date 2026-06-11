import { notFound } from "next/navigation";
import { getProjectBySlug, getProjects } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Github, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/Tag";
import { formatDate } from "@/lib/utils";
import { Metadata } from "next";

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    return {};
  }

  return {
    title: project.title,
    description: project.excerpt,
    openGraph: {
      title: project.title,
      description: project.excerpt,
      type: "article",
      publishedTime: project.date,
      images: project.cover ? [{ url: project.cover }] : [],
    },
  };
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    notFound();
  }

  return (
    <article className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <Button asChild variant="ghost" className="mb-8">
        <Link href="/projects">
          <ArrowLeft size={20} /> Back to Projects
        </Link>
      </Button>

      {project.cover && (
        <div className="relative h-[400px] mb-8 rounded-lg overflow-hidden">
          <Image src={project.cover} alt={project.title} fill className="object-cover" />
        </div>
      )}

      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          {project.status === "in-progress" && (
            <span className="text-xs px-2 py-1 border border-border/40 rounded-full">
              In Progress
            </span>
          )}
          <time className="text-sm text-fg/60">{formatDate(project.date)}</time>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">{project.title}</h1>
        <p className="text-xl text-fg/60 mb-6">{project.excerpt}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {project.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-sm mb-6">
          {project.tech.map((tech) => (
            <span key={tech} className="px-3 py-1 bg-muted rounded-full text-fg/60">
              {tech}
            </span>
          ))}
        </div>

        <div className="flex gap-4">
          {project.repo && (
            <Button asChild variant="outline">
              <a href={project.repo} target="_blank" rel="noopener noreferrer">
                <Github size={20} /> Repository
              </a>
            </Button>
          )}
          {project.liveUrl && (
            <Button asChild>
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={20} /> View Live
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="prose prose-invert prose-lg max-w-none">
        <MDXRemote source={project.content} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": project.tags.includes("game") ? "VideoGame" : "CreativeWork",
            name: project.title,
            description: project.excerpt,
            datePublished: project.date,
            author: {
              "@type": "Person",
              name: "Yaan Batho",
            },
            ...(project.cover && { image: project.cover }),
            ...(project.liveUrl && { url: project.liveUrl }),
          }),
        }}
      />
    </article>
  );
}


