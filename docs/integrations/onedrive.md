# Microsoft OneDrive integration

The OneDrive integration lets administrators browse a OneDrive (personal or work/school) account
from the Trust Center admin and copy selected files into the Trust Center's private document
storage. It uses an app registration in **your** Microsoft Entra tenant and the Microsoft Graph API;
no third party is involved.

## What it can and cannot do

| Can | Cannot |
| --- | --- |
| List and search files and folders in the connected user's OneDrive (`/me/drive`) | Change, move, share or delete anything (the permission is read-only) |
| Download files you explicitly select and store a copy in the Trust Center | Synchronise automatically or watch for changes; every import is a manual, audited action |
| Show the name and email address of the connected account | Browse SharePoint sites or other users' drives (only `/me/drive` is used) |
| | Import OneNote notebooks or other "package" items |

Imported documents are created with visibility **Private** and only become visible on the public
Trust Center after an administrator changes that. Files larger than `MAX_UPLOAD_MB` (default 25 MB)
and file types outside the upload allow-list are skipped with an error message.

## 1. Register the application in Microsoft Entra

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) (or Azure portal →
   *Microsoft Entra ID*) and go to **App registrations → New registration**.
2. **Name**: e.g. "Acme Trust Center".
3. **Supported account types** — decide who may connect:
   - *Accounts in this organizational directory only* (single tenant): only users of your tenant.
     Set `MICROSOFT_TENANT` to your tenant ID or primary domain (e.g. `contoso.onmicrosoft.com`).
   - *Accounts in any organizational directory and personal Microsoft accounts*: use
     `MICROSOFT_TENANT=common` (the default). Required if the Trust Center documents live in a
     personal OneDrive.
   - *Personal Microsoft accounts only*: use `MICROSOFT_TENANT=consumers`.
4. **Redirect URI**: choose platform **Web** and enter exactly

   ```
   https://trust.example.com/api/integrations/microsoft/callback
   ```

   replacing the host with your `APP_URL`. The Integrations page in the admin shows the exact URI
   for your installation. Do not tick the implicit-grant boxes; the flow is server-side only.
5. Click **Register**, then copy the **Application (client) ID** from the Overview page.
6. **API permissions → Add a permission → Microsoft Graph → Delegated permissions** and add:
   - `Files.Read` — read the signed-in user's files
   - `User.Read` — sign in and read the user's profile (name, email)
   - `offline_access` — obtain a refresh token so the connection survives the one-hour access token
     (listed under *OpenId permissions*)

   These are all low-privilege permissions that normally do **not** require admin consent. If your
   tenant restricts user consent, an administrator can click **Grant admin consent for <tenant>** on
   this page, or approve the consent prompt during the first connection.
7. **Certificates & secrets → New client secret**. Choose an expiry (6, 12 or 24 months; Microsoft
   no longer allows "never"). Copy the secret **Value** immediately; it is shown only once. Note the
   expiry date somewhere you will see it: when it expires, the integration stops working until you
   create a new secret and reconnect.

## 2. Configure the Trust Center

Set these environment variables for the application (for Docker Compose, in your `.env` file) and
restart:

```
APP_URL=https://trust.example.com
MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT=common        # or your tenant ID / domain, or "consumers"
```

`APP_URL` must be the public URL of your installation; the redirect URI is derived from it. The
integration is considered *configured* as soon as both Microsoft credentials are present. Nothing
is sent to Microsoft until an administrator clicks **Connect**.

## 3. Connect

1. Sign in to the admin, open **Integrations** and click **Connect OneDrive**.
2. You are redirected to `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize`. The
   application uses the Microsoft identity platform **authorization-code flow with PKCE (S256)**, a
   random signed `state`, and `response_mode=query`.
3. Sign in with the account whose OneDrive holds the documents and accept the permissions.
4. Microsoft sends you back to `/api/integrations/microsoft/callback`; the application verifies the
   `state`, exchanges the code (with the PKCE verifier and the client secret, server to server),
   reads `displayName` and `mail`/`userPrincipalName` from `GET /me`, and stores the tokens.
5. The Integrations page now shows *Connected as …*. Go to **Documents → Import from OneDrive** to
   pick files.

