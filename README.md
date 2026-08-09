# Veggie Signal

Simple app that lets you see the veggies guy location and you can raise your hand to signal that you need veggies  and the closet one will deliver what you need simple app no pictures of veggies just icons off fruits and vegetables using open source map and Capitec smart scanner pay you as seller needs only upload your profile picture have a smartphone

 When get the button please wave so I can see button for the runner

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/40a20a32-1841-46a3-b340-322bc411f696).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Deployment

A GitHub Actions pipeline deploys the app to Netlify automatically on every push to `main`.

1. Connect this project to GitHub from the Lovable editor (**+ → GitHub → Connect project**).
2. Create a site in Netlify and copy its **Site ID**.
3. Create a [Netlify personal access token](https://app.netlify.com/user/applications/personal).
4. In your GitHub repository, add two secrets under **Settings → Secrets and variables → Actions**:
   - `NETLIFY_AUTH_TOKEN` — your Netlify personal access token
   - `NETLIFY_SITE_ID` — your Netlify site ID
5. Push to `main` (or merge a PR). The workflow in `.github/workflows/deploy.yml` will build the app with the Netlify preset and deploy it.

## Development

Prefer working locally? You need Bun (or Node.js and npm) — [install Bun](https://bun.sh/docs/installation).

```sh
git clone <this-repository-url>
cd <repository-name>
bun i
bun run dev
```
