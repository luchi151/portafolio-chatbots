export type DemoType = 'chatbot' | 'voicebot' | 'db_query';

export type DebtStatus = 'active' | 'paid' | 'overdue' | 'in_collection';

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status?: 'running' | 'done';
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  agentStep?: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  toolCalls?: ToolCall[];
  metadata: {
    model: string;
    latency: number;
    tokens: number;
  };
}

export interface DBQueryResponse {
  sql: string;
  results: Array<Record<string, unknown>>;
  visualization: {
    type: 'table' | 'bar' | 'line' | 'pie';
    config: Record<string, unknown>;
  };
  metadata: {
    executionTime: number;
    rowCount: number;
  };
}

export interface DemoTokenPayload {
  customerId: string;
  sessionId: string;
  exp: number;
}
