# Deployment Guide

## Quick Start Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Seed project (create placeholders and copy music)
pnpm seed

# 3. Run development server
pnpm dev

# 4. Build for production
pnpm build

# 5. Start production server
pnpm start
```

## Initial Setup Checklist

### 1. Content Setup
- [ ] Review and edit `content/bio.mdx` with your actual bio
- [ ] Update project MDX files in `content/projects/` with real content
- [ ] Add your actual project cover images to `public/projects/`
- [ ] Copy music files from `../tunes/` to `public/music/` (or run seed script)
- [ ] Add music cover images to `public/music/`

### 2. Configuration
- [ ] Update `app/config/site.ts` with your:
  - Name
  - Description/tagline
  - Social media links
  - Email address
  - Website URL (for production)

### 3. Branding
- [ ] Replace favicon at `app/favicon.ico`
- [ ] Update color scheme in `app/globals.css` if desired
- [ ] Customize design tokens in Tailwind config

### 4. SEO
- [ ] Verify `siteConfig.url` in `app/config/site.ts` matches your domain
- [ ] Test sitemap at `/sitemap.xml`
- [ ] Test robots.txt at `/robots.txt`

## Deployment to Vercel

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js settings
   - Click "Deploy"

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Environment Variables

No environment variables required for basic functionality.

Optional environment variables:
- `NEXT_PUBLIC_SITE_URL` - Your production URL (defaults to config value)

## Post-Deployment

1. **Verify all pages load**:
   - Home: `/`
   - Projects: `/projects` and `/projects/[slug]`
   - Bio: `/bio`
   - Music: `/music`
   - Contact: `/contact`
   - Now: `/now`
   - Uses: `/uses`

2. **Test SEO**:
   - Check `/sitemap.xml`
   - Check `/robots.txt`
   - Verify meta tags with browser inspector
   - Test Open Graph with [opengraph.xyz](https://www.opengraph.xyz/)

3. **Performance**:
   - Run Lighthouse audit
   - Check Web Vitals in Vercel dashboard
   - Test on mobile devices

4. **Accessibility**:
   - Test keyboard navigation
   - Test screen reader compatibility
   - Verify color contrast

## Custom Domain Setup

1. In Vercel dashboard:
   - Go to your project
   - Click "Settings" > "Domains"
   - Add your custom domain
   - Follow DNS configuration instructions

2. Update `siteConfig.url` in `app/config/site.ts` to match your domain

## Troubleshooting

### Build fails on Vercel

**Check**:
- All required dependencies in `package.json`
- No TypeScript errors (`pnpm typecheck`)
- No linting errors (`pnpm lint`)
- All MDX files have valid frontmatter

### Images not loading

**Fix**:
- Ensure images are in `public/` directory
- Check file paths in MDX frontmatter
- Run `pnpm seed` locally to create placeholders

### Music not playing

**Fix**:
- Verify MP3 files are in `public/music/`
- Check paths in `content/music/tracks.json`
- Ensure audio files are committed (check `.gitignore`)

### Styles look broken

**Fix**:
- Clear `.next` folder: `rm -rf .next`
- Rebuild: `pnpm build`
- Check Tailwind config is valid

## Performance Optimization

### Already Implemented
- ✅ Image optimization with next/image
- ✅ Font optimization with next/font
- ✅ Route-based code splitting
- ✅ Server components by default
- ✅ Static page generation where possible

### Optional Enhancements
- Add image CDN (Vercel includes this)
- Implement ISR for projects page
- Add service worker for offline support
- Compress audio files further

## Monitoring

### Vercel Analytics
Enable in dashboard for:
- Page views
- Web Vitals
- Visitor analytics

### Error Tracking
Consider integrating:
- Sentry
- LogRocket
- Vercel Error Reporting

## Backup Strategy

1. **Code**: Already in Git/GitHub
2. **Content**: MDX files in version control
3. **Assets**: 
   - Backup `public/` directory
   - Store original high-res images separately

## Updates & Maintenance

### Adding New Projects
1. Create MDX file in `content/projects/`
2. Add cover image to `public/projects/`
3. Commit and push - Vercel auto-deploys

### Updating Content
1. Edit MDX files locally
2. Preview with `pnpm dev`
3. Commit and push for automatic deployment

### Updating Dependencies
```bash
# Check for updates
pnpm outdated

# Update dependencies
pnpm update

# Test locally
pnpm dev
pnpm build

# Deploy
git commit -am "Update dependencies"
git push
```

## Support

For issues:
1. Check this deployment guide
2. Review README.md
3. Check Next.js documentation
4. Review Vercel documentation

---

🚀 Happy deploying!


