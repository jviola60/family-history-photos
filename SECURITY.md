# Security notes

This file is guidance for future work. It does not add FamilySearch sign-in.

## FamilySearch OAuth (not implemented)

If FamilySearch sign-in is added later, use the authorization-code flow with PKCE for a public browser client:

- Generate a new `code_verifier` and S256 `code_challenge` for every login. Do not reuse them.
- Send a random `state` value and reject the callback unless it matches the value stored for that attempt.
- Register one exact `redirect_uri` with FamilySearch and send that same string on both the authorize and token requests. For this site that would be `https://jviola60.github.io/family-history-photos/` unless a dedicated callback path is added and registered.
- Keep the access token and refresh token in memory only. Do not write them to `localStorage`, `sessionStorage`, IndexedDB, or cookies the page can read.
- Do not put a FamilySearch client secret in this repository or in the browser bundle. A public client uses PKCE and has no secret.
- Call only the FamilySearch hosts you have reviewed. Likely hosts, not enabled in the Content Security Policy today: `https://ident.familysearch.org` and `https://api.familysearch.org`.

## What the app does today

- The local restoration engine is the default. It does not upload photos.
- Fal.ai cloud models upload a photo only after a confirm dialog names that file and says it goes to fal.ai.
- The Fal API key is kept in memory and `sessionStorage`. Loading the app deletes any copy left in `localStorage`.
- OneDrive uses `VITE_MS_CLIENT_ID` from the build. See [docs/ONEDRIVE_SETUP.md](docs/ONEDRIVE_SETUP.md). There is no demo client ID in the source.
