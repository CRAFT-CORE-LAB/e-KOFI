declare module 'cloudflare:workers' {
  export const env: CloudflareEnv;
}

declare module 'cloudflare:node' {
  export function httpServerHandler(input: { port: number }): {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
}

interface CloudflareEnv {
  DB: D1Binding;
  JWT_SECRET?: string;
  CARD_TOKEN_PEPPER?: string;
  PUBLIC_API_URL?: string;
  NODE_ENV?: string;
  INTOUCH_ENV?: string;
  INTOUCH_USERNAME?: string;
  INTOUCH_ACCOUNT_NO?: string;
  INTOUCH_PARTNER_PASSWORD?: string;
  INTOUCH_CALLBACK_URL?: string;
  INTOUCH_BASE_URL?: string;
  PIN_MAX_ATTEMPTS?: string;
  PIN_LOCK_MINUTES?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_GRAPH_VERSION?: string;
  WHATSAPP_TEMPLATE_SUCCESS?: string;
  WHATSAPP_TEMPLATE_FAILED?: string;
  WHATSAPP_TEMPLATE_LANG?: string;
  WHATSAPP_SESSION_MINUTES?: string;
  SHAKA_BRIDGE_URL?: string;
  SHAKA_BRIDGE_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

interface D1Binding {
  prepare(query: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
}
