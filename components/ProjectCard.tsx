"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Project } from "@/lib/mdx";
import { ExternalLink, Github } from "lucide-react";
import { Tag } from "./Tag";

interface ProjectCardProps {
  project: Project;
  index?: number;
}

export function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="group relative border border-border/40 rounded-lg overflow-hidden bg-muted/50 hover:border-glow/30 transition-all duration-300"
    >
      <Link href={`/projects/${project.slug}`}>
        {project.cover && (
          <div className="relative h-48 overflow-hidden">
            <Image
              src={project.cover}
              alt={project.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg to-transparent opacity-60" />
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xl font-bold group-hover:text-glow transition-colors">
              {project.title}
            </h3>
            {project.status === "in-progress" && (
              <span className="text-xs px-2 py-1 border border-border/40 rounded-full">
                In Progress
              </span>
            )}
          </div>

          <p className="text-sm text-fg/60 mb-4 line-clamp-2">{project.excerpt}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.slice(0, 3).map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-fg/40">
            {project.tech.slice(0, 4).map((tech) => (
              <span key={tech} className="px-2 py-1 bg-bg/50 rounded">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </Link>

      <div className="absolute top-4 right-4 flex gap-2">
        {project.repo && (
          <a
            href={project.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-bg/80 rounded-full hover:bg-fg hover:text-bg transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="View repository"
          >
            <Github size={16} />
          </a>
        )}
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-bg/80 rounded-full hover:bg-fg hover:text-bg transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="View live site"
          >
            <ExternalLink size={16} />
          </a>
        )}
      </div>
    </motion.div>
  );
}


