# Gent Flowers — automatic PL → EN translations

## One-time setup
1. Create a DeepL API key (DeepL API Free or Pro).
2. In GitHub open the repository `zeritdet/fl-ow-eerr` → Settings → Secrets and variables → Actions.
3. Choose **New repository secret**:
   - Name: `DEEPL_AUTH_KEY`
   - Secret: paste your DeepL API key
4. Save. No key is placed in the website or in public source files.

## How it works
- Save CMS content to `data/site.json` on `main`.
- GitHub Actions translates paired `pl`/`en` text fields with DeepL (Polish → British English).
- It commits the English text and `.translation-state.json`; Cloudflare Pages then deploys the update.
- Existing English text is kept on the initial setup.
- If an English field is manually changed after setup, that field becomes a manual override and will not be overwritten.
- To return a field to automatic translation, clear its English value and save. The workflow fills it again.
- Non-text values (prices, HEX, URLs, image paths) are not translated.

## Notes
- Translation runs after the CMS commit reaches GitHub, not inside the Page CMS editor while typing.
- GitHub Actions must be enabled for the repository.
- DeepL API usage may be subject to account limits/pricing.
