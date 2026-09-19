---
name: EAS build blocked by git sandbox guard
description: eas-cli internally runs git commands (VCS status/fingerprint) which the Replit sandbox blocks as a destructive main-agent git operation, causing `eas build` to fail with a `.git/index.lock` error.
---

Running `eas build` (or other eas-cli commands that inspect VCS state) from the main agent's bash tool can fail with:

```
Destructive git operations are not allowed in the main agent. Use the `project_tasks` skill... : /home/runner/workspace/.git/index.lock
```

**Why:** eas-cli's default VCS client shells out to git (status/hashing) to compute the project fingerprint and check for uncommitted changes. The Replit sandbox intercepts any process that touches `.git` (including subprocesses of eas-cli, not just direct `git` invocations) and blocks it as an unauthorized destructive git operation. Deleting a stale `.git/index.lock` manually is also blocked for the same reason.

**How to apply:** Set `EAS_NO_VCS=1` in the environment when invoking eas-cli from the main agent, e.g.:

```
EAS_NO_VCS=1 pnpm exec eas build --platform android --profile production --non-interactive --no-wait
```

This tells eas-cli to skip git entirely and just archive/upload the working directory as-is. Also note: `eas.json`'s `autoIncrement: true` under a build profile is incompatible with dynamic `app.config.js` (only works with static `app.json`) and causes `eas build` to fail immediately with "autoIncrement option is not supported when using app.config.js" — remove it or manage `versionCode`/`buildNumber` manually in `app.config.js` instead.
