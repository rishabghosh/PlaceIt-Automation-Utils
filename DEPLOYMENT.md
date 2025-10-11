# Deployment Guide - GitLab Pages

This guide explains how to deploy the Placeit Bulk Mockup Generator web application to GitLab Pages.

## Quick Start

1. Push your code to GitLab
2. GitLab CI/CD will automatically build and deploy
3. Access your site at `https://[username].gitlab.io/[repository-name]/`

## Prerequisites

- GitLab account
- Git installed locally
- Repository pushed to GitLab

## Step-by-Step Deployment

### 1. Create GitLab Repository

If you haven't already:

```bash
# Navigate to your project
cd PlaceIt-Automation-Utils

# Add GitLab as a remote (if not already added)
git remote add gitlab git@gitlab.com:[your-username]/placeit-automation-utils.git

# Or use HTTPS
git remote add gitlab https://gitlab.com/[your-username]/placeit-automation-utils.git
```

### 2. Verify Your Branch

The CI/CD pipeline is configured to deploy from the `main` branch:

```bash
# Check current branch
git branch

# Switch to main if needed
git checkout main

# Or rename your current branch to main
git branch -M main
```

### 3. Push to GitLab

```bash
# Add all files
git add .

# Commit changes
git commit -m "Add web application for GitLab Pages deployment"

# Push to GitLab
git push gitlab main
```

### 4. Monitor CI/CD Pipeline

1. Go to your GitLab project page
2. Navigate to **CI/CD > Pipelines**
3. Watch the build progress
4. Wait for both "build" and "pages" jobs to complete

### 5. Access Your Site

1. Go to **Settings > Pages** in your GitLab project
2. Find your URL: `https://[username].gitlab.io/[repository-name]/`
3. Click the URL to open your deployed site

## Understanding the CI/CD Pipeline

The `.gitlab-ci.yml` file defines the deployment process:

### Build Stage
```yaml
build:
  - npm ci                    # Install dependencies
  - npm run build:web        # Build the web app
  - mkdir -p public/src      # Create directory
  - cp src/mapping_sample.json public/src/  # Copy sample files
```

### Deploy Stage
```yaml
pages:
  - Deploys the public/ directory to GitLab Pages
  - Only runs on the main branch
```

## Local Testing Before Deployment

Always test locally before deploying:

```bash
# Development mode
npm run dev:web

# Build and preview production
npm run build:web
npm run preview:web
```

## Troubleshooting

### Pipeline Fails

**Error: "npm: command not found"**
- The GitLab CI image includes Node.js, this shouldn't happen
- Check `.gitlab-ci.yml` uses `image: node:18`

**Error: "vite: command not found"**
- Dependencies may not be installed correctly
- Verify `npm ci` runs before `npm run build:web`

**Build succeeds but site shows 404**
- Check that the `base` path in `vite.config.web.js` is correct
- For subdirectory hosting, use: `base: '/[repository-name]/'`
- For root hosting, use: `base: './'`

### Pages Not Updating

1. **Check Pipeline Status**
   ```
   CI/CD > Pipelines > Latest Pipeline
   ```
   - Both jobs should show green checkmarks
   - Click on failed jobs to see error logs

2. **Clear Browser Cache**
   ```
   Hard reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   ```

3. **Verify Artifacts**
   ```
   CI/CD > Pipelines > [Latest Pipeline] > Browse > public/
   ```
   - Should contain: index.html, assets/, src/

### Sample Mapping Not Loading

**Error: 404 when loading mapping_sample.json**

Solution 1 - Verify file copied:
```bash
# In .gitlab-ci.yml build stage:
- mkdir -p public/src
- cp src/mapping_sample.json public/src/
```

Solution 2 - Check path in web-app.js:
```javascript
const response = await fetch('/src/mapping_sample.json');
```

Solution 3 - For subdirectory deployment, use relative path:
```javascript
const response = await fetch('./src/mapping_sample.json');
```

