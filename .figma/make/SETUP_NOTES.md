# Initial import setup

## Bootstrap

`figma make verify-bootstrap` succeeds with the Bun install script and the
supervised Vite development server.

## Deployment blocker

This repository is a TanStack Start application that builds a Nitro
Cloudflare runtime and uses server functions, server middleware, and server-only
environment variables throughout its core flows.

Figma Make deployment currently accepts only the `static` and
`aws/lambda/nextjs` adapters. Neither can serve this repository's generated
Cloudflare/Nitro runtime:

- Deploy-preview was explicitly skipped with
  `figma make verify-deploy-preview --skip`.
- A static deployment of `.output/public` would omit the server runtime and
  break authentication, data access, API hooks, and booking operations.
- The Next.js adapter is not applicable to this TanStack Start build.

No `.figma/make/deploy` script was generated because it would describe an
invalid production deployment. Completing Figma deployment requires either a
supported TanStack/Nitro runtime adapter or an application migration to a
supported runtime, which is outside setup-only initial import work.
