# Yaan Batho - Static Personal Site

A sleek, futuristic personal site with a monochrome cyber aesthetic. Built with vanilla HTML, CSS, and JavaScript - **no servers, no npm, no build tools**. Just open in Chrome!

## ✨ Features

- **Cyber Aesthetic**: Monochrome design (#000, #0A0A0A, #111, #EDEDED, #FFF) with grid backgrounds, glass effects, and scanlines
- **Fully Responsive**: Works on all devices from mobile (320px) to ultrawide displays
- **Project Showcase**: All 11 projects with filterable tags
- **Music Player**: Working audio player with your 3 Kainer tracks from the tunes folder
- **Multiple Pages**: Home, Projects, Bio, Music, Contact, Now, Uses
- **Smooth Animations**: CSS animations with proper transitions
- **Accessibility**: Keyboard navigation, proper ARIA labels, semantic HTML

## 🚀 How to Use

### Quick Start

1. Navigate to the folder: `C:\Users\theja\Desktop\mee\`
2. Double-click `index.html`
3. That's it! The site opens in your browser 🎉

### File Structure

```
mee/
├── index.html              # Home page
├── projects.html           # Projects gallery with filtering
├── bio.html                # Biography with timeline
├── music.html              # Music player with 3 tracks
├── contact.html            # Contact form
├── now.html                # Current status
├── uses.html               # Tools & gear
├── css/
│   └── style.css          # All styles (cyber aesthetic)
├── js/
│   └── main.js            # Interactions & audio player
├── data/
│   ├── projects.json      # All project data
│   └── tracks.json        # Music tracks metadata
└── tunes/                 # Your music files (from ../tunes)
    ├── Kainer - Deep Pan.mp3
    ├── Kainer - Glide (Original Mix) kainer996@gmail.com.mp3
    └── Kainer - Listen and Repeat.mp3
```

## 🎨 Pages Overview

### Home (`index.html`)
- Hero section with animated badge
- Featured projects (6 cards)
- Call-to-action section
- Fully animated grid background

### Projects (`projects.html`)
- All 11 projects
- Filterable by tag (click any tag to filter)
- Shows status badges for in-progress projects
- Click any card to view (placeholder for now)

### Bio (`bio.html`)
- Snapshot of who you are
- Current projects list
- Interests & focus areas
- Timeline of your journey
- Skills breakdown (Technical & Creative)

### Music (`music.html`)
- 6 music tracks (3 as Kainer, 3 as Yaan Batho)
- Working audio player for Kainer tracks
- Filter by alias
- Play/pause, seek, time display
- "Coming soon" for Yaan Batho tracks

### Contact (`contact.html`)
- Contact form (opens mailto)
- Social media links
- Clean two-column layout

### Now (`now.html`)
- Current focus and active projects
- What you're learning
- Current location/status
- Reading list

### Uses (`uses.html`)
- Development tools
- Creative software
- Game development stack
- Hardware setup
- Productivity apps

## 🎵 Music Player

The music player features:
- ✅ Play/Pause functionality
- ✅ Progress bar with seeking
- ✅ Current time and duration display
- ✅ Works with the 3 Kainer tracks from `../tunes/`
- ✅ Filter by artist alias

**Note**: The 3 "Yaan Batho" tracks show "Coming soon" since audio files don't exist yet.

## 🎯 Interactive Features

### Project Filtering
Click any tag on the projects page to filter projects by that category. Click "All" to show everything again.

### Music Filtering
Click "Kainer" or "Yaan Batho" to filter tracks by alias.

### Mobile Menu
On mobile devices (<768px), the menu becomes a hamburger menu. Click to toggle.

### Contact Form
Fills out an email template and opens your default email client with the message pre-filled.

## 🎨 Customization

### Update Your Information

**Site-wide changes** (in all HTML files):
- Replace "Yaan Batho" with your name
- Update social links (Twitter, GitHub, LinkedIn)
- Change email address: `hello@yaanbatho.com`

### Add Your Own Content

**Projects**: Edit `data/projects.json`
```json
{
  "slug": "my-project",
  "title": "My New Project",
  "excerpt": "Short description...",
  "tags": ["tag1", "tag2"],
  "tech": ["Tech1", "Tech2"],
  "status": "released",
  "year": 2025
}
```

**Music**: Edit `data/tracks.json`
```json
{
  "title": "My Track",
  "year": 2025,
  "alias": "Your Alias",
  "audioUrl": "tunes/yourtrack.mp3",
  "tags": ["genre1", "genre2"]
}
```

### Change Colors

Edit `css/style.css` - look for `:root` at the top:
```css
:root {
    --bg: #0A0A0A;      /* Background */
    --fg: #EDEDED;       /* Foreground/text */
    --muted: #111111;    /* Muted elements */
    --border: #222222;   /* Borders */
    --glow: #FFFFFF;     /* Glow effects */
}
```

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (Single column, hamburger menu)
- **Tablet**: 768px - 1024px  
- **Desktop**: 1024px+
- **Max width**: 1200px container

## ⌨️ Keyboard Navigation

- `Tab` - Navigate through links and buttons
- `Enter` - Activate links/buttons
- All interactive elements have visible focus states

## 🌐 Browser Compatibility

Works in all modern browsers:
- ✅ Chrome
- ✅ Firefox
- ✅ Edge  
- ✅ Safari

**No Internet Explorer support** (uses modern CSS features)

## 🚀 Deployment Options

### Option 1: GitHub Pages (Free)

1. Create a GitHub repository
2. Upload all files
3. Go to Settings → Pages
4. Select branch: `main`, folder: `/root`
5. Your site will be live at `yourusername.github.io/repo-name`

### Option 2: Netlify (Free)

1. Drag the `mee` folder to Netlify Drop
2. Your site is live instantly!
3. Get a free subdomain or add custom domain

### Option 3: Vercel (Free)

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the mee folder
3. Follow prompts
4. Done!

### Option 4: Any Web Host

Just upload all files via FTP to your web hosting. That's it!

## 📝 Content Guidelines

### Writing Style
- Keep it authentic and personal
- Short paragraphs (2-3 sentences)
- Bullet points for lists
- Active voice

### Image Placeholders
Currently using text placeholders. To add real images:
1. Create images (1200x630px for projects, 800x800px for music)
2. Save in appropriate folders
3. Update image paths in HTML

## 🎯 What's Different from the Next.js Version

✅ **Pros**:
- No build process
- No Node.js required
- Just open in browser
- Easy to edit
- Works offline
- Simple deployment

❌ **What's missing**:
- No TypeScript (vanilla JavaScript)
- No MDX (plain HTML for content)
- No automatic optimization
- No dynamic routing

## 🔧 Troubleshooting

**Music not playing?**
- Make sure music files are in the `tunes` folder
- Check file paths match exactly (case-sensitive)
- Try opening in Chrome (best compatibility)

**Styles not loading?**
- Check that `css/style.css` exists
- View page source and click the stylesheet link to verify it loads

**JavaScript not working?**
- Check browser console for errors (F12)
- Make sure `js/main.js` exists and loads

## 💡 Tips

1. **Test locally**: Always open index.html and click through all pages before deploying
2. **Add your music**: Replace Kainer tracks with your own in the tunes folder
3. **Update content**: Edit HTML directly or JSON files for projects/music
4. **Customize colors**: Play with the CSS variables in style.css
5. **Add images**: Replace text placeholders with actual project screenshots

## 📧 Support

Questions? Found a bug? Just open the HTML files in a text editor and fix it! Everything is plain HTML/CSS/JS - no build tools, no complexity.

---

**🎉 Your site is ready!** Just double-click `index.html` and enjoy your sleek cyber portfolio!

Built with ❤️ for Yaan Batho

