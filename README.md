# Helppy

Helppy is a real-time messaging platform (a Discord/Slack-style chat app). This repository contains a working **MVP foundation** you can run locally or deploy, and then extend toward the larger feature set.

**Stack:** React (Vite) + Tailwind on the frontend, Node.js + Express + Socket.IO on the backend, PostgreSQL via Prisma, packaged with Docker.

**What works today**

- Accounts: register, login, logout, JWT sessions, session/device list (2FA-ready hooks)
- Direct messages and group chats
- Servers/communities with text channels and invite links
- Real-time messaging, typing indicators, read receipts (Socket.IO)
- Threads, emoji reactions, edit / delete / pin
- Markdown + fenced code blocks in messages
- Message search within a channel
- Roles (owner, admin, moderator, member) and moderation: kick, ban, timeout, mute, channel slowmode

---

# A. Setup & Hosting

This section takes you from zero to a running app.

## A.1 Prerequisites

Install these first:

- **Git**
- **Docker** and **Docker Compose** (easiest path) — https://docs.docker.com/get-docker/
- *Optional, for non-Docker development:* **Node.js 20+** and a local **PostgreSQL 16** instance

## A.2 Get the code

```bash
git clone https://gitlab.com/hell7361225/helppy.git
cd helppy
```

## A.3 Configure environment variables

The app uses two `.env` files. Copy the provided examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env`:

| Variable        | Description                                        | Example |
|-----------------|----------------------------------------------------|---------|
| `DATABASE_URL`  | PostgreSQL connection string used by Prisma        | `postgresql://helppy:helppy@localhost:5432/helppy?schema=public` |
| `JWT_SECRET`    | Secret for signing JWTs — use a long random string | `openssl rand -hex 32` |
| `PORT`          | Port the API listens on                            | `4000` |
| `CLIENT_ORIGIN` | Your frontend URL (for CORS)                       | `http://localhost:5173` |

Edit `client/.env`:

| Variable       | Description               | Example |
|----------------|---------------------------|---------|
| `VITE_API_URL` | Base URL of the API server | `http://localhost:4000` |

Generate a strong secret:

```bash
openssl rand -hex 32
```

## A.4 Run locally with Docker (recommended)

From the repo root, one command brings up Postgres, the API, and the frontend:

```bash
docker compose up --build
```

The `server` container automatically runs `prisma migrate deploy` on startup, so the database schema is created for you.

Then open:

- Frontend: **http://localhost:5173**
- API health check: **http://localhost:4000/health**

Stop everything with `Ctrl+C`, or run in the background with `docker compose up -d`.

## A.5 Run without Docker (for development)

Use this if you want hot-reload while coding.

**1. Start PostgreSQL** (any local install or a quick Docker container):

```bash
docker run --name helppy-db -e POSTGRES_USER=helppy -e POSTGRES_PASSWORD=helppy -e POSTGRES_DB=helppy -p 5432:5432 -d postgres:16-alpine
```

**2. Backend:**

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy   # apply the schema (use `npm run migrate` to create new migrations during dev)
npm run dev                 # starts API on http://localhost:4000
```

**3. Frontend (new terminal):**

```bash
cd client
npm install
npm run dev                 # starts Vite on http://localhost:5173
```

## A.6 Database migrations

- Apply existing migrations: `npx prisma migrate deploy`
- Create a new migration after editing `server/prisma/schema.prisma`: `npm run migrate`
- Inspect data visually: `npx prisma studio`

## A.7 Deployment

### Option 1 — Docker on a Linux VPS

1. Provision a VPS (Ubuntu recommended) and install Docker + Docker Compose.
2. Clone the repo on the server and create your `.env` files as in A.3. For production set:
   - A strong unique `JWT_SECRET`
   - `CLIENT_ORIGIN` to your real domain (e.g. `https://chat.example.com`)
   - `VITE_API_URL` to your API's public URL (e.g. `https://api.example.com`)
3. Build and start in the background:

   ```bash
   docker compose up --build -d
   ```
4. Put a reverse proxy (Nginx or Caddy) in front to add HTTPS and route your domain to ports `5173` (client) and `4000` (API). Caddy example:

   ```
   chat.example.com { reverse_proxy localhost:5173 }
   api.example.com  { reverse_proxy localhost:4000 }
   ```
5. Use a managed/persistent Postgres or keep the bundled `db` service (data persists in the `db_data` Docker volume). Back it up regularly.

### Option 2 — Render or Railway (managed platform)

These platforms host the services and give you a managed PostgreSQL database.

