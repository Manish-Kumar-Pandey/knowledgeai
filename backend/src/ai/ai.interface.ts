export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface AIProvider {
  name: string;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateChatCompletion(messages: ChatMessage[], temperature?: number): Promise<string>;
  streamChatCompletion(messages: ChatMessage[], callbacks: StreamCallbacks, temperature?: number): Promise<void>;
}
