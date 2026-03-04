# MCP integration for Supabase CLI and Netlify CLI

This project is ready to work with local MCP servers that wrap the Supabase and Netlify CLIs. This file gives you templates you can plug into your MCP host (Claude Desktop, CLI host, etc.).

Nothing in this document should be committed with real secrets. Keep tokens and keys in your MCP host or OS keychain, not in Git.

## 1. Supabase CLI

### 1.1 Install globally

On your machine:

```bash
npm install -g supabase
supabase --version
```

### 1.2 Project usage

From the project root:

```bash
supabase status
supabase db push
```

You can also use the npm scripts added to package.json:

```bash
npm run supabase:status
npm run supabase:db-push
npm run supabase:db-reset
```

If you want a local Supabase stack, run:

```bash
supabase init
```

and follow the prompts. If you already have a hosted Supabase project, you can link:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 1.3 Supabase MCP server template

Example MCP server entry you can adapt in your MCP host config:

```jsonc
{
  "name": "supabase",
  "command": "supabase",
  "args": ["--help"],
  "env": {
    "SUPABASE_ACCESS_TOKEN": "your-personal-access-token",
    "SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
    "SUPABASE_DB_PASSWORD": "your-db-password"
  },
  "workingDirectory": "d:/TRAE/email-app"
}
```

Use the correct CLI invocation for your MCP host (some expect a wrapper script that exposes tools instead of calling `supabase` directly).

## 2. Netlify CLI

### 2.1 Install globally

On your machine:

```bash
npm install -g netlify-cli
netlify --version
netlify login
```

Then in this project:

```bash
netlify init      # or netlify link to connect an existing site
```

### 2.2 Project usage

From the project root:

```bash
npm run netlify:dev
npm run netlify:build
npm run netlify:deploy
```

You can still call the CLI directly:

```bash
netlify dev
netlify deploy
```

### 2.3 Netlify MCP server template

Example MCP server entry:

```jsonc
{
  "name": "netlify",
  "command": "netlify",
  "args": ["--help"],
  "env": {
    "NETLIFY_AUTH_TOKEN": "your-netlify-auth-token",
    "NETLIFY_SITE_ID": "your-site-id"
  },
  "workingDirectory": "d:/TRAE/email-app"
}
```

Generate `NETLIFY_AUTH_TOKEN` from your Netlify user settings, and keep it in your MCP host or system keychain instead of committing it.

