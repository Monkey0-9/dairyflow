# MilkFlow — Simple Dairy Management for Farmers
## Easy Deployment Guide (No coding knowledge required!)

### 🚀 Quick Start for Farmers

This is a simple dairy management system that helps you:
- Track daily milk deliveries to customers
- Manage customer subscriptions
- Generate monthly bills
- Record payments (UPI, Cash, Bank Transfer)
- Track inventory and production

**No complex setup needed - just a few simple steps!**

---

## 1. What You Need

### Free Account Required:
- **Vercel Account** (for hosting) - https://vercel.com (Free tier is enough)
- **Neon Database** (for data storage) - https://neon.tech (Free tier is enough)

### Optional (but recommended):
- **GitHub Account** - For easy updates and backups

---

## 2. Setup Your Database (5 minutes)

1. Go to https://neon.tech and sign up (free)
2. Create a new project called "milkflow"
3. Copy the connection string (it looks like: `postgresql://...`)
4. Save it somewhere safe - you'll need it

---

## 3. Deploy to Vercel (10 minutes)

### Option A: If you have GitHub (Recommended)
1. Push this project to your GitHub account
2. Go to https://vercel.com and sign up/login
3. Click "Add New Project" → "Import from Git"
4. Select your GitHub repository
5. Vercel will detect it's a Next.js project automatically
6. Add these environment variables in Vercel settings:
   ```
   DATABASE_URL = (paste your Neon connection string)
   SESSION_SECRET = (any random password you like)
   DEMO_LOGIN_ENABLED = false
   NEXT_PUBLIC_DEMO_MODE = false
   NODE_ENV = production
   ```
7. Click "Deploy" - wait 2-3 minutes
8. Your app is live! Vercel will give you a URL like `https://milkflow.vercel.app`

### Option B: Without GitHub (Direct Deploy)
1. Go to https://vercel.com and sign up/login
2. Download Vercel CLI: `npm i -g vercel`
3. In this project folder, run: `vercel`
4. Follow the simple prompts
5. Add the environment variables when asked
6. Your app will be deployed!

---

## 4. Setup Your Database Tables (2 minutes)

After deployment, you need to create the database tables:

1. Go to your Neon database dashboard
2. Open the "SQL Editor"
3. Copy and run the schema from `prisma/schema.sql` (or ask us to help)
4. That's it - your database is ready!

---

## 5. Start Using Your App

1. Open your Vercel URL in browser
2. Sign in with your real farmer credentials (demo mode stays disabled in production)
3. Add your first customer
4. Start recording deliveries
5. Generate bills at month end

---

## 6. Recording Payments (Simple Manual Process)

Since we removed complex payment gateways, you can:
- **UPI**: Record UPI transaction ID manually
- **Cash**: Record cash payments with notes
- **Bank Transfer**: Record bank reference numbers
- **Cheque**: Record cheque details

Just go to Payments section and click "Record Payment" - it's that simple!

---

## 7. Daily Operations

### Morning:
- Open app → Record yesterday's milk production
- Check which customers need delivery today
- Note any vacation pauses

### Evening:
- Record actual deliveries made
- Note any missed deliveries and reasons
- Record any payments received

### Month End:
- Click "Generate Monthly Bills"
- Review and send bills to customers
- Follow up on unpaid bills

---

## 8. Support & Help

If you face any issues:
- Check your internet connection
- Make sure DATABASE_URL is correct in Vercel settings
- Try redeploying from Vercel dashboard
- Contact support if needed

---

## 🎉 That's It!

Your dairy management system is now running without any complex enterprise features. It's designed to be simple and easy for farmers to use daily.

**Total setup time: ~20 minutes**
**Monthly cost: ₹0 (Free tiers are sufficient for most dairy farms)**