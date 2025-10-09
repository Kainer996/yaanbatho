import fs from "fs";
import path from "path";

/**
 * Seed script to set up project placeholder images and copy music files
 * Run with: pnpm seed
 */

const projectSlugs = [
  "robotique",
  "orions-barrel",
  "chifftown",
  "mini-diggerz",
  "pun-reel-engine",
  "bci-slides",
  "good-news-agent",
  "ar-safety-glasses",
  "robotique-companion",
  "ob-news-pack",
  "robotique-kit-v2",
];

const musicCovers = [
  "kainer-1",
  "kainer-2",
  "kainer-3",
  "yaan-1",
  "yaan-2",
  "yaan-3",
];

async function createPlaceholderImage(outputPath: string, width: number, height: number, label: string) {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111"/>
      <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="#222" stroke-width="1"/>
      <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="#222" stroke-width="1"/>
      <text x="50%" y="50%" font-family="monospace" font-size="16" fill="#666" text-anchor="middle" dominant-baseline="middle">
        ${label}
      </text>
    </svg>
  `.trim();

  fs.writeFileSync(outputPath, svg);
}

async function seed() {
  console.log("🌱 Seeding project...\n");

  // Ensure directories exist
  const publicDir = path.join(process.cwd(), "public");
  const projectsDir = path.join(publicDir, "projects");
  const musicDir = path.join(publicDir, "music");

  [projectsDir, musicDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create project placeholder images
  console.log("Creating project placeholder images...");
  for (const slug of projectSlugs) {
    const imagePath = path.join(projectsDir, `${slug}.jpg`);
    if (!fs.existsSync(imagePath)) {
      createPlaceholderImage(imagePath, 1200, 630, slug.toUpperCase());
      console.log(`  ✓ Created ${slug}.jpg`);
    }
  }

  // Create music cover placeholders
  console.log("\nCreating music cover placeholders...");
  for (const cover of musicCovers) {
    const imagePath = path.join(musicDir, `${cover}.jpg`);
    if (!fs.existsSync(imagePath)) {
      createPlaceholderImage(imagePath, 800, 800, cover.toUpperCase());
      console.log(`  ✓ Created ${cover}.jpg`);
    }
  }

  // Copy music files from tunes folder if it exists
  console.log("\nCopying music files...");
  const tunesDir = path.join(process.cwd(), "..", "tunes");
  
  if (fs.existsSync(tunesDir)) {
    const musicFiles = [
      { src: "Kainer - Deep Pan.mp3", dest: "deep-pan.mp3" },
      { src: "Kainer - Glide (Original Mix) kainer996@gmail.com.mp3", dest: "glide.mp3" },
      { src: "Kainer - Listen and Repeat.mp3", dest: "listen-repeat.mp3" },
    ];

    for (const file of musicFiles) {
      const srcPath = path.join(tunesDir, file.src);
      const destPath = path.join(musicDir, file.dest);
      
      if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied ${file.dest}`);
      }
    }
  } else {
    console.log("  ⚠ Tunes folder not found. Skipping music file copy.");
    console.log("  💡 Place your music files manually in public/music/");
  }

  // Create placeholder music files for Yaan Batho tracks (these don't exist yet)
  console.log("\nNote: Yaan Batho tracks (nomad-dreams, future-echoes, circuit-breaker)");
  console.log("      are placeholders. Replace with actual files when available.\n");

  console.log("✅ Seeding complete!\n");
}

seed().catch(console.error);


