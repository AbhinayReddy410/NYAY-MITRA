export type NodeEnv = 'development' | 'production' | 'test';

export interface Env {
  PORT: number;
  NODE_ENV: NodeEnv;
  FIREBASE_PROJECT_ID: string;
  TYPESENSE_HOST: string;
  TYPESENSE_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
}

const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv;
const isProduction = nodeEnv === 'production';

function parsePort(value: string | undefined): number {
  if (!value) {
    if (isProduction) {
      throw new Error('Missing env var: PORT');
    }
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Invalid PORT');
  }

  return port;
}

function getStringEnv(name: keyof Omit<Env, 'PORT' | 'NODE_ENV'>): string {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value ?? '';
}

export const env: Env = {
  PORT: parsePort(process.env.PORT),
  NODE_ENV: nodeEnv,
  FIREBASE_PROJECT_ID: getStringEnv('FIREBASE_PROJECT_ID'),
  TYPESENSE_HOST: getStringEnv('TYPESENSE_HOST'),
  TYPESENSE_API_KEY: getStringEnv('TYPESENSE_API_KEY'),
  RAZORPAY_KEY_ID: getStringEnv('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: getStringEnv('RAZORPAY_KEY_SECRET')
};
