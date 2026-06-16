# Environment Changes

Apply these rules before changing or working around local environment configuration.

## User Approval Required

Stop and ask the user for approval before making changes or applying workarounds related to the local development environment, including but not limited to:

- Switching Node.js, npm, pnpm, or other toolchain versions.
- Modifying `PATH`, shell profiles, environment variables, registry mirrors, or package manager configuration.
- Installing, upgrading, downgrading, or removing global tools or dependencies.
- Using an alternate executable path to bypass the currently active environment.
- Changing local Claude, editor, terminal, or OS-level project configuration.

If verification is blocked by an environment mismatch, report the mismatch and ask before proceeding with any workaround.
