"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/app/config/site";
import { Mail, Twitter, Github, Linkedin } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:${siteConfig.socials.email}?subject=${encodeURIComponent(
      formData.subject
    )}&body=${encodeURIComponent(
      `From: ${formData.name} (${formData.email})\n\n${formData.message}`
    )}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeader
        title="Contact"
        description="Let's connect. Drop me a message or reach out on social media."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                required
                className="w-full px-4 py-2 bg-muted border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-glow/50"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                className="w-full px-4 py-2 bg-muted border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-glow/50"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                required
                className="w-full px-4 py-2 bg-muted border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-glow/50"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={6}
                className="w-full px-4 py-2 bg-muted border border-border/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-glow/50 resize-none"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            <Button type="submit" size="lg" className="w-full">
              Send Message
            </Button>
          </form>
        </div>

        <div>
          <h3 className="text-xl font-bold mb-6">Connect on Social</h3>
          <div className="space-y-4">
            <a
              href={`mailto:${siteConfig.socials.email}`}
              className="flex items-center gap-4 p-4 border border-border/40 rounded-lg hover:border-glow/30 transition-all group"
            >
              <Mail size={24} className="group-hover:text-glow transition-colors" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-fg/60">{siteConfig.socials.email}</p>
              </div>
            </a>

            <a
              href={siteConfig.socials.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 border border-border/40 rounded-lg hover:border-glow/30 transition-all group"
            >
              <Twitter size={24} className="group-hover:text-glow transition-colors" />
              <div>
                <p className="font-medium">Twitter</p>
                <p className="text-sm text-fg/60">@yaanbatho</p>
              </div>
            </a>

            <a
              href={siteConfig.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 border border-border/40 rounded-lg hover:border-glow/30 transition-all group"
            >
              <Github size={24} className="group-hover:text-glow transition-colors" />
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-fg/60">yaanbatho</p>
              </div>
            </a>

            <a
              href={siteConfig.socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 border border-border/40 rounded-lg hover:border-glow/30 transition-all group"
            >
              <Linkedin size={24} className="group-hover:text-glow transition-colors" />
              <div>
                <p className="font-medium">LinkedIn</p>
                <p className="text-sm text-fg/60">yaanbatho</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


