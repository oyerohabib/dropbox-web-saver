# Security Policy

## Supported versions

Only the latest release of Web Saver for Dropbox receives security fixes.

## Reporting a vulnerability

Please don't report security problems in public GitHub issues, discussions, or pull requests.

Report them privately in one of these ways:

- **GitHub private vulnerability reporting**: on the repository's **Security** tab, click **Report a vulnerability** ([direct link](https://github.com/oyerohabib/dropbox-web-saver/security/advisories/new)).
- **Email**: oyerohabib@yahoo.com, with "Security" in the subject.

Include what you found, steps to reproduce, the extension version and browser, and the impact you expect. You should get a reply within 7 days. Once a fix is released, you're welcome to be credited in the release notes.

## Scope

Examples of issues worth reporting:

- Ways a web page could read or misuse the Dropbox app key or tokens stored by the extension
- Ways a web page could trigger saves, uploads, or Dropbox API calls without the user's action
- Data being sent anywhere other than Dropbox or the website hosting the file being saved

Problems in Dropbox's own services should be reported to [Dropbox's bug bounty program](https://hackerone.com/dropbox) instead.

## Handling credentials

Never include a real Dropbox app key, app secret, or access token in a report. If you think one has been exposed, revoke it at [dropbox.com/account/connected_apps](https://www.dropbox.com/account/connected_apps) or regenerate it in the [Dropbox App Console](https://www.dropbox.com/developers/apps).
