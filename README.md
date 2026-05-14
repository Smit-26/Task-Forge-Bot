# Kite Task Bot 🤖

A Discord bot for managing Kite tasks — posts announcements, lets users claim tasks, and sends them a private ticket to submit proof.

---

## How it works

```
Admin runs /posttask  →  Bot posts announcement embed with [Claim Task] button
                               ↓
User clicks Claim      →  Bot creates a private thread (ticket) for that user only
                               ↓
User completes task    →  User clicks [Submit Proof], fills in the modal
                               ↓
Proof logged           →  Sent to your review channel for admin to approve & pay credits
```

---

## Setup (step by step)

### Step 1 — Create the bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. "Kite Task Bot")
3. Go to **Bot** tab → click **Add Bot**
4. Under **Token** click **Reset Token** and copy it → paste into `.env` as `DISCORD_TOKEN`
5. Under **Privileged Gateway Intents**, enable:
   - ✅ Message Content Intent
   - ✅ Server Members Intent

### Step 2 — Invite the bot to your server

1. Go to **OAuth2 → URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Create Private Threads
   - ✅ Manage Threads
   - ✅ Read Message History
   - ✅ Embed Links
4. Copy the generated URL and open it in your browser to invite the bot

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:
- `DISCORD_TOKEN` — your bot token from Step 1
- `CLIENT_ID` — your Application ID (on the General Information page)
- `GUILD_ID` — right-click your server icon → Copy Server ID (enable Developer Mode in Discord settings first)
- `PROOF_LOG_CHANNEL_ID` — optional channel ID where proof submissions are logged

### Step 4 — Install & run

```bash
npm install

# Register slash commands (run once, or when you change commands)
node deploy-commands.js

# Start the bot
node index.js
```

---

## Usage

### Posting a task (admins only)

In any channel, type:

```
/posttask type:Reddit Comment giver:Avacado credits:0.15 deadline:120 link:https://reddit.com/...
```

The bot posts an embed like:
```
📢 NEW TASK AVAILABLE
📝 Task Type: Reddit Comment
👤 Task Giver: Avacado
💰 Credits: 0.15
⏰ Deadline: 120 Minutes
🔗 Task Link: https://reddit.com/...

[✅ Claim Task]  [⏭ Skip]
```

### Claiming a task (users)

User clicks **✅ Claim Task** → bot creates a private thread only they can see:

```
🎫 Your Task Ticket
Hey @user, you claimed a task!
...task details...

[📸 Submit Proof]  [❌ Abandon Task]
```

### Submitting proof

User clicks **📸 Submit Proof** → a modal pops up asking for their proof (screenshot link, description, etc.). On submit:
- The ticket thread shows a confirmation embed
- If `PROOF_LOG_CHANNEL_ID` is set, an admin review embed is posted there

---

## File structure

```
kite-task-bot/
├── index.js            ← Main bot (events, buttons, modals)
├── deploy-commands.js  ← Run once to register /posttask slash command
├── .env.example        ← Copy to .env and fill in values
├── .env                ← Your secrets (never commit this!)
└── package.json
```

---

## Tips

- The bot falls back to **DM** if it can't create a private thread (e.g. missing permissions)
- Tasks are stored in memory — restart = tasks reset. For persistence, swap the `Map` in `index.js` for a JSON file or a database like SQLite
- To auto-post tasks from an external source (e.g. your Kite API), call the same posting logic from a polling interval in `index.js`
