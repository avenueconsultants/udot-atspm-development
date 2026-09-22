This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Updating API clients

After changing an API controller, request/response model, or OpenAPI configuration,
run this command from `Atspm/WebUI`:

```bash
npm run sync:api
```

Install the WebUI dependencies with `npm ci` first. The command also needs a .NET
SDK that can build the APIs' `net8.0` projects and the .NET 8 runtime for export.
It restores the pinned Swagger CLI, builds ConfigApi, ReportApi, DataApi, and
IdentityApi in Debug, exports their specifications, then runs Orval for all five
clients. Speed Management uses the existing `api-specs/speed-spec.json` because
its backend is maintained separately.

Export runs in Development with in-memory database settings, migrations disabled,
and configuration dumping suppressed. A running API or database is not required.
The command stops on restore, build, export, or client-generation failure. All four
backend exports must succeed before the saved specifications are replaced. An
Orval failure can leave updated specs or partial generated client changes; fix the
error and rerun the command before committing.

Review and commit the API projects' `*-spec.json` files and `src/api` together.
Ordinary .NET builds no longer export specifications automatically.

`npm run generate:api` remains available to regenerate only the frontend clients
from saved specs. `npm run check:api` checks those clients against the committed
specs; it does not rebuild the backend.

To export just one API without regenerating clients, restore tools from `Atspm`
with `dotnet tool restore`, then run from that API's project directory:

```bash
dotnet msbuild -restore -target:ExportSwaggerSpec
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
