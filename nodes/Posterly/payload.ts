export function scheduleDate(value: string, now = Date.now()): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now) {
    throw new Error('Scheduled time must be a future ISO date-time with a timezone offset.');
  }
  return new Date(value).toISOString();
}

export function postPayload(input: Record<string, unknown>, now = Date.now()): Record<string, unknown> {
  const settings = input.settingsJson ? JSON.parse(String(input.settingsJson)) : undefined;
  if (input.settingsJson && (settings === null || typeof settings !== 'object' || Array.isArray(settings))) throw new Error('Platform settings must be a JSON object.');
  return {
    account_id: input.accountId,
    caption: input.caption,
    scheduled_at: scheduleDate(String(input.scheduledAt), now),
    ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
    ...(input.mediaUrl ? { media_url: input.mediaUrl } : {}),
    ...(input.postType ? { post_type: input.postType } : {}),
    ...(settings ? { settings } : {}),
  };
}

export function approvedPost(input: Record<string, unknown>): Record<string, unknown> {
  if (input.confirm !== true) throw new Error('Approve the account, caption, media, and schedule before enabling this operation.');
  if (!input.idempotencyKey) throw new Error('A stable idempotency key is required.');
  return postPayload(input);
}
