"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ProjectCard";
import { GridBackground } from "@/components/GridBackground";
import { siteConfig } from "./config/site";
import { useEffect, useState } from "react";
import { Project } from "@/lib/mdx";

export default function Home() {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setFeaturedProjects(data.slice(0, 3)))
      .catch(() => setFeaturedProjects([]));
  }, []);

  return (
    <div className="relative">
      <GridBackground />

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 md:pt-32 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border/40 rounded-full mb-8"
          >
            <Sparkles size={16} className="animate-glow" />
            <span className="text-sm">Building the future</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            {siteConfig.name}
          </h1>
          <p className="text-xl md:text-2xl text-fg/60 mb-12">{siteConfig.tagline}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/projects">
                View Projects <ArrowRight size={20} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Get in Touch</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Featured Projects */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Featured Projects</h2>
            <Link
              href="/projects"
              className="text-sm text-fg/60 hover:text-glow transition-colors inline-flex items-center gap-2"
            >
              View all <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProjects.map((project, index) => (
              <ProjectCard key={project.slug} project={project} index={index} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="border border-border/40 rounded-lg p-8 md:p-12 text-center glow"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Let's Build Together</h2>
          <p className="text-lg text-fg/60 mb-8 max-w-2xl mx-auto">
            Interested in collaboration or have a project in mind? Let's connect and create
            something extraordinary.
          </p>
          <Button asChild size="lg">
            <Link href="/contact">
              Start a Conversation <ArrowRight size={20} />
            </Link>
          </Button>
        </motion.div>
      </section>
    </div>
  );
}


