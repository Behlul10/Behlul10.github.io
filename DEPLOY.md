# Publish on GitHub Pages

This is a static site: no build command or server is required.

1. Commit and push the site and the included `.github/workflows/deploy-pages.yml` workflow to GitHub.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. The deployment workflow runs whenever changes are pushed to `main`. After it completes, GitHub shows the published URL in the workflow summary and on the Pages settings screen.

The workflow is necessary because GitHub Pages' branch-based mode can publish only the repository root or `/docs`, while this site intentionally lives in `portfolio_2`.

## Connect a Hostinger domain

1. In **Settings → Pages**, enter the custom domain and save. GitHub will tell you the DNS records it expects.
2. In Hostinger’s DNS Zone Editor, add GitHub Pages’ recommended records for your domain type. For a root domain, GitHub currently uses four `A` records; for a `www` subdomain, use a `CNAME` record pointing to your GitHub Pages address.
3. Wait for GitHub to verify the DNS, then enable **Enforce HTTPS**.

Do not add a `CNAME` file until you have decided the exact domain name. Once you have it, create a file named `CNAME` inside `portfolio_2` containing only that domain (for example, `www.example.com`).