1. **Create a PostgreSQL database** in Render/Railway and copy its connection string.
2. **Deploy the API** (`/server`):
   - New Web Service from this repo, root directory `server`.
   - Build command: `npm install && npx prisma generate`
   - Start command: `npx prisma migrate deploy && node src/index.js`
   - Env vars: `DATABASE_URL` (from step 1), `JWT_SECRET`, `PORT` (use the platform's provided port var), `CLIENT_ORIGIN` (your frontend URL).
3. **Deploy the frontend** (`/client`):
   - New Static Site / Web Service, root directory `client`.
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Env var: `VITE_API_URL` set to your deployed API URL.
4. Update the API's `CLIENT_ORIGIN` to the deployed frontend URL and redeploy so CORS and Socket.IO accept it.

---

# B. Usage

How to use Helppy once it's running.

## B.1 Create an account

1. Open the app (http://localhost:5173 locally).
2. Click **Register**, enter a username, email, and password (min 8 characters), and submit. You're logged in automatically.
3. Next time, use **Log in** with your username/email and password.

## B.1b Two-factor authentication (2FA)

1. Open **Settings (⚙️) > Security**.
2. Click **Set up 2FA**, scan the QR code with an authenticator app (Google Authenticator, Authy, etc.), or enter the secret manually.
3. Enter the 6-digit code and click **Enable**.
4. From then on, login asks for your **password and a current 2FA code**.
5. When you enable 2FA you're shown **10 one-time recovery codes** — save them. Each can be used once in place of an authenticator code if you lose your device.
6. To turn it off, enter a current code under Security and click **Disable**.

## B.1c Notifications

- In **Settings > Security**, click **Enable desktop notifications** to grant permission.
- New messages from others play a short **sound** and, when the tab is in the background, show a **desktop notification**.

## B.1d Pinned messages

- Click the 📌 button in any channel/DM header to see all **pinned messages** in a popover. (Pin a message from its hover menu.)

## B.2 Create a server and channels

1. In the left sidebar, click **+** next to *Servers* and enter a name. You become the server **owner**, and a default `#general` channel is created.
2. Admins and the owner can add more channels (via the channel API / UI controls).

## B.3 Invite people

1. Generate an invite for your server (creates a short code).
2. Share the code. A recipient joins by submitting it (`POST /api/servers/join/:code`), which adds them as a **member**.

## B.4 Send messages

1. Click a channel (e.g. `# general`) in the sidebar to open it.
2. Type in the message box and press **Send**. Messages appear in real time for everyone in the channel.
3. **Markdown** is supported, including fenced code blocks:
   ````
   ```js
   console.log('hello');
   ```
   ````
4. While you type, others see a **typing indicator**.

## B.4b Friends

- Open the **Friends** hub (the Helppy icon at the top of the server rail).
- **Add a friend** by typing their exact username and clicking *Send*.
- The other person sees the request under **Pending > Incoming** and can **Accept** or **Decline**.
- Once accepted, click **Message** next to a friend to open a DM.
- Set yourself **invisible** with the toggle in the bottom user bar; others then see you as offline.

## B.4c Message interactions

Hover over any message to reveal quick actions:

- **React** with an emoji (click again to remove). Reaction counts show under the message.
- **Pin** important messages.
- **Edit** or **Delete** your own messages.
- All of these update live for everyone in the channel/DM.
- In a channel, use the **🔍 search** button in the header to find messages by text.

## B.4d Voice & video calls (1:1)

In a direct message, the header shows **📞 voice** and **📹 video** call buttons:

1. Click one to call the other person. Your browser asks for mic/camera permission.
2. They get an **incoming call** overlay and can Accept or Decline.
3. Either side can **Hang up** to end the call.

During any call (1:1 or group), the control bar lets you **mute/unmute your mic**, **turn your camera on/off** (video calls), and **share your screen** (🖥️ — stops automatically when you end sharing from the browser). The end button leaves/hangs up the call.

> **Note on calls:** these use **WebRTC peer-to-peer** with a public STUN server. They work reliably on the same network or simple setups. For calls that cross different networks/NATs, and for group calls, you must add a **TURN server** and a media server (SFU such as LiveKit or mediasoup). See the Roadmap. The signaling for calls runs over the existing Socket.IO connection.

## B.4e Attachments, threads, profiles, receipts

- **Attach files/images:** click the 📎 button next to the message box. Images render inline; other files appear as a download link.
- **Threads:** hover a message and click 💬 to reply in a side thread. Messages with replies show a reply count you can click to reopen.
- **Profiles:** click anyone's name to see their profile card (banner, avatar, bio, presence) and start a DM.
- **Read receipts:** in a DM/group, a “✓ Seen by …” line shows who has read the latest message.

> **Note on uploads:** files are stored on the server's local disk under `/uploads` by default (good for a single server / development). For production or multi-instance hosting, switch to object storage (S3, GCS, etc.) and set `PUBLIC_URL` so links resolve correctly. The upload limit is 25MB (configurable in `server/src/routes/uploads.js`).

## B.4f Unread badges, history, and group calls

- **Unread badges:** channels with new messages show a red count and bold text in the sidebar; opening a channel clears it. Counts refresh automatically.
- **Message history:** scroll to the top of a channel/DM to load older messages (infinite scroll). “Beginning of conversation” shows when you reach the start.
- **Group calls:** in a **group conversation**, the header shows 📞 / 📹 buttons. Click one to join a group call; you'll see a grid of participants' video (or a mic icon for voice-only). Others who join the same group call connect automatically. Click **Leave call** to exit.

> **Note on group calls:** group calls use a **peer-to-peer mesh** (each participant connects directly to every other). This works for small calls (roughly up to 4-5 people) but degrades quickly beyond that because each client uploads its stream to everyone. For larger, reliable group calls you must route media through an **SFU** (LiveKit or mediasoup) and add a **TURN** server. The signaling layer (`group-call:*` socket events) is in place to build that on top of.

## B.4g Drafts and scheduled messages

- **Drafts:** anything you type in a channel/DM is **auto-saved** locally. If you switch away and come back (or reload), your unsent text is restored. Sending clears the draft.
- **Scheduled messages:** click the ⏰ button, pick a future date/time, and click **Schedule**. The server sends it automatically at that time and it appears live for everyone in the channel/DM. (The dispatcher checks every 15 seconds, so delivery is within ~15s of the chosen time.)
- **Manage scheduled messages:** click the 🗓️ button to see all your pending scheduled messages and **cancel** any of them.

## B.4h Polls

- Click the 📊 button to create a poll: enter a question, 2-10 options, and optionally allow multiple choices.
- The poll appears inline in the channel/DM. Click an option to vote; results (percentages and counts) update live, and your selection is highlighted.

## B.4i Voice notes, bookmarks, forwarding

- **Voice notes:** click the 🎤 button to start recording (browser asks for mic permission); click ⏹️ to stop and send. Voice notes appear as an inline audio player.
- **Bookmarks (saved messages):** hover a message and click 🔖 to save it. View all saved messages from the 🔖 button in the bottom user bar; remove them there.
- **Forwarding:** hover a message and click ↪️ to forward its contents into another conversation.

## B.8c Collapsible categories

Server admins can also **move a channel into a category** by hovering the channel in the sidebar and clicking the 🗂️ button.

- In a server, channels assigned to a category appear under a **collapsible category header** in the sidebar. Click the header to expand/collapse. Uncategorized channels are listed at the top.

## B.5 Direct messages and group chats

- Start a **DM** by creating a conversation with one other user.
- Add more than one user to create a **group chat** (give it a name).
- **Read receipts** track the last message each member has read.

## B.6 Threads, reactions, pins, editing

- **Reply in a thread** to keep side-discussions organized (a reply references its parent message).
- **React** with emoji; reacting again removes your reaction (toggle).
- **Pin** important messages.
- **Edit** or **delete** your own messages (deletes are soft-deletes, shown as `[deleted]`).

## B.7 Search

Within a channel, search messages by text to find past content quickly.

## B.8 Roles and moderation

Role hierarchy, highest to lowest: **Owner → Admin → Moderator → Member**. You can only moderate users ranked below you.

| Action       | Who can do it     | Effect |
|--------------|-------------------|--------|
| **Kick**     | Moderator+        | Removes a member from the server (they can rejoin with an invite) |
| **Ban**      | Moderator+        | Removes a member and records a ban |
| **Timeout**  | Moderator+        | Temporarily blocks participation until a set time |
| **Mute**     | Moderator+        | Blocks sending messages until a set time |
| **Slowmode** | Moderator+        | Sets a per-channel delay between messages |
| Create channels | Admin+         | Adds channels to the server |

The **owner** holds full control and outranks everyone.

## B.8b Categories and audit log

- **Categories:** server admins can create channel **categories** (🗂️ in the server header) to organize channels into groups. New channels can be placed in a category.
- **Audit log:** moderators and above can open the **📜 audit log** to review recent moderation actions (kick/ban/timeout/mute) with who did what, to whom, when, and why.

---

# Roadmap / Future Features

This is an **MVP foundation** intended to be extended. The architecture (modular Express routes, Prisma schema, Socket.IO events, React components) is built so larger features can be layered on incrementally. Planned future work, by category:

- **Voice & Video:** HD voice/video calls, screen sharing, stage events, recording, noise removal (WebRTC + a media server such as LiveKit/mediasoup)
- **AI Features:** assistants, moderation, translation, summaries, search, image/video generation
- **Advanced Messaging:** encryption/secret chats, self-destructing messages, polls, scheduled messages, voice notes, translation
- **Monetization & Creator tools:** memberships, paid communities, shops, donations, analytics
- **File system:** cloud storage, shared folders, version history, collaborative editing
- **Security:** end-to-end encryption, hardware keys, passkeys, full 2FA, login alerts, audit logs
- **Platform/Owner tooling:** global administration, discovery, analytics, feature flags

These are large, independent efforts — most warrant their own design and, in some cases, dedicated infrastructure. Build them one milestone at a time on top of this base.
