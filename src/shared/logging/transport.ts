export type TransportLogLevel = 'log' | 'info' | 'warn' | 'error';

export interface TransportLogEntry {
  level: TransportLogLevel;
  message: string;
  source?: string | null;
  args: any[];
  timestamp: number;
}
