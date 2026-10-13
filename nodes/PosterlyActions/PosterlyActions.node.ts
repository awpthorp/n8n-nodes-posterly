import { NodeConnectionTypes, NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData, type INodeProperties, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import catalog from './native-actions.json';
import properties from './properties.json';
import { actionRequest, actionOutput, type NativeAction } from './native-runtime';

export class PosterlyActions implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'posterly Actions', name: 'posterlyActions', icon: { light: 'file:../Posterly/posterly.png', dark: 'file:../Posterly/posterly.png' },
    group: ['transform'], version: 1, subtitle: '={{$parameter["operation"]}}',
    description: 'Accounts, posts, media, analytics, engagement, creative jobs, and administration with posterly',
    defaults: { name: 'posterly Actions' }, inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main], usableAsTool: true,
    credentials: [{ name: 'posterlyApi', required: true }], properties: properties as unknown as INodeProperties[],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const rows: INodeExecutionData[] = [];
    for (let index = 0; index < this.getInputData().length; index++) {
      try {
        const key = this.getNodeParameter('operation', index) as string;
        const action = catalog.actions.find(item => item.key === key) as NativeAction | undefined;
        if (!action) throw new NodeOperationError(this.getNode(), 'Unknown posterly operation.', { itemIndex: index });
        const input = { ...this.getNodeParameter('inputs', index, {}) as Record<string, unknown>,
          native_approval: this.getNodeParameter('native_approval', index, false),
          native_idempotency_key: this.getNodeParameter('native_idempotency_key', index, '') };
        const body = actionRequest(action, input);
        const response: unknown = await this.helpers.httpRequestWithAuthentication.call(this, 'posterlyApi', {
          url: catalog.endpoint, method: 'POST', json: true, body: body as unknown as IDataObject,
          headers: { Accept: 'application/json', 'X-posterly-Source': 'n8n', ...(action.retryKey ? { 'Idempotency-Key': String(input.native_idempotency_key) } : {}) },
        });
        rows.push({ json: actionOutput(response) as IDataObject, pairedItem: { item: index } });
      } catch (error) {
        if (this.continueOnFail()) rows.push({ json: { error: error instanceof Error ? error.message : 'posterly request failed' }, pairedItem: { item: index } });
        else throw new NodeOperationError(this.getNode(), error instanceof Error ? error : new Error('posterly request failed'), { itemIndex: index });
      }
    }
    return [rows];
  }
}
