# Privacy and data handling

The static dashboard has no account system, advertising integration or application analytics tracker in its current source. This describes the application code, not the infrastructure providers' policies.

- The browser fetches archive JSON from the same host. Search and filtering happen in the browser; the application does not send search terms to an analytics service.
- Theme and card density preferences are stored in `localStorage`. Clearing site data removes them. Storage failures are tolerated.
- Google Fonts requests load Inter and JetBrains Mono. Google receives those network requests; the page uses fallback fonts if the service is unavailable.
- Vercel hosts the public deployment and may process request information such as IP address and user agent under its own policies. Running a local copy avoids requests to the hosted archive, but still requests Google Fonts while online.
- Following a source link visits that service, whose policies apply. GitHub issues and pull requests are public; do not submit private messages or personal information there.
- Optional fetch and ranking scripts contact external APIs from the machine where they run. Jev receives the archive text and public evidence being classified. Credentials are optional for browsing and must never be shipped to visitors.

Imported authors' public handles, quoted text, dates and source URLs are visible in the JSON as well as on cards. See [NOTICE.md](../NOTICE.md) for corrections and rights concerns.

## Optional Hermes Desktop plugin

The plugin opens the same public website in a frame, so the hosting, font and source-link
requests described above still apply. `hermes-archive:url` is a local Desktop preference
for a fork or local server. The wrapper does not send chat history, gateway credentials
or local files to the archive and does not register agent tools or a submission service.

Hermes loads desktop plugin code with the app's authority. The frame restrictions
apply to the displayed website, not to the plugin JavaScript itself. Review the plugin
before installing it, and only configure an archive host you trust. Files saved by the
installer are local; update/removal backups are retained for manual recovery.
