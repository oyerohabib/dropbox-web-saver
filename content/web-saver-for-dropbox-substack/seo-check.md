## SEO Validation Report: Stop Downloading Just to Upload: Save Web Files Straight to Dropbox

**File**: `content/web-saver-for-dropbox-substack/web-saver-for-dropbox.md`  
**Meta**: `content/web-saver-for-dropbox-substack/meta.md`  
**Date**: 2026-10-19  
**Context**: Owned Substack marketing post (single post; not a multi-post site)  
**Primary keywords**: `save images to Dropbox`; `save web files to Dropbox without downloading`  
**CTA**: Chrome Web Store URL (frontmatter `cta_url`)

### Summary
- **Score**: 7 PASS · 2 WARN · 0 FAIL (of 9 checklist items)
- **Status**: NEEDS FIXES (publish-time only) — content is publish-ready; remaining items are Substack platform defaults

### Detailed Results

| # | Check | Status | Details | Fix |
|---|-------|--------|---------|-----|
| 1 | Title Tag | PASS | **67 chars.** Clear benefit + product outcome. Includes “Save Web Files Straight to Dropbox.” Slightly over the ~60-char soft preview cut; critical meaning survives truncation. Unique for this product pitch. | Optional: shorten to ≤60 if Substack preview truncates awkwardly (e.g. drop “Just to Upload:”). Not required. |
| 2 | Meta Description Length | PASS | **157 chars** (after safe edit). Within ~150–160 sweet spot. Leads with the pain loop, then both primary keywords, then free/MIT + keys-in-browser. Matches visible claims. Synced in frontmatter + `meta.md`. | Paste the same string into Substack’s SEO/description field at publish. |
| 3 | H1 | PASS | Single H1, identical to title. No competing H1s. | — |
| 4 | Heading Hierarchy | PASS | Clean tree (no skips). See hierarchy below. H2s label real topic boundaries; FAQ H3s are question-form (intent-fit). | — |
| 5 | Keyword Placement | PASS | After micro-edits: both primary phrases appear in meta description; `save web files to Dropbox without downloading` in body (Community section); `save images to Dropbox` in “Who should install.” Title/H1 carry close variant “Save Web Files Straight to Dropbox.” | Optional later: first body paragraph could echo one phrase once more; not needed for ship. |
| 6 | CTAs | PASS | Primary CWS URL in frontmatter (`cta_url`). Body CTAs: intro product link, TL;DR Install, mid-article install, “Who should install,” closing CTA pair. Anchors are descriptive (not “click here”). GitHub secondary CTA present. | At publish, keep Substack “button” CTA pointing at the same CWS URL. |
| 7 | Alt Text | PASS | Hero `./hero.png` has descriptive alt: “Browser extension saving a web image directly into a Dropbox folder, skipping the local download step.” No other content images. | When uploading to Substack, paste the same alt into the image accessibility field. |
| 8 | Link Quality | WARN | **External (tier 1–3 OK):** Dropbox IR, Dropbox fact sheet, Dropbox Community, TeamViewer research PDF, Lucid survey, Atlassian State of Teams PDF, Georgia Tech/USENIX coverage, Pew Research. Reddit r/dropbox = tier ~3 (UGC); acceptable for “people complain about friction” support. GitHub + CWS are product destinations. **Duplicates (intentional marketing):** CWS ×5, GitHub ×4 in body — fine for conversion, not ideal for classic SEO link hygiene. **Internal links:** N/A (single owned marketing post; no site graph). **Broken-link live check:** not run here; use `scripts/blog_preflight.py` Gate 5 via orchestrator if needed. | No content change required. If you want stricter SEO hygiene later, keep 2–3 CWS links (intro + mid + close) and one GitHub. |
| 9 | Schema / Canonical / Social (Substack) | WARN | **Canonical in draft** points at CWS (`canonical` = store URL). Correct as *product CTA*, **incorrect** as the Substack article’s self-canonical once live. **OG / Twitter:** not in markdown (expected); Substack generates `og:*` / Twitter cards from title, subtitle, and hero. **JSON-LD:** do not hand-paste FAQPage into Substack; platform Article markup is enough. FAQPage no longer drives Google FAQ rich results (post–2026-05-07). | On publish: let Substack own the post URL as canonical; do **not** force-canonical to CWS. Set subtitle + hero for social. Author name already supports Person entity via Substack profile. |

### Heading Hierarchy Tree

```
H1 Stop Downloading Just to Upload: Save Web Files Straight to Dropbox
├─ H2 The download-then-upload tax is real
├─ H2 What Web Saver for Dropbox actually does
│  ├─ H3 Features that matter in daily use
│  └─ H3 Hybrid upload, said plainly
├─ H2 Pros and cons (no theater)
├─ H2 How it compares: manual, MultCloud, SaveAnywhere
├─ H2 The setup is the privacy product
├─ H2 Who should install it today
├─ H2 FAQ
│  ├─ H3 Do I need a paid Dropbox plan?
│  ├─ H3 Why can’t the extension just “sign in with Dropbox” without an app key?
│  ├─ H3 Will it save any video I see on a page?
│  └─ H3 Is this an official Dropbox product?
└─ H2 Stop paying the layover tax
```

### Character Counts (post-edit)

| Element | Chars | Guidance |
|---------|-------|----------|
| Title / H1 | 67 | Soft ideal ≤60; hard fail only if truncated into nonsense — **PASS** |
| Meta description | 157 | Target ~150–160 — **PASS** |
| Slug (`meta.md`) | `web-saver-for-dropbox` | Keyword-ish, lowercase, no dates — **PASS** (URL Structure) |
| Subtitle (`meta.md`) | supporting line for Substack | Complements title; good for social/deck |

### URL Structure (slug)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Keyword / topic clarity | PASS | `web-saver-for-dropbox` |
| No dates | PASS | — |
| Lowercase / hyphens | PASS | — |
| Short | PASS | 4 tokens |

### Schema Notes for Substack (reference)

| Item | Guidance |
|------|----------|
| Article / BlogPosting | Rely on Substack’s default article schema |
| FAQPage JSON-LD | **Do not add** for rich-result chasing; keep FAQ as visible H2/H3 copy only |
| Product / SoftwareApplication | Optional only if you later publish a dedicated product page; not required in this essay |
| Canonical | Self-URL of the Substack post after publish |
| `og:type` | Substack sets article-equivalent social tags |
| `twitter:card` | Expect `summary_large_image` when hero is set |

### Edits Applied (safe, small)

1. **Meta description** (frontmatter + `meta.md`): inserted exact primary keywords; length **153 → 157**.
2. **Body**: Community sentence now uses `save web files to Dropbox without downloading`.
3. **Body**: “Who should install” bullet now uses `Save images to Dropbox`.
4. **Not changed**: title, H1, structure, CTAs, alt text, argumentative body.

### Priority Fixes (publish-time)

1. **Canonical**: Use the live Substack post URL — do not set article canonical to the Chrome Web Store.
2. **Paste meta**: Copy the 157-char description into Substack’s SEO/description field; confirm subtitle + hero for OG/Twitter.
3. **Optional**: If SERP title truncates, shorten title to ≤60 chars without dropping “Dropbox” or “Save Web Files.”

### Notes

- Treated as a **standalone marketing post**: internal-link count and bidirectional site checks are **N/A**.
- Affiliate/sponsored `rel` attributes: none needed (self-authored product + third-party research cites).
- Competitor mentions (MultCloud, SaveAnywhere) are comparison context with no outbound competitor product links — good.
