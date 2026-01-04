import Typesense from 'typesense';
import type { Client } from 'typesense';

import { env } from './env';

type TypesenseProtocol = 'http' | 'https';

interface TypesenseNode {
  host: string;
  port: number;
  protocol: TypesenseProtocol;
}

interface TypesenseSearchParams {
  q: string;
  query_by: string;
  page: number;
  per_page: number;
  filter_by?: string;
}

interface TypesenseSearchHit<T> {
  document: T;
}

interface TypesenseSearchResponse<T> {
  found?: number;
  hits?: Array<TypesenseSearchHit<T>>;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
  page: number;
  limit: number;
}

const TEMPLATE_COLLECTION = 'templates';
const QUERY_BY_FIELDS = 'name,description,keywords';
const DEFAULT_PROTOCOL: TypesenseProtocol = 'https';
const DEFAULT_PORT = 443;
const CONNECTION_TIMEOUT_SECONDS = 5;

let cachedClient: Client | null = null;

function parseTypesenseNode(rawHost: string): TypesenseNode {
  const value = rawHost.trim();
  if (!value) {
    throw new Error('Missing TYPESENSE_HOST');
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    const url = new URL(value);
    const protocol: TypesenseProtocol = url.protocol === 'http:' ? 'http' : 'https';
    const port = url.port ? Number(url.port) : protocol === 'http' ? 80 : 443;
    if (!url.hostname || Number.isNaN(port)) {
      throw new Error('Invalid TYPESENSE_HOST');
    }
    return { host: url.hostname, port, protocol };
  }

  return { host: value, port: DEFAULT_PORT, protocol: DEFAULT_PROTOCOL };
}

function getClient(): Client {
  if (cachedClient) {
    return cachedClient;
  }

  if (!env.TYPESENSE_HOST || !env.TYPESENSE_API_KEY) {
    throw new Error('Missing Typesense configuration');
  }

  const node = parseTypesenseNode(env.TYPESENSE_HOST);

  cachedClient = new Typesense.Client({
    nodes: [node],
    apiKey: env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: CONNECTION_TIMEOUT_SECONDS
  });

  return cachedClient;
}

export async function searchTemplates<T>(
  query: string,
  filters: string | undefined,
  page: number,
  limit: number
): Promise<SearchResult<T>> {
  const client = getClient();
  const params: TypesenseSearchParams = {
    q: query,
    query_by: QUERY_BY_FIELDS,
    page,
    per_page: limit
  };

  if (filters) {
    params.filter_by = filters;
  }

  const response = (await client
    .collections(TEMPLATE_COLLECTION)
    .documents()
    .search(params)) as TypesenseSearchResponse<T>;

  const hits = (response.hits ?? []).map((hit) => hit.document);
  const total = response.found ?? 0;

  return {
    hits,
    total,
    page,
    limit
  };
}