## Custom Domain

To use a custom domain with GitLab Pages:

1. **Add DNS Records**
   ```
   Type: A
   Name: yourdomain.com
   Value: 35.185.44.232 (GitLab Pages IP)
   ```

2. **Configure in GitLab**
   - Settings > Pages > New Domain
   - Enter your domain name
   - Follow verification steps

3. **Update Base Path**
   ```javascript
   // vite.config.web.js
   base: '/' // For custom domain use root path
   ```

## Environment-Specific Configuration

### Development
```bash
npm run dev:web
# Runs on http://localhost:3000
```

### Production Preview
```bash
npm run build:web
npm run preview:web
# Preview production build locally
```

### GitLab Pages
```bash
# Automatically deployed via CI/CD
# Available at: https://[username].gitlab.io/[repository-name]/
```

## Deployment Checklist

Before deploying:

- [ ] Test locally with `npm run dev:web`
- [ ] Build succeeds with `npm run build:web`
- [ ] Preview production build with `npm run preview:web`
- [ ] All features work correctly
- [ ] Sample mapping loads successfully
- [ ] CSV parsing works
- [ ] URL generation functions properly
- [ ] Copy and open URL features work
- [ ] Download URLs feature works
- [ ] Responsive design looks good on mobile

After deploying:

- [ ] Pipeline completes successfully
- [ ] Site loads at GitLab Pages URL
- [ ] All features work in production
- [ ] No console errors
- [ ] Sample mapping loads
- [ ] Test with real CSV data
- [ ] Test on different browsers

## CI/CD Configuration Options

### Deploy from Different Branch

To deploy from a branch other than `main`:

```yaml
# .gitlab-ci.yml
pages:
  only:
    - production  # Change this to your branch name
```

### Deploy on Every Push

To deploy from any branch:

```yaml
pages:
  except:
    - []  # Remove the "only" restriction
```

### Add Testing Stage

Add automated tests before deployment:

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm ci
    - npm run test  # Add test script to package.json
```

## Monitoring

### View Deployment Logs

1. CI/CD > Pipelines
2. Click on latest pipeline
3. Click on "pages" job
4. View deployment logs

### Check Site Status

Visit your Pages URL and check:
- Page loads correctly
- No 404 errors in console
- All resources load (CSS, JS)
- Features function as expected

## Updating the Site

To update your deployed site:

```bash
# Make changes to your code
git add .
git commit -m "Update web application"
git push gitlab main

# GitLab will automatically rebuild and redeploy
```

Changes typically appear within 2-5 minutes.

## Security Considerations

1. **No Sensitive Data**: Never commit API keys or credentials
2. **Environment Variables**: Not needed for static site
3. **HTTPS**: GitLab Pages provides free SSL/TLS
4. **CORS**: Sample files must be served from same origin

## Performance Optimization

The build process automatically:
- Minifies JavaScript and CSS
- Optimizes HTML
- Generates gzip versions
- Creates efficient bundles

Typical build output:
```
public/index.html               ~9 kB  │ gzip: ~3 kB
public/assets/main-[hash].js    ~7 kB  │ gzip: ~3 kB
```

## Alternative Deployment Methods

While this guide focuses on GitLab Pages, you can also deploy to:

### Netlify
```bash
npm run build:web
# Upload public/ folder to Netlify
```

### Vercel
```bash
npm run build:web
vercel --prod
```

### GitHub Pages
```bash
# Update vite.config.web.js base path
npm run build:web
# Push public/ to gh-pages branch
```

### Any Static Host
```bash
npm run build:web
# Upload public/ folder to any web server
```

## Support

For deployment issues:
- Check GitLab CI/CD documentation
- Review pipeline logs for errors
- Verify .gitlab-ci.yml syntax
- Test build locally first

For application issues:
- See [README.web.md](./README.web.md)
- Open an issue on GitHub/GitLab
- Check browser console for errors