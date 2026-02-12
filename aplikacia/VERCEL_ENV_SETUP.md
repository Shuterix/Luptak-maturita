# Vercel Environment Variables Setup Guide

## Required Environment Variables

### 1. **MONGODB_URI** (Required)
**What it is:** Your MongoDB database connection string

**How to find it:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click on your cluster
3. Click "Connect"
4. Choose "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your actual database password
7. Replace `<dbname>` with your database name (or remove it)

**Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/database-name?retryWrites=true&w=majority
```

**Example:**
```
mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/dancehub?retryWrites=true&w=majority
```

---

### 2. **JWT_SECRET** (Required)
**What it is:** Secret key for signing and verifying JWT authentication tokens

**How to generate it:**
**Option A - Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option B - Using OpenSSL (if installed):**
```bash
openssl rand -base64 32
```

**Option C - Online generator:**
Visit: https://generate-secret.vercel.app/32

**Format:** Any long random string (at least 32 characters recommended)

**Example:**
```
aB3xK9mP2qR7vT5wY8zA1bC4dE6fG9hI0jK2lM3nO4pQ5rS6tU7vW8xY9z
```

⚠️ **Important:** Use a different secret for production than development!

---

### 3. **VAPID_PRIVATE_KEY** (Required for Push Notifications)
**What it is:** Private key for Web Push notifications

**How to generate it:**
1. Install `web-push` globally (if not already installed):
```bash
npm install -g web-push
```

2. Generate VAPID keys:
```bash
web-push generate-vapid-keys
```

This will output something like:
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa40HI9vVvQ0p5g5gN2y2uGtqP5TQvOuyYvHnJk...

Private Key:
8KYg-8evKj9FJj7qy7yq7yq7yq7yq7yq7yq7yq7yq7yq7yq7yq7yq7yq7yq7yQ

=======================================
```

3. Copy the **Private Key** value

**Format:** Base64 string

---

### 4. **NEXT_PUBLIC_VAPID_PUBLIC_KEY** (Required for Push Notifications)
**What it is:** Public key for Web Push notifications (exposed to client-side)

**How to find it:**
- Use the **Public Key** from the same `web-push generate-vapid-keys` command above
- This is the public key that was generated alongside the private key

**Format:** Base64 string

**Note:** The `NEXT_PUBLIC_` prefix means this variable will be exposed to the browser. This is safe for public keys.

---

### 5. **CRON_SECRET** (Optional - for cron jobs)
**What it is:** Secret key to secure your cron job endpoints

**How to generate it:**
Same as JWT_SECRET - use any of the methods above:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Format:** Any long random string

**When to use:** Only if you're setting up cron jobs (e.g., Vercel Cron) to call your `/api/notifications/send-reminders` endpoint

---

### 6. **OPENAI_API_KEY** (Optional - if using OpenAI features)
**What it is:** Your OpenAI API key

**How to find it:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in
3. Go to API Keys section
4. Create a new secret key
5. Copy it immediately (you won't see it again)

**Format:** `sk-...`

**Note:** Only add this if you're actually using OpenAI features in your app.

---

## How to Add Variables to Vercel

### Step 1: Go to Vercel Dashboard
1. Visit [vercel.com](https://vercel.com)
2. Sign in to your account
3. Select your project (or create a new one)

### Step 2: Navigate to Settings
1. Click on your project
2. Go to **Settings** tab
3. Click on **Environment Variables** in the left sidebar

### Step 3: Add Each Variable
For each environment variable:

1. Click **Add New**
2. Enter the **Name** (exactly as shown above, case-sensitive)
3. Enter the **Value** (paste your actual value)
4. Select which environments to apply it to:
   - ✅ **Production** (for live site)
   - ✅ **Preview** (for pull request previews)
   - ✅ **Development** (for local development with `vercel dev`)
5. Click **Save**

### Step 4: Redeploy
After adding all variables:
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on your latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a new deployment

---

## Quick Checklist

Before deploying, make sure you have:

- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `JWT_SECRET` - Generated random secret
- [ ] `VAPID_PRIVATE_KEY` - Generated with `web-push generate-vapid-keys`
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Generated with `web-push generate-vapid-keys`
- [ ] `CRON_SECRET` - (Optional) Generated random secret
- [ ] `OPENAI_API_KEY` - (Optional) Only if using OpenAI

---

## Testing Your Setup

After deployment, test these features:

1. **Database Connection:** Try logging in - if it works, MongoDB is connected ✅
2. **Authentication:** Login should work - JWT_SECRET is correct ✅
3. **Push Notifications:** Try subscribing to notifications - VAPID keys are correct ✅

---

## Troubleshooting

### "Missing MONGODB_URI"
- Check that you added `MONGODB_URI` (not `MONGO_URI` or `DATABASE_URL`)
- Verify the connection string is correct
- Make sure your MongoDB Atlas IP whitelist includes `0.0.0.0/0` (all IPs) or Vercel's IPs

### "Missing JWT_SECRET"
- Check spelling: `JWT_SECRET` (all caps, with underscore)
- Make sure it's added to Production environment

### "VAPID keys not configured"
- Verify both `VAPID_PRIVATE_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set
- Make sure they're from the same `web-push generate-vapid-keys` command
- Check that `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has the `NEXT_PUBLIC_` prefix

### Variables not working after deployment
- Make sure you **Redeploy** after adding variables
- Check that variables are added to the correct environment (Production/Preview/Development)
- Variables are case-sensitive - check spelling exactly

---

## Security Notes

⚠️ **Never commit these values to Git!**
- They should already be in `.gitignore`
- Only add them in Vercel dashboard
- Use different secrets for production vs development

🔒 **Best Practices:**
- Use long, random secrets (at least 32 characters)
- Rotate secrets periodically
- Use different secrets for each environment
- Never share secrets in screenshots or messages

