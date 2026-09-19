---
name: Web Preview Loading Fallback
description: Environment-specific guardrails for CaddyCheck's Expo web preview
---

Expo web preview may remain blank or spin indefinitely when font loading or AsyncStorage initialization does not resolve promptly, even when Metro reports a successful bundle and no browser exception.

**Why:** The preview environment can leave asynchronous startup work pending, making a healthy mobile app appear broken and hiding the actual screens.

**How to apply:** Never gate the root layout on web font loading; render immediately with platform fonts and let Inter apply when ready. Keep a bounded onboarding-storage fallback that defaults to onboarding if the read stalls.