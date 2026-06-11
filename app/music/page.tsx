"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Tag } from "@/components/Tag";
import Image from "next/image";

interface Track {
  title: string;
  year: number;
  alias: string;
  cover: string;
  audioUrl: string;
  tags: string[];
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);

  useEffect(() => {
    fetch("/content/music/tracks.json")
      .then((res) => res.json())
      .then((data) => {
        setTracks(data);
        setFilteredTracks(data);
      })
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    if (selectedAlias) {
      setFilteredTracks(tracks.filter((t) => t.alias === selectedAlias));
    } else {
      setFilteredTracks(tracks);
    }
  }, [selectedAlias, tracks]);

  const aliases = Array.from(new Set(tracks.map((t) => t.alias)));

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <SectionHeader
        title="Music"
        description="Electronic music production under various aliases."
      />

      {/* Alias Filters */}
      <div className="mb-12">
        <p className="text-sm text-fg/60 mb-4">Filter by alias:</p>
        <div className="flex flex-wrap gap-2">
          <Tag
            label="All"
            active={selectedAlias === null}
            onClick={() => setSelectedAlias(null)}
          />
          {aliases.map((alias) => (
            <Tag
              key={alias}
              label={alias}
              active={selectedAlias === alias}
              onClick={() => setSelectedAlias(alias)}
            />
          ))}
        </div>
      </div>

      {/* Tracks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTracks.map((track, index) => (
          <div
            key={index}
            className="border border-border/40 rounded-lg overflow-hidden bg-muted/50 hover:border-glow/30 transition-all"
          >
            {track.cover && (
              <div className="relative h-48">
                <Image src={track.cover} alt={track.title} fill className="object-cover" />
              </div>
            )}
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold mb-1">{track.title}</h3>
                <p className="text-sm text-fg/60">
                  {track.alias} · {track.year}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {track.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 bg-bg/50 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <AudioPlayer src={track.audioUrl} title={track.title} />
            </div>
          </div>
        ))}
      </div>

      {filteredTracks.length === 0 && (
        <p className="text-center text-fg/60 py-12">No tracks found.</p>
      )}

      {/* Embeds Section */}
      <section className="mt-20">
        <h2 className="text-3xl font-bold mb-8">Featured Releases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border/40 rounded-lg p-6">
            <p className="text-sm text-fg/60 mb-4">SoundCloud Embed Placeholder</p>
            <div className="aspect-video bg-muted rounded flex items-center justify-center">
              <p className="text-fg/40">SoundCloud Player</p>
            </div>
          </div>
          <div className="border border-border/40 rounded-lg p-6">
            <p className="text-sm text-fg/60 mb-4">YouTube Embed Placeholder</p>
            <div className="aspect-video bg-muted rounded flex items-center justify-center">
              <p className="text-fg/40">YouTube Player</p>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "MusicGroup",
            name: "Yaan Batho",
            genre: ["Electronic", "Techno"],
            member: {
              "@type": "Person",
              name: "Yaan Batho",
            },
          }),
        }}
      />
    </div>
  );
}


