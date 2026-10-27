# Google Drive integration

The Google Drive integration lets administrators browse a Google Drive account from the
Trust Center admin and copy selected files into the Trust Center's private document storage.
It uses an OAuth client that **you** create in your own Google Cloud project; no third party is
involved.

## What it can and cannot do

| Can | Cannot |
| --- | --- |
| List and search files and folders the connected account can see (My Drive, shared with me, shared drives) | Change, move, share or delete anything in Drive (the scope is read-only) |
| Download files you explicitly select and store a copy in the Trust Center | Synchronise automatically or watch for changes; every import is a manual, audited action |
| Export Google Docs, Sheets, Slides and Drawings as PDF | Import Google Forms, Sites, Maps or other non-exportable Google types |
| Show the name and email address of the connected account | Access Gmail, Calendar or any other Google service |

Imported documents are created with visibility **Private** and only become visible on the public
Trust Center after an administrator changes that. Files larger than `MAX_UPLOAD_MB` (default 25 MB)
and file types outside the upload allow-list are skipped with an error message.

## 1. Create the OAuth client in Google Cloud

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select (or create) the
   project that should own the integration.
2. **Enable the Drive API**: *APIs & Services → Library → Google Drive API → Enable*.
3. **Configure the OAuth consent screen** (*APIs & Services → OAuth consent screen* / *Google Auth
   platform → Branding*):
   - App name: for example "Acme Trust Center". Add a support email and developer contact.
   - **User type**:
     - **Internal** (Google Workspace customers only): only users of your Workspace organisation can
       connect, and no Google verification is needed. This is the recommended choice for a Trust
       Center, which is connected once by an administrator.
     - **External**: required if the connecting account is a personal Gmail account or belongs to
       another organisation. While the app is in *Testing* status you must add the connecting
       account under *Test users* (up to 100), refresh tokens are **revoked after 7 days**, and you
       will need to reconnect weekly. Publishing the app to *Production* with the
       `drive.readonly` scope triggers Google's **restricted-scope verification** (a security
       assessment with a third-party assessor, which can cost money and take weeks). For a single
       self-hosted installation, *Internal* or keeping a Workspace account avoids all of that.
   - **Scopes**: add
     - `openid`
     - `.../auth/userinfo.email` (`email`)
     - `.../auth/userinfo.profile` (`profile`)
     - `https://www.googleapis.com/auth/drive.readonly` — **restricted scope**. The application asks
       for it because browsing and downloading arbitrary files the administrator picks requires it;
       the narrower `drive.file` scope only covers files created through Google's own picker UI, which
       this self-hosted app does not use.
4. **Create credentials**: *APIs & Services → Credentials → Create credentials → OAuth client ID*.
   - Application type: **Web application**.
   - Name: e.g. "Trust Center (production)".
   - **Authorised redirect URIs**: add exactly

     ```
     https://trust.example.com/api/integrations/google/callback
     ```

     replacing the host with your `APP_URL`. The value must match character for character
     (scheme, host, port, path, no trailing slash). The Integrations page in the admin shows the
     exact URI to register for your installation.
   - You do not need any *Authorised JavaScript origins*: the flow is entirely server-side.
5. Copy the **Client ID** and **Client secret**.

## 2. Configure the Trust Center

Set these environment variables for the application (for Docker Compose, in your `.env` file) and
restart:

```
APP_URL=https://trust.example.com
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

`APP_URL` must be the public URL of your installation; the redirect URI is derived from it. The
integration is considered *configured* as soon as both Google variables are present. Nothing is
sent to Google until an administrator clicks **Connect**.

## 3. Connect

1. Sign in to the admin, open **Integrations** and click **Connect Google Drive**.
2. You are redirected to Google (`accounts.google.com`). The application uses the OAuth 2.0
   authorization-code flow for web servers with **PKCE (S256)**, a random, signed `state`, and
   `access_type=offline` + `prompt=consent` so Google issues a refresh token.
3. Choose the account whose Drive holds the documents and approve the read-only permission.
4. Google sends you back to `/api/integrations/google/callback`; the application verifies the
   `state`, exchanges the code (with the PKCE verifier and your client secret, server to server),
   reads the account's name and email address and stores the tokens.
5. The Integrations page now shows *Connected as …*. Go to **Documents → Import from Google Drive**
   to pick files.

## How tokens are stored

- The access token and refresh token are encrypted with **AES-256-GCM** under the server's
  `ENCRYPTION_KEY` before they are written to the `Integration` table. They are never logged and
  never sent to the browser.
- Access tokens are short-lived (about one hour). When one is within two minutes of expiring, or
  when Google rejects it, the application obtains a new one with the refresh token and re-encrypts
  it.
- If you rotate `ENCRYPTION_KEY`, stored tokens become unreadable and the integration must be
  reconnected.
- Connecting and disconnecting, and every import, are written to the audit log.

## Disconnecting and revoking

- **Disconnect** on the Integrations page deletes the stored tokens and asks Google to revoke them
  (`https://oauth2.googleapis.com/revoke`). The Trust Center then disappears from the account's
  [connected apps](https://myaccount.google.com/permissions). Documents you imported remain; they
  are copies.
- You can also revoke from the Google side at any time (Google account → Security → Third-party
  apps). The application will then report *The connection to Google Drive has expired or was revoked*
  and you can disconnect and reconnect.
- Rotating the client secret in Google Cloud invalidates refresh tokens; reconnect afterwards.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Google shows **Error 400: redirect_uri_mismatch** | The redirect URI registered in Google Cloud differs from `${APP_URL}/api/integrations/google/callback`. Compare scheme (`https`), host, port and path exactly; check that `APP_URL` has no trailing slash and that a reverse proxy is not rewriting the host. |
| **Error 403: access_denied** / "This app is blocked" / "hasn't been verified" | *External* app in Testing: add the connecting account as a test user, or switch to *Internal* (Workspace). Workspace administrators may also need to allow the app under *Admin console → Security → API controls*. |
| **Error 401: invalid_client** or the admin shows "Google Drive did not accept the authorisation" | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are wrong, belong to a different client type (must be *Web application*), or the secret was rotated. |
| Admin shows "The sign-in could not be verified" | The `state` did not match: the 10-minute window passed, the callback was opened in another browser, or cookies for `APP_URL` are blocked. Start again from the Integrations page. |
| Connection stops working after 7 days | *External* app still in Testing status (refresh tokens expire after 7 days). Publish the app or use an *Internal* Workspace app. |
| "The connection to Google Drive has expired or was revoked" | The refresh token was revoked (by the user, by a password change on some account types, by a client-secret rotation, or by inactivity for 6 months). Disconnect and connect again. |
| Files appear in Drive but not in the picker | The connected account cannot see them (sharing), they are in the trash, or they are Google-native types with no PDF export (Forms, Sites). Search looks at file names only. |
| Import fails with "larger than the … MB upload limit" | Raise `MAX_UPLOAD_MB` (Google exports are capped at 10 MB by Google regardless). |
| Import fails with "This file type is not supported" | The content failed the magic-byte allow-list (PDF, Office, OpenDocument, PNG/JPEG/WebP/SVG, TXT/MD/CSV, ZIP). |

## Automated testing without Google

`tests/mocks/oauth-mock-server.ts` implements the same endpoints locally. Point the application at
it with `GOOGLE_OAUTH_BASE_URL` and `GOOGLE_API_BASE_URL` (test-only variables; leave them unset in
production). See the comment at the top of that file for the supported switches.
