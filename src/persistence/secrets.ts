/**
 * Secrets Manager Integration
 * Abstracts secret retrieval from environment variables or external secrets managers.
 * 
 * Supported providers: env (default), aws-secrets, hashicorp-vault, azure-key-vault
 * 
 * @module secrets
 */

import { isBackendConfigured, getToken } from './api';

/**
 * Secret provider configuration
 */
export type SecretProvider = 'env' | 'aws-secrets' | 'hashicorp-vault' | 'azure-key-vault';

interface SecretsConfig {
  provider: SecretProvider;
  endpoint?: string;      // For Vault/AWS endpoints
  region?: string;         // For AWS/Azure
  namespace?: string;      // For Vault namespace
  cacheTtl?: number;      // Cache TTL in seconds (default: 300)
}

/**
 * Get secrets manager configuration from environment
 */
function getSecretsConfig(): SecretsConfig {
  const provider = (import.meta.env.VITE_SECRETS_PROVIDER || 'env') as SecretProvider;
  return {
    provider,
    endpoint: import.meta.env.VITE_SECRETS_ENDPOINT,
    region: import.meta.env.VITE_SECRETS_REGION,
    namespace: import.meta.env.VITE_SECRETS_NAMESPACE,
    cacheTtl: parseInt(import.meta.env.VITE_SECRETS_CACHE_TTL || '300')
  };
}

// In-memory cache for secrets
const secretCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Fetch secret from provider
 */
async function fetchSecret(provider: string, key: string, config: SecretsConfig): Promise<string | null> {
  // Check cache first
  const cached = secretCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let value: string | null = null;

  switch (provider) {
    case 'aws-secrets':
      value = await fetchFromAWS(key, config.endpoint!, config.region!);
      break;
    case 'hashicorp-vault':
      value = await fetchFromVault(key, config.endpoint!, config.namespace);
      break;
    case 'azure-key-vault':
      value = await fetchFromAzure(key, config.endpoint!, config.region!);
      break;
    case 'env':
    default:
      // Fall back to environment variable
      value = import.meta.env[`VITE_${key}`] || import.meta.env[key] || null;
  }

  // Update cache
  if (value) {
    secretCache.set(key, {
      value,
      expiresAt: Date.now() + (config.cacheTtl || 300) * 1000
    });
  }

  return value;
}

/**
 * Fetch from AWS Secrets Manager
 */
async function fetchFromAWS(secretName: string, endpoint: string, region: string): Promise<string | null> {
  if (!endpoint) return null;
  
  try {
    const response = await fetch(`${endpoint}/${secretName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.SecretString || null;
  } catch {
    return null;
  }
}

/**
 * Fetch from HashiCorp Vault
 */
async function fetchFromVault(secretPath: string, endpoint: string, namespace?: string): Promise<string | null> {
  if (!endpoint) return null;
  
  try {
    const response = await fetch(`${endpoint}/v1/secret/data/${secretPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': import.meta.env.VITE_VAULT_TOKEN || '',
        ...(namespace ? { 'X-Vault-Namespace': namespace } : {})
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.data?.data?.value || null;
  } catch {
    return null;
  }
}

/**
 * Fetch from Azure Key Vault
 */
async function fetchFromAzure(secretName: string, endpoint: string, region: string): Promise<string | null> {
  if (!endpoint) return null;
  
  try {
    const response = await fetch(`${endpoint}/secrets/${secretName}?api-version=7.0`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_AZURE_TOKEN}`
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.value || null;
  } catch {
    return null;
  }
}

/**
 * Get a secret value - wraps environment variables with secrets manager lookup
 * 
 * @param key - Secret name (will be prefixed with VITE_ for env lookup)
 * @param required - If true, throws error when secret not found
 */
export async function getSecret(key: string, required = false): Promise<string> {
  const config = getSecretsConfig();
  const value = await fetchSecret(config.provider, key, config);
  
  if (!value && required) {
    throw new Error(`Required secret not found: ${key}`);
  }
  
  return value || '';
}

/**
 * Clear secret cache (useful for testing or force refresh)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Check if secrets manager is configured
 */
export function isSecretsConfigured(): boolean {
  const config = getSecretsConfig();
  return config.provider !== 'env' && !!config.endpoint;
}

/**
 * Get JWT_SECRET - retrieved via secrets manager or environment
 */
export async function getJwtSecret(): Promise<string> {
  return getSecret('JWT_SECRET', true);
}

/**
 * Get PEACH_SECRET - retrieved via secrets manager or environment
 */
export async function getPeachSecret(): Promise<string> {
  return getSecret('PEACH_SECRET', false);
}

/**
 * Get PEACH_ENTITY_ID - retrieved via secrets manager or environment
 */
export async function getPeachEntityId(): Promise<string> {
  return getSecret('PEACH_ENTITY_ID', false);
}

/**
 * Get N8N_WEBHOOK_SECRET - retrieved via secrets manager or environment
 */
export async function getN8nWebhookSecret(): Promise<string> {
  return getSecret('N8N_WEBHOOK_SECRET', false);
}
