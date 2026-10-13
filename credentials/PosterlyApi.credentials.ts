import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class PosterlyApi implements ICredentialType {
  name = 'posterlyApi';
  // Preserve the lowercase product brand in the credential picker.
  displayName = 'Social Media API';
  icon = { light: 'file:../nodes/Posterly/posterly.png', dark: 'file:../nodes/Posterly/posterly.png' } as const;
  documentationUrl = 'https://www.poster.ly/integrations/n8n';
  properties: INodeProperties[] = [
    { displayName: 'API Key', name: 'apiKey', type: 'string', typeOptions: { password: true }, default: '', required: true, description: 'Workspace-scoped API key with accounts:read, posts:read, and posts:write permissions' },
  ];
  authenticate: IAuthenticateGeneric = { type: 'generic', properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } } };
  test: ICredentialTestRequest = { request: { baseURL: 'https://www.poster.ly/api/v1', url: '/whoami', method: 'GET' } };
}
