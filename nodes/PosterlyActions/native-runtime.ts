export interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean;
  description?: string;
}

export interface NativeAction {
  key: string;
  tool: string;
  mode: string;
  label: string;
  group: string;
  description: string;
  confirmation: string;
  readOnly: boolean;
  retryKey: boolean;
  fixed: Record<string, unknown>;
  schema: Schema;
}

function invalidJson(key: string): never {
  throw new Error(`${key} must contain valid JSON.`);
}

function accepts(value: unknown, schema: Schema, path: string): void {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (value === null && types.includes('null')) return;
  const kind = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (schema.type && !types.includes(kind) && !(kind === 'number' && types.includes('integer') && Number.isInteger(value))) {
    throw new Error(`${path} must be ${types.join(' or ')}.`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} is not an allowed value.`);
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) throw new Error(`${path} must be ${String(schema.const)}.`);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} must be finite.`);
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}.`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new Error(`${path} is too short.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new Error(`${path} is too long.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${path} needs more items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${path} has too many items.`);
    if (schema.items) value.forEach((item, i) => accepts(item, schema.items!, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (object[key] === undefined) throw new Error(`${path}.${key} is required.`);
    for (const [key, item] of Object.entries(object)) {
      if (schema.additionalProperties === false && !Object.prototype.hasOwnProperty.call(schema.properties ?? {}, key)) throw new Error(`${path}.${key} is not accepted.`);
      if (schema.properties?.[key]) accepts(item, schema.properties[key], `${path}.${key}`);
    }
  }
}

/** Only fields belonging to the selected operation can cross the boundary. */
export function actionArguments(action: NativeAction, input: Record<string, unknown>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'native_approval' || key === 'native_idempotency_key' || value === undefined) continue;
    const schema = Object.prototype.hasOwnProperty.call(action.schema.properties ?? {}, key) ? action.schema.properties![key] : undefined;
    if (!schema) throw new Error(`${key} is not accepted by ${action.label}.`);
    let parsed = value;
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (typeof value === 'string' && (types.includes('object') || types.includes('array'))) {
      try { parsed = JSON.parse(value); } catch { invalidJson(key); }
    } else if (typeof value === 'string' && (types.includes('number') || types.includes('integer'))) {
      parsed = value.trim() ? Number(value) : value;
    } else if (typeof value === 'string' && types.includes('boolean') && (value === 'true' || value === 'false')) {
      parsed = value === 'true';
    }
    args[key] = parsed;
  }
  const preview = action.confirmation === 'preview' && args.confirm !== true;
  if (!action.readOnly && !preview && input.native_approval !== true && args.confirm !== true) {
    throw new Error('Approve this operation and its side effects before running it.');
  }
  if (action.retryKey && (typeof input.native_idempotency_key !== 'string' || !input.native_idempotency_key.trim())) {
    throw new Error('A stable idempotency key is required for creating posts. Reuse it only for retries of the same request.');
  }
  accepts(args, action.schema, action.label);
  return { ...args, ...action.fixed };
}

export function actionRequest(action: NativeAction, input: Record<string, unknown>) {
  return {
    jsonrpc: '2.0', id: action.key, method: 'posterly/native-call',
    params: { name: action.tool, arguments: actionArguments(action, input) },
  };
}

export function actionOutput(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== 'object') throw new Error('Invalid response from posterly.');
  const envelope = response as Record<string, unknown>;
  if (envelope.error) {
    const error = envelope.error as { message?: string };
    throw new Error(error.message ?? 'posterly request failed.');
  }
  const result = envelope.result as { isError?: boolean; content?: { text?: string }[]; structuredContent?: Record<string, unknown> } | undefined;
  if (!result) throw new Error('Missing result from posterly.');
  const text = (result.content ?? []).map(item => item.text ?? '').join('\n');
  if (result.isError) throw new Error(text || 'posterly operation failed.');
  const structured = result.structuredContent;
  if (!structured) throw new Error('This server does not yet support structured native results. Deploy the matching server version first.');
  const data = structured.data;
  const record = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
  return { data: data ?? {}, text, ...(!Object.prototype.hasOwnProperty.call(structured, 'data') ? structured : {}),
    ...(record.preview_id ? { preview_id: record.preview_id } : {}),
    ...(record.requires_confirmation !== undefined ? { requires_confirmation: record.requires_confirmation } : {}) };
}