Downloads use `GET /me/drive/items/{id}/content`, which answers with a redirect to a short-lived,
pre-authenticated URL; the application follows that redirect itself and never sends the access
token to the storage host.

## How tokens are stored

- The access token and refresh token are encrypted with **AES-256-GCM** under the server's
  `ENCRYPTION_KEY` before they are written to the `Integration` table. They are never logged and
  never sent to the browser.
- Access tokens are short-lived (60–90 minutes). When one is within two minutes of expiring, or when
  Graph rejects it, the application obtains a new one with the refresh token. Microsoft rotates
  refresh tokens on every refresh; the new one replaces the old one in the database.
- Refresh tokens for work/school accounts stay valid for 90 days of inactivity by default
  (Conditional Access policies can shorten this); the Trust Center refreshes only when an
  administrator uses the picker, so a long-unused connection may need to be reconnected.
- If you rotate `ENCRYPTION_KEY`, stored tokens become unreadable and the integration must be
  reconnected.
- Connecting and disconnecting, and every import, are written to the audit log.

## Disconnecting and revoking

- **Disconnect** on the Integrations page deletes the stored tokens. The Microsoft identity
  platform has no token-revocation endpoint for this flow, so there is nothing further the server
  can call; the tokens simply expire.
- To revoke on the Microsoft side: a user can remove the app under
  [myaccount.microsoft.com → Privacy → App access](https://myaccount.microsoft.com/) (personal
  accounts: account.live.com/consent/Manage), and a tenant administrator can delete the app's
  service principal or revoke sessions in Entra (*Enterprise applications → Trust Center →
  Permissions / Users and groups*). The application will then report *The connection to OneDrive has
  expired or was revoked*; disconnect and reconnect.
- Documents you imported remain after disconnecting; they are copies.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| **AADSTS50011** "The redirect URI … does not match the redirect URIs configured" | The URI registered under *Authentication → Web* differs from `${APP_URL}/api/integrations/microsoft/callback`. Compare scheme, host, port and path exactly; `APP_URL` must not have a trailing slash and the platform must be *Web* (not SPA). |
| **AADSTS65001** / "Need admin approval" | User consent is disabled in the tenant. Have a Global/Application administrator click *Grant admin consent* on the app's *API permissions* page, or approve the prompt when connecting. |
| **AADSTS7000215** "Invalid client secret provided" | `MICROSOFT_CLIENT_SECRET` is wrong — you probably copied the secret *ID* instead of its *Value*, or the secret has **expired**. Create a new secret, update the environment, restart and reconnect. |
| **AADSTS700016** "Application … was not found in the directory" | `MICROSOFT_CLIENT_ID` is wrong, or `MICROSOFT_TENANT` points to a tenant that does not contain the app (single-tenant apps must use their own tenant ID, not `common`). |
| **AADSTS50020** "User account from identity provider does not exist in tenant" | A personal account tried to sign in to a single-tenant (organisation-only) app, or vice versa. Change *Supported account types* or `MICROSOFT_TENANT`. |
| Admin shows "The sign-in could not be verified" | The `state` did not match: the 10-minute window passed, the callback was opened in another browser, or cookies for `APP_URL` are blocked. Start again from the Integrations page. |
| "The connection to OneDrive has expired or was revoked" | The refresh token expired (90 days without use), was revoked, or the client secret changed. Disconnect and connect again. |
| Picker is empty or missing files | Only the connected user's own OneDrive (`/me/drive`) is browsed. Files in SharePoint document libraries or other users' drives are not shown; share them to the connected account's OneDrive or connect a different account. Search looks at file names. |
| Import fails with "larger than the … MB upload limit" | Raise `MAX_UPLOAD_MB`. |
| Import fails with "This file type is not supported" | The content failed the magic-byte allow-list (PDF, Office, OpenDocument, PNG/JPEG/WebP/SVG, TXT/MD/CSV, ZIP). OneNote notebooks cannot be imported. |

## Automated testing without Microsoft

`tests/mocks/oauth-mock-server.ts` implements the same endpoints locally. Point the application at
it with `MICROSOFT_OAUTH_BASE_URL` and `MICROSOFT_GRAPH_BASE_URL` (test-only variables; leave them
unset in production). See the comment at the top of that file for the supported switches.
