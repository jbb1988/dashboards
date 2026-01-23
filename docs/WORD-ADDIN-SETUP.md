# Microsoft Word Add-in Setup Guide

This guide walks you through setting up the MARS Word Add-in, including Azure AD registration, building the add-in, and deploying it to users.

---

## Prerequisites

- Azure account with admin access (or ask your IT admin)
- Node.js 18+ installed locally
- Microsoft 365 subscription (for testing)
- MARS application deployed and running

---

## Step 1: Register App in Azure AD

### 1.1 Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account
3. Search for **"App registrations"** in the top search bar
4. Click **"App registrations"** under Services

### 1.2 Create New Registration

1. Click **"+ New registration"** button
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Name** | `MARS Contract Review` |
   | **Supported account types** | Select based on your needs: |
   | | - "Single tenant" = Only your organization |
   | | - "Multitenant" = Any Microsoft account |
   | **Redirect URI** | Select "Single-page application (SPA)" |
   | | Enter: `https://your-domain.com/word-addin/auth-callback.html` |

3. Click **"Register"**

### 1.3 Note Your Application IDs

After registration, you'll see the Overview page. Copy these values:

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (tenant) ID:   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Save these!** You'll need them for configuration.

### 1.4 Create Client Secret

1. In left sidebar, click **"Certificates & secrets"**
2. Click **"+ New client secret"**
3. Enter description: `MARS Word Add-in Secret`
4. Select expiration: `24 months` (recommended)
5. Click **"Add"**
6. **IMMEDIATELY copy the secret value** - it won't be shown again!

```
Client Secret Value: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 1.5 Configure API Permissions

1. In left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search and check these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click **"Add permissions"**
7. Click **"Grant admin consent for [Your Organization]"** (requires admin)

### 1.6 Configure Authentication Settings

1. In left sidebar, click **"Authentication"**
2. Under "Single-page application", verify your redirect URI is listed
3. Add additional redirect URIs if needed:
   ```
   https://your-domain.com/word-addin/auth-callback.html
   https://localhost:3001/auth-callback.html (for development)
   ```
4. Under "Implicit grant and hybrid flows":
   - Check **"Access tokens"**
   - Check **"ID tokens"**
5. Click **"Save"**

---

## Step 2: Configure MARS Environment Variables

Add these to your `.env.local` or Vercel environment:

```env
# Azure AD Configuration
AZURE_AD_CLIENT_ID=your-application-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret-value
AZURE_AD_TENANT_ID=your-tenant-id

# JWT Secret for Add-in tokens
JWT_SECRET=generate-a-random-32-character-string

# App URL (used for redirects)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Generate a JWT Secret

Run this in terminal to generate a secure secret:

```bash
openssl rand -base64 32
```

Or use Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Step 3: Update Manifest File

Edit `/word-addin/manifest.xml`:

### 3.1 Update App ID

Generate a new UUID for your add-in:

```bash
uuidgen
```

Replace the `<Id>` value:

```xml
<Id>YOUR-NEW-UUID-HERE</Id>
```

### 3.2 Update URLs

Replace all instances of `https://mars-contracts.vercel.app` with your domain:

```xml
<IconUrl DefaultValue="https://YOUR-DOMAIN.com/word-addin/assets/icon-32.png"/>
<SupportUrl DefaultValue="https://YOUR-DOMAIN.com/support"/>
<SourceLocation DefaultValue="https://YOUR-DOMAIN.com/word-addin/taskpane.html"/>
```

### 3.3 Update Provider Name

```xml
<ProviderName>Your Company Name</ProviderName>
```

---

## Step 4: Build the Add-in

### 4.1 Install Dependencies

```bash
cd word-addin
npm install
```

### 4.2 Build for Production

```bash
npm run build
```

This creates a `dist/` folder with:
- `taskpane.html` + `taskpane.bundle.js`
- `commands.html` + `commands.bundle.js`

### 4.3 Copy to Public Directory

The built files need to be served from your web application:

```bash
# Copy to Next.js public folder
cp -r dist/* ../public/word-addin/

# Also copy the HTML files from public/
cp public/*.html ../public/word-addin/
cp public/*.css ../public/word-addin/
```

Or configure your deployment to serve the `word-addin/dist` directory at `/word-addin/`.

---

## Step 5: Deploy and Test

### 5.1 Deploy Your Application

Deploy your MARS application with the new environment variables and word-addin files.

### 5.2 Verify URLs Work

