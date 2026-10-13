# @posterly/n8n-nodes-posterly

Connect n8n to [posterly](https://www.poster.ly) to validate and schedule social posts, list connected accounts, and inspect post status.

This package is being prepared for its initial npm release and n8n verification. It is not yet a verified node in n8n Cloud.

## Requirements

A posterly plan with API access, a connected social account, and a workspace-scoped API key with `accounts:read`, `posts:read`, and `posts:write`. Create the key in [API settings](https://www.poster.ly/dashboard/api). Store it in an n8n credential of type **posterly API**. Never put a key into node parameters, workflow JSON, or source control.

After publication, self-hosted n8n administrators can install `@posterly/n8n-nodes-posterly` through Settings > Community Nodes. n8n Cloud availability requires separate verification.

## Operations

- **List Accounts**: discover connected social accounts.
- **List Posts**: filter by status and retrieve one page or all pages.
- **Get Post**: inspect a saved post by its ID.
- **Validate Post**: check a future post without creating or publishing it.
- **Schedule Post**: create a post with an explicitly approved future schedule.

Set Workspace ID if your key can access several workspaces and no default exists. Choose a social account, caption, optional HTTPS media URL, and a future scheduled time including its timezone. Add platform settings as a JSON object when required, such as a YouTube title or Pinterest board ID. Platform media and permission requirements still apply.

For scheduling, enable **Approve Scheduling** after approving the workflow's account, content, media, and schedule. Map a stable **Idempotency Key**, for example the source record ID plus its scheduled time. Reuse it on retries of the same post; use a different value for a different post. Missing approval, past dates, and missing retry keys are refused before a write.

Each output retains its corresponding input item. API errors fail the item unless n8n's Continue On Fail setting is enabled. Return All follows posterly's pagination cursor and rejects a cursor that does not advance.

## Development

```sh
npm ci
npm run build
npm run lint
npm test
npm run dev
```

Releases must run through `.github/workflows/publish.yml` with npm provenance. Configure a trusted npm publisher, or a package-scoped `NPM_TOKEN` for the initial release. Do not publish a local build for n8n verification.

Use an isolated, paused reviewer workspace for host tests. Test pagination, credential rejection, dry runs, retry deduplication, missing approval, and past-date rejection before submission. A successful build is not evidence of a live n8n execution.

For product support, use [posterly support](https://www.poster.ly/dashboard/support).

## License

MIT, Grassroots Marketing LLC.
