# @posterly/n8n-nodes-posterly

Connect n8n to [posterly](https://www.poster.ly) to validate and schedule social posts, list connected accounts, and inspect post status.

The community package is published on npm. n8n verification is in progress; it is not yet a verified node in n8n Cloud.

## Requirements

A posterly plan with API access, a connected social account, and a workspace-scoped API key with `accounts:read`, `posts:read`, and `posts:write`. Create the key in [API settings](https://www.poster.ly/dashboard/api). Store it in an n8n credential of type **Social Media API**. Never put a key into node parameters, workflow JSON, or source control.

Self-hosted n8n administrators can install `@posterly/n8n-nodes-posterly` through Settings > Community Nodes. n8n Cloud availability requires separate verification.

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

## Expanded draft 0.2.0

This source adds a separate posterly Actions node with 97 operations while preserving existing workflows using the original node. It is not the 0.1.1 package currently awaiting a walkthrough. Complete that video before replacing the submitted version. Deploy MCP 0.51.1 before releasing 0.2.0.

Choose an operation, then add its required Parameters and any optional fields you intend to send. Optional parameters are only sent when added, so an absent boolean never turns into an unintended false update. Complex objects and arrays accept JSON. Account, post, media, analytics, creative, engagement, administration and billing operations require the corresponding scopes and permissions on the configured key; do not grant additional access merely to make a test pass.

Mutations require approval. Preview operations can first run without confirmation, then return Preview ID. Only confirm with the same inputs and that ID after approving the preview. Creating posts requires a stable idempotency key. Unlike the original Schedule Post operation, Create a Post supports approved immediate publication when the date is omitted. Data preserves raw IDs, dates and pagination cursors; follow the returned cursors for complete lists. The Actions node can also be attached as an AI-agent tool, subject to the same permissions and approvals.

For product support, use [posterly support](https://www.poster.ly/dashboard/support).

## License

MIT, Grassroots Marketing LLC.
