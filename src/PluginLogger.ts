import { Logging } from 'homebridge';

export type PluginLog = Logging & {
  success?: (message: string, ...parameters: unknown[]) => void;
};

export class PluginLogger {
  constructor(
    private readonly log: PluginLog,
    private readonly namespace: string,
  ) {}

  private prefix(message: string): string {
    return `${this.namespace} -> ${message}`;
  }

  debug(message: string, ...parameters: unknown[]): void {
    this.log.debug(this.prefix(message), ...parameters);
  }

  info(message: string, ...parameters: unknown[]): void {
    this.log.info(this.prefix(message), ...parameters);
  }

  warn(message: string, ...parameters: unknown[]): void {
    this.log.warn(this.prefix(message), ...parameters);
  }

  error(message: string, ...parameters: unknown[]): void {
    this.log.error(this.prefix(message), ...parameters);
  }

  success(message: string, ...parameters: unknown[]): void {
    if (this.log.success) {
      this.log.success(this.prefix(message), ...parameters);
    } else {
      this.log.info(this.prefix(message), ...parameters);
    }
  }
}
