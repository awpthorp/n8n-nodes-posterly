import { NodeConnectionTypes, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type ILoadOptionsFunctions, type INodeExecutionData, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { approvedPost, postPayload } from './payload';

const API = 'https://www.poster.ly/api/v1';
export class Posterly implements INodeType {
  description: INodeTypeDescription = {
    // Use the canonical transparent brand asset; an SVG original is unavailable.
    displayName: 'posterly', name: 'posterly', icon: { light: 'file:posterly.png', dark: 'file:posterly.png' }, group: ['transform'], version: 1,
    subtitle: '={{$parameter["operation"]}}', description: 'Schedule approved social posts and inspect posterly accounts and posts',
    defaults: { name: 'posterly' }, inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main], usableAsTool: true,
    credentials: [{ name: 'posterlyApi', required: true }],
    properties: [
      { displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, default: 'listAccounts', options: [
        { name: 'Get Post', value: 'getPost', action: 'Get a post', description: 'Get one post by ID' },
        { name: 'List Accounts', value: 'listAccounts', action: 'List accounts', description: 'List connected social accounts' },
        { name: 'List Posts', value: 'listPosts', action: 'List posts', description: 'List posts with pagination' },
        { name: 'Schedule Post', value: 'schedulePost', action: 'Schedule a post', description: 'Schedule an approved post for a future time' },
        { name: 'Validate Post', value: 'validatePost', action: 'Validate a post', description: 'Validate without creating or publishing a post' },
      ] },
      { displayName: 'Workspace ID', name: 'workspaceId', type: 'string', default: '', description: 'Workspace to access. Use a scoped key or set this when your key has no default workspace.' },
      { displayName: 'Post ID', name: 'postId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getPost'] } } },
      { displayName: 'Social Account Name or ID', name: 'accountId', type: 'options', typeOptions: { loadOptionsMethod: 'getAccounts', loadOptionsDependsOn: ['workspaceId'] }, default: '', required: true, displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } }, description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>' },
      { displayName: 'Caption', name: 'caption', type: 'string', typeOptions: { rows: 4 }, default: '', required: true, displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } } },
      { displayName: 'Scheduled Time', name: 'scheduledAt', type: 'dateTime', default: '', required: true, displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } }, description: 'Future time including a timezone offset. Omitting a date never publishes immediately.' },
      { displayName: 'Media URL', name: 'mediaUrl', type: 'string', default: '', displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } }, description: 'Accessible HTTPS media URL that meets the connected platform requirements' },
      { displayName: 'Post Type', name: 'postType', type: 'string', default: '', displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } } },
      { displayName: 'Platform Settings', name: 'settingsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['schedulePost', 'validatePost'] } }, description: 'JSON object for platform fields such as a YouTube title or Pinterest board' },
      { displayName: 'Idempotency Key', name: 'idempotencyKey', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['schedulePost'] } }, description: 'Unique source record ID plus schedule. Reuse it for retries of the same post.' },
      { displayName: 'Approve Scheduling', name: 'confirm', type: 'boolean', default: false, displayOptions: { show: { operation: ['schedulePost'] } }, description: 'Whether the account, caption, media, and schedule have been approved for this workflow' },
      { displayName: 'Status', name: 'status', type: 'options', default: '', displayOptions: { show: { operation: ['listPosts'] } }, options: [
        { name: 'All', value: '' }, { name: 'Draft', value: 'draft' }, { name: 'Failed', value: 'failed' }, { name: 'Published', value: 'published' }, { name: 'Scheduled', value: 'scheduled' },
      ] },
      { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, displayOptions: { show: { operation: ['listPosts'] } }, description: 'Whether to return all results or only up to a given limit' },
      { displayName: 'Limit', name: 'limit', type: 'number', default: 50, typeOptions: { minValue: 1, maxValue: 200 }, displayOptions: { show: { operation: ['listPosts'], returnAll: [false] } }, description: 'Max number of results to return' },
    ],
  };

  methods = { loadOptions: {
    async getAccounts(this: ILoadOptionsFunctions) {
      const workspaceId = this.getCurrentNodeParameter('workspaceId') as string;
      const data = await this.helpers.httpRequestWithAuthentication.call(this, 'posterlyApi', { url: `${API}/accounts`, method: 'GET', qs: workspaceId ? { workspace_id: workspaceId } : {}, json: true });
      return (data.accounts as IDataObject[]).map((account) => ({ name: `${account.username} (${account.platform})`, value: String(account.id) }));
    },
  } };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const result: INodeExecutionData[] = [];
    for (let index = 0; index < this.getInputData().length; index++) {
      try {
        const operation = this.getNodeParameter('operation', index) as string;
        const workspaceId = this.getNodeParameter('workspaceId', index, '') as string;
        const qs: IDataObject = workspaceId ? { workspace_id: workspaceId } : {};
        const request = async (path: string, options: Partial<IHttpRequestOptions> = {}) => this.helpers.httpRequestWithAuthentication.call(this, 'posterlyApi', { url: `${API}${path}`, method: 'GET', headers: { Accept: 'application/json', 'X-posterly-Source': 'n8n' }, json: true, ...options });
        let rows: IDataObject[];
        if (operation === 'listAccounts') {
          rows = (await request('/accounts', { qs })).accounts;
        } else if (operation === 'getPost') {
          rows = [(await request(`/posts/${encodeURIComponent(String(this.getNodeParameter('postId', index)))}`)).post];
        } else if (operation === 'listPosts') {
          const returnAll = this.getNodeParameter('returnAll', index) as boolean;
          const limit = returnAll ? 200 : this.getNodeParameter('limit', index) as number;
          const status = this.getNodeParameter('status', index, '') as string;
          let offset = 0;
          rows = [];
          for (;;) {
            const page = await request('/posts', { qs: { ...qs, ...(status ? { status } : {}), limit, offset, order: 'desc' } });
            rows.push(...page.posts);
            if (!returnAll || !page.has_more) break;
            if (!Number.isInteger(page.next_offset) || page.next_offset <= offset) throw new NodeOperationError(this.getNode(), 'Invalid pagination cursor returned by posterly.', { itemIndex: index });
            offset = page.next_offset;
          }
        } else if (operation === 'schedulePost' || operation === 'validatePost') {
          const input: Record<string, unknown> = { workspaceId };
          for (const name of ['accountId', 'caption', 'scheduledAt', 'mediaUrl', 'postType', 'settingsJson']) input[name] = this.getNodeParameter(name, index, '');
          if (operation === 'schedulePost') {
            input.confirm = this.getNodeParameter('confirm', index);
            input.idempotencyKey = this.getNodeParameter('idempotencyKey', index);
          }
          const body = operation === 'schedulePost' ? approvedPost(input) : { ...postPayload(input), dry_run: true };
          const response = await request('/posts', { method: 'POST', body: body as IDataObject, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-posterly-Source': 'n8n', ...(operation === 'schedulePost' ? { 'Idempotency-Key': String(input.idempotencyKey) } : {}) } });
          rows = [operation === 'schedulePost' ? response.post : response];
        } else {
          throw new NodeOperationError(this.getNode(), 'Unsupported operation.', { itemIndex: index });
        }
        result.push(...rows.map((json) => ({ json, pairedItem: { item: index } })));
      } catch (error) {
        if (this.continueOnFail()) {
          result.push({ json: { error: error instanceof Error ? error.message : 'posterly request failed' }, pairedItem: { item: index } });
        } else {
          throw new NodeOperationError(this.getNode(), error instanceof Error ? error : new Error('posterly request failed'), { itemIndex: index });
        }
      }
    }
    return [result];
  }
}