Test these URLs in your browser:
- `https://your-domain.com/word-addin/taskpane.html` - Should show loading UI
- `https://your-domain.com/word-addin/auth.html` - Should show sign-in button

### 5.3 Sideload the Add-in (Development Testing)

#### For Word Online:

1. Open Word Online at [office.com](https://office.com)
2. Create or open a document
3. Click **Insert** tab → **Add-ins** → **My Add-ins**
4. Click **Upload My Add-in**
5. Browse to your `manifest.xml` file
6. Click **Upload**

#### For Word Desktop (Windows):

1. Open Word
2. Click **Insert** tab → **Add-ins** → **My Add-ins**
3. Click **Shared Folder** tab
4. Copy your `manifest.xml` to:
   ```
   \\localhost\c$\Users\[username]\AppData\Local\Microsoft\Office\16.0\WEF\
   ```
5. Restart Word

#### For Word Desktop (Mac):

1. Copy `manifest.xml` to:
   ```
   /Users/[username]/Library/Containers/com.microsoft.Word/Data/Documents/wef/
   ```
2. Restart Word

### 5.4 Test the Add-in

1. Open Word and look for **"MARS Contracts"** in the Home ribbon
2. Click **"Review Panel"** to open the taskpane
3. Click **"Sign in with Microsoft"**
4. Complete authentication
5. Open a contract document
6. Click **"Analyze Document"**
7. Verify risks are identified and displayed

---

## Step 6: Publish to Office Store (Optional)

For organization-wide deployment without sideloading:

### 6.1 Admin-Managed Deployment

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Settings** → **Integrated apps**
3. Click **Upload custom apps**
4. Upload your `manifest.xml`
5. Choose deployment scope (specific users/groups/organization)
6. Deploy

### 6.2 Office Store (Public)

For public distribution:

1. Create a [Partner Center](https://partner.microsoft.com) account
2. Submit your add-in for certification
3. Provide required assets:
   - Screenshots
   - Privacy policy URL
   - Support URL
   - Icon images (various sizes)
4. Wait for Microsoft review (1-2 weeks)

---

## Troubleshooting

### "Add-in failed to load"

- Check browser console for errors
- Verify manifest.xml URLs are correct and accessible
- Ensure HTTPS is used for all URLs

### "Authentication failed"

- Verify `AZURE_AD_CLIENT_ID` is correct
- Check redirect URI matches exactly in Azure AD
- Ensure API permissions are granted

### "Analysis returns errors"

- Check `OPENROUTER_API_KEY` is valid
- Verify API route is accessible
- Check server logs for detailed errors

### "Clauses don't load"

- Ensure database migrations have run
- Check user has valid authentication token
- Verify `/api/word-addin/clauses` endpoint works

### Add-in doesn't appear in ribbon

- Clear Office cache:
  - Windows: Delete contents of `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`
  - Mac: Delete contents of `~/Library/Containers/com.microsoft.Word/Data/Library/Caches/`
- Restart Word completely

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Microsoft Word                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MARS Word Add-in (TaskPane)              │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │    │
│  │  │ Analyze │  │ Clauses │  │ Insert at Cursor    │  │    │
│  │  └────┬────┘  └────┬────┘  └──────────┬──────────┘  │    │
│  └───────┼────────────┼──────────────────┼─────────────┘    │
└──────────┼────────────┼──────────────────┼──────────────────┘
           │            │                  │
           ▼            ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│                      MARS API Server                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │ /word-addin/   │  │ /word-addin/   │  │ /word-addin/  │  │
│  │ analyze        │  │ clauses        │  │ auth          │  │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘  │
│          │                   │                   │           │
│          ▼                   ▼                   ▼           │
│  ┌───────────────┐   ┌─────────────┐   ┌─────────────────┐  │
│  │ OpenRouter AI │   │  Supabase   │   │    Azure AD     │  │
│  │ (Claude)      │   │  Database   │   │    OAuth 2.0    │  │
│  └───────────────┘   └─────────────┘   └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

1. **Token Storage:** JWT tokens stored in localStorage (consider sessionStorage for higher security)
2. **HTTPS Required:** All add-in URLs must use HTTPS
3. **CORS:** API routes include appropriate CORS headers for Office domains
4. **Token Expiration:** JWT tokens expire after 7 days
5. **Webhook Secrets:** DocuSign webhooks use HMAC verification

---

## Support

For issues:
- Check browser console (F12 → Console)
- Check Network tab for failed requests
- Review server logs in Vercel/your hosting platform
- Contact: support@your-domain.com
