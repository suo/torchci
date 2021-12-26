## Getting Started

1. Install [`yarn`](https://yarnpkg.com/getting-started/install), which we
   use for package and project management.
2. Install the required dependencies for the project:

```bash
yarn install
```

3. You will need a Rockset API key. You can generate one from the [Rockset
   console](https://console.rockset.com/apikeys) (if you don't have an Rockset account,
   talk to @suo).
4. Add the API key to your `.env.local`:

```bash
echo 'ROCKSET_API_KEY=<your-api-key>' >> .env.local
```

5. Run the development server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the
result! Any edits you make to the code will be reflected immediately in the
browser.

We use Next.js as our framework. To learn more about Next.js, take a look at the
following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deployment

We use [Vercel](https://vercel.com/torchci) as our deployment platform. Pushes
to `main` and any other branches will automatically be deployed to Vercel; check out
the bot comments for how to view.
