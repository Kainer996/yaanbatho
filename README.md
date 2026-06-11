# Yaan Batho - Personal Site

A sleek, futuristic personal site with a monochrome cyber aesthetic. Built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## ✨ Features

- **Cyber Aesthetic**: Monochrome design with grid backgrounds, glass effects, and subtle scanlines
- **Project Showcase**: Filterable project gallery with MDX content
- **Music Hub**: Audio player with track management and alias filtering
- **Full Accessibility**: WCAG AA+ compliant with keyboard navigation and reduced motion support
- **SEO Optimized**: Dynamic metadata, JSON-LD structured data, sitemap, and robots.txt
- **Type-Safe**: Strict TypeScript configuration throughout

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design tokens
- **UI Components**: shadcn/ui + lucide-react icons
- **Animation**: Framer Motion (respects prefers-reduced-motion)
- **Content**: MDX for longform pages
- **Code Quality**: ESLint + Prettier

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mee
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Seed the project (creates placeholder images and copies music files):
```bash
pnpm seed
# or
npm run seed
```

4. Run the development server:
```bash
pnpm dev
# or
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/
│   ├── config/          # Site configuration
│   ├── api/             # API routes
│   ├── projects/        # Projects pages
│   ├── bio/             # Biography page
│   ├── music/           # Music hub
│   ├── contact/         # Contact form
│   ├── now/             # Current status
│   ├── uses/            # Tools & gear
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # React components
│   ├── ui/              # shadcn/ui components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ProjectCard.tsx
│   ├── AudioPlayer.tsx
│   └── ...
├── content/             # MDX content
│   ├── projects/        # Project MDX files
│   ├── music/           # Music data
│   └── bio.mdx          # Biography content
├── lib/                 # Utility functions
│   ├── mdx.ts           # MDX utilities
│   └── utils.ts         # General utilities
├── public/              # Static assets
│   ├── projects/        # Project images
│   └── music/           # Music files & covers
└── scripts/             # Build scripts
    └── seed.ts          # Seeding script
```

## 📝 Content Management

### Adding Projects

1. Create a new MDX file in `content/projects/your-project.mdx`
2. Add frontmatter:

```mdx
---
title: "Project Title"
excerpt: "Short description"
date: "2024-01-01"
tags: ["tag1", "tag2"]
tech: ["Next.js", "TypeScript"]
cover: "/projects/your-project.jpg"
repo: "https://github.com/..."  # optional
liveUrl: "https://..."          # optional
status: "released"              # or "in-progress"
year: 2024
---

## Your Content Here

Write your project details in MDX...
```

3. Add a cover image to `public/projects/your-project.jpg`

### Adding Music Tracks

Edit `content/music/tracks.json`:

```json
{
  "title": "Track Name",
  "year": 2024,
  "alias": "Artist Name",
  "cover": "/music/cover.jpg",
  "audioUrl": "/music/track.mp3",
  "tags": ["electronic", "techno"]
}
```

Place audio files in `public/music/`.

### Editing Biography

Edit `content/bio.mdx` with your personal story, mission, and background.

## 🎨 Customization

### Design Tokens

Modify `app/globals.css` to update color scheme:

```css
:root {
  --bg: 10 10 10;        /* Background */
  --fg: 237 237 237;     /* Foreground */
  --muted: 17 17 17;     /* Muted elements */
  --border: 34 34 34;    /* Borders */
  --glow: 255 255 255;   /* Glow effects */
  --accent: 237 237 237; /* Accent color */
}
```

### Site Configuration

Edit `app/config/site.ts`:

```typescript
export const siteConfig = {
  name: "Your Name",
  description: "Your tagline",
  url: "https://yoursite.com",
  socials: {
    twitter: "https://twitter.com/...",
    github: "https://github.com/...",
    // ...
  },
};
```

## 🧪 Scripts

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
pnpm format     # Format with Prettier
pnpm typecheck  # TypeScript type checking
pnpm seed       # Seed placeholder data
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Vercel will auto-detect Next.js and configure settings
4. Deploy!

### Environment Variables

No environment variables required for basic deployment.

For contact form functionality, consider:
- Using mailto links (current implementation)
- Or integrating a service like SendGrid/Resend

## 📊 Performance

Target Lighthouse scores:
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

## 🎯 Key Features by Route

- **/** - Hero with animated grid, featured projects, CTA
- **/projects** - Filterable project grid with tags
- **/projects/[slug]** - Individual project pages with MDX
- **/bio** - Biography with timeline and skills
- **/music** - Audio player with alias filtering
- **/contact** - Contact form (mailto) with social links
- **/now** - Current status and focus
- **/uses** - Tools and gear list

## 🔧 Troubleshooting

### Music files not playing?

1. Ensure files are in `public/music/`
2. Check file paths in `content/music/tracks.json`
3. Verify file format (MP3 recommended for best compatibility)

### Images not showing?

1. Run `pnpm seed` to create placeholders
2. Replace placeholders with your actual images
3. Ensure images are in correct directories (`public/projects/`, `public/music/`)

### Build errors?

1. Run `pnpm typecheck` to find TypeScript errors
2. Run `pnpm lint` to find linting issues
3. Check that all MDX files have proper frontmatter

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Design inspiration from cyber/futuristic aesthetics
- Built with modern web technologies
- UI components from shadcn/ui

---

Built with ❤️ by Yaan Batho


