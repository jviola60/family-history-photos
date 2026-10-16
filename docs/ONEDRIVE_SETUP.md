# OneDrive import setup

OneDrive import stays off until you register your own Microsoft app and put its client ID into this project. There is no built-in demo client ID.

The published site is:

`https://jviola60.github.io/family-history-photos/`

That URL comes from the GitHub Pages project site for `jviola60/family-history-photos`. `vite.config.js` sets `base: './'`, and `.github/workflows/deploy.yml` publishes the Vite build with the official Pages actions, so the app is served under the repository path `/family-history-photos/`, not the domain root.

## 1. Register an Entra app

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **App registrations** → **New registration**.
2. Name it something like `Family History Photos`.
3. Supported account types. Pick one:
   - **Personal Microsoft accounts only** if the photos live in a personal OneDrive (Outlook.com, Hotmail, Live.com). This is the usual choice for a family album.
   - **Accounts in any organizational directory and personal Microsoft accounts** if some relatives use a work or school OneDrive and others use personal accounts.
   - **Single tenant** ("Accounts in this organizational directory only") only if every account that will sign in is inside your own Entra tenant. Personal Microsoft accounts cannot sign in to a single-tenant app. Do not pick this for a normal family OneDrive.
4. Redirect URI: platform **Single-page application (SPA)**, URI:

   `https://jviola60.github.io/family-history-photos/`

   Also add this only if a sign-in error says the redirect does not match:

   `https://jviola60.github.io/family-history-photos/index.html`

5. Register the app. Copy the **Application (client) ID**. That is the only value the site needs.

For local `npm run dev`, add these SPA redirect URIs as well:

- `http://localhost:5173/`
- `http://127.0.0.1:5173/`

## 2. API permissions

In the app: **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**.

Add:

- `User.Read` (sign in)
- `Files.Read` (download the files the person picks)
- `Files.Read.All` (files shared with that person; the OneDrive picker asks for this on some accounts)

No application permissions. No client secret. A SPA must not use a secret in the browser.

Personal Microsoft accounts do not need an admin to grant these delegated permissions. The person consents at sign-in.

## 3. Where the client ID goes

The workflow reads `VITE_MS_CLIENT_ID` at build time and Vite inlines it into the public JavaScript. It is not a confidential secret.

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** → **New repository variable**.
2. Name: `VITE_MS_CLIENT_ID`
3. Value: the Application (client) ID.
4. Re-run **Deploy to GitHub Pages** (Actions → the workflow → **Run workflow**). A variable change does not rebuild the site by itself.

A repository secret with the same name also works. The workflow uses `vars.VITE_MS_CLIENT_ID` and falls back to `secrets.VITE_MS_CLIENT_ID`. Prefer the variable, because the value ends up in the downloaded site either way.

Local development: create `.env.local` (already gitignored by `*.local`) with:

```
VITE_MS_CLIENT_ID=your-application-client-id
```

Restart `npm run dev` after changing it.

If the variable is missing, the OneDrive button stays disabled and the import panel explains that. ZIP and folder import still work.

## 4. Optional custom domain

If you later attach a custom domain to this Pages site, register that exact page URL as another SPA redirect URI, and add that origin plus path in `ai_service/origin_check.py` before using the local restoration server from the new domain.
