"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { Tag } from "@/components/Tag";
import { Project } from "@/lib/mdx";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setFilteredProjects(data);
        
        const tags = new Set<string>();
        data.forEach((project: Project) => {
          project.tags.forEach((tag) => tags.add(tag));
        });
        setAllTags(Array.from(tags).sort());
      });
  }, []);

  useEffect(() => {
    if (selectedTag) {
      setFilteredProjects(projects.filter((p) => p.tags.includes(selectedTag)));
    } else {
      setFilteredProjects(projects);
    }
  }, [selectedTag, projects]);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeader
        title="Projects"
        description="A collection of creative experiments, products, and media spanning AI, gaming, social tech, and futurism."
      />

      {/* Filter Tags */}
      <div className="mb-12">
        <p className="text-sm text-fg/60 mb-4">Filter by tag:</p>
        <div className="flex flex-wrap gap-2">
          <Tag
            label="All"
            active={selectedTag === null}
            onClick={() => setSelectedTag(null)}
          />
          {allTags.map((tag) => (
            <Tag
              key={tag}
              label={tag}
              active={selectedTag === tag}
              onClick={() => setSelectedTag(tag)}
            />
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredProjects.map((project, index) => (
          <ProjectCard key={project.slug} project={project} index={index} />
        ))}
      </motion.div>

      {filteredProjects.length === 0 && (
        <p className="text-center text-fg/60 py-12">No projects found with this tag.</p>
      )}
    </div>
  );
}


