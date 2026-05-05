# 🚀 Conferly Deployment Guide

## Automatic Deployment (Recommended)

### Current Setup ✅
Your GitHub Pages deployment is already configured for automatic updates:

- **Trigger**: Push to `main` branch
- **Build**: Automated with production environment variables
- **Deploy**: Automatic to GitHub Pages
- **Domain**: www.conferly.site
- **Zero downtime**: Seamless updates

### How It Works 🔄

1. **You push changes** to `main` branch
2. **GitHub Actions** automatically triggers deployment workflow
3. **Build process** runs with all environment variables
4. **Frontend deploys** to GitHub Pages automatically
5. **Updates go live** without manual intervention

### What You Need To Do 📋

#### **For Development:**
```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main
```

#### **For Production Updates:**
```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Make your changes
git add .
git commit -m "Production update: description"
git push origin main
```

### Environment Variables 🔐

All required environment variables are already configured in GitHub Secrets:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY` 
- ✅ `VITE_PEACH_ENTITY_ID`
- ✅ `VITE_PEACH_SECRET`
- ✅ `VITE_PEACH_MODE`
- ✅ `VITE_N8N_WEBHOOK_URL`
- ✅ `VITE_API_URL`

### Monitoring 📊

- **Build Status**: Check GitHub Actions tab
- **Deployment Status**: Automatic updates in real-time
- **Rollback**: Previous versions available in GitHub

### Custom Domain Configuration 🌐

Your custom domain `www.conferly.site` is already configured in:
- ✅ `vite.config.ts` - Base path set to `/`
- ✅ **GitHub Pages** - Custom domain active
- ✅ **SSL Certificate** - Automatic HTTPS

## 🎯 **Best Practices**

### For Seamless Updates:
1. **Test locally** before pushing
2. **Use descriptive commit messages**
3. **Push to main branch** for production
4. **Monitor GitHub Actions** for build status

### 🚨 **Troubleshooting**

If deployment fails:
1. Check **GitHub Actions** tab for error logs
2. Verify **environment variables** in GitHub Secrets
3. Ensure **build passes** locally with `npm run build`

---

**Your deployment is already set up for seamless, automatic updates!** 🎉
