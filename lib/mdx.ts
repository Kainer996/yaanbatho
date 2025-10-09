import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDirectory = path.join(process.cwd(), "content");

export interface Project {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  tech: string[];
  cover?: string;
  repo?: string;
  liveUrl?: string;
  role?: string;
  year?: number;
  accent?: boolean;
  status?: "released" | "in-progress";
}

export interface ProjectWithContent extends Project {
  content: string;
}

export async function getProjects(): Promise<Project[]> {
  const projectsDirectory = path.join(contentDirectory, "projects");
  
  if (!fs.existsSync(projectsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(projectsDirectory);
  const projects = fileNames
    .filter((fileName) => fileName.endsWith(".mdx"))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, "");
      const fullPath = path.join(projectsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, "utf8");
      const { data } = matter(fileContents);

      return {
        slug,
        ...(data as Omit<Project, "slug">),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return projects;
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithContent | null> {
  const projectsDirectory = path.join(contentDirectory, "projects");
  const fullPath = path.join(projectsDirectory, `${slug}.mdx`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    content,
    ...(data as Omit<Project, "slug">),
  };
}

export async function getMDXContent(filePath: string): Promise<{ data: any; content: string } | null> {
  const fullPath = path.join(contentDirectory, filePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return { data, content };
}


