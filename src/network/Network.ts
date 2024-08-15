import { Logging } from 'homebridge';

import fetch, { RequestInit as NodeFetchRequestInit, Response as NodeFetchResponse } from 'node-fetch';
import * as fs from 'fs';
import https from 'https';

export interface FBXRequestResult {
  status_code: number | null;
  data: unknown;
}

export class Network {
  private httpsAgent: https.Agent;

  constructor(
    public readonly log: Logging,
  ) {
    const ca = fs.readFileSync('FBXCerts.crt');
    this.httpsAgent = new https.Agent({
      ca: ca,
      keepAlive: true,
    });
    // this.httpsAgent.on('keylog', (line, _tlsSocket) => {
    //   this.debug(`SSL KEYS event: ${line}`);
    // });
  }

  private debug(s: string) {
    this.log.debug(`Network -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`Network -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`Network -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`Network -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`Network -> ${s}`);
  }

  async request(
    method: string,
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: any = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any = null,
  ): Promise<FBXRequestResult> { //, callback:Function) {
    // const debug_str_prefix = `${method} ${url}`;
    headers['Content-Type'] = 'application/json; charset=utf-8';
    const request: NodeFetchRequestInit = {
      method: method,
      headers: headers,
      agent: this.httpsAgent,
    };
    if (body !== null) {
      request.body = JSON.stringify(body);
      // this.debug(`${debug_str_prefix} -> request:${JSON.stringify(body)}`);
    } else {
      // this.debug(`${debug_str_prefix}`);
    }
    const response: NodeFetchResponse = await fetch(url, request);
    if (!response.ok) {
      await this.handleHTTPErrorCodes(response, url, method, body);
      return { status_code: response.status, data: { error_code: 'retry_later' } };
    } else {
      const jsonData = await response.json();
      // this.debug(`${debug_str_prefix} -> response (json):${JSON.stringify(jsonData)}`);
      return { status_code: response.status, data: jsonData };
    }
  }

  private async handleHTTPErrorCodes(response: NodeFetchResponse, url: string, method: string, body: unknown) {
    const debug_str_prefix = `${method} ${url}`;
    this.error(debug_str_prefix + ' ' + (body || '') + ' => ' + response.status + ' ' + response.statusText);
    const errortext = await response.text();
    this.error('\n' + errortext);
    if (response.status === 500) {
      this.handleHTTPError500(response, errortext);
    } else if (response.status === 501) {
      this.handleHTTPError501(response, errortext);
    } else if (response.status === 502) {
      this.handleHTTPError502(response, errortext);
    } else if (response.status === 503) {
      this.handleHTTPError503(response, errortext);
    } else if (response.status === 504) {
      await this.handleHTTPError504(response, errortext);
    } else {
      this.handleOtherHTTPErrors(response, errortext);
    }
  }

  private handleOtherHTTPErrors(response: NodeFetchResponse, errortext: string) {
    this.error(JSON.stringify(response.headers.raw()['content-type']));
    this.error(errortext);
    throw new Error(`${response.status}. Got a non-JSON  reply!\n\n${errortext}`);
  }

  private handleHTTPError500(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError501(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError502(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError503(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private async handleHTTPError504(_response: NodeFetchResponse, _errortext: string) {
    // throw new Error(`${response.status}. ${response.statusText}`);
    this.warn('Force a delay');
    await this.delay(5000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}