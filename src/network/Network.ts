import { Logging } from 'homebridge';

import * as fs from 'fs';
import https from 'https';
// import fetch, { RequestInit as Request, Response as Response } from 'node-fetch';
import axios, { AxiosRequestConfig as Request, AxiosResponse as Response } from 'axios';

export interface FBXRequestResult {
  status_code: number | null;
  data: unknown;
}

export class Network {
  private httpsAgent: https.Agent | null = null;
  // private host:string;
  // private port:number;
  private ca: Buffer | null = null;

  constructor(
    public readonly log: Logging,
    private readonly useHTTPS: boolean,
  ) {
    if (useHTTPS) {
      this.ca = fs.readFileSync('FBXCerts.crt');
      this.httpsAgent = new https.Agent({
        ca: this.ca,
        keepAlive: true,
        // voodoo attempt to prevent socket closed (by server) before TLS connection established ..;
        // maxSockets: 1,
      });
      // // this.httpsAgent.on('keylog', (line, _tlsSocket) => {
      // //   this.debug(`SSL KEYS event: ${line}`);
      // // });
    }
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

  // setHTTPSinfo(
  //   host: string,
  //   port: number,
  // ) {
  //   // this.host = host;
  //   // this.port = port;
  //   this.httpsAgent = new https.Agent({
  //     host: host,
  //     port: port,
  //     ca: this.ca,
  //     keepAlive: true,
  //     // voodoo attempt to prevent socket closed (by server) before TLS connection established ..;
  //     // maxSockets: 1,
  //   });
  // }

  // /**
  //  * Requests with node-fetch
  // * @param method HTTP method
  // * @param url a string representing the url to reach
  // * @param headers special headers if needed
  // * @param body request body
  // * @returns a FBXRequestResult
  //  */
  // async request(
  //   method: string,
  //   url: string,
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   headers: any = {},
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   body: any = null,
  // ): Promise<FBXRequestResult> { //, callback:Function) {
  //   // const debug_str_prefix = `${method} ${url}`;
  //   headers['Content-Type'] = 'application/json; charset=utf-8';
  //   // if (this.httpsAgent === null) {
  //   //   throw Error('No HTTPS agent defined ...');
  //   // }
  //   headers['User-Agent'] = 'Chrome/59.0.3071.115';
  //   const request: Request = {
  //     method: method,
  //     headers: headers,

  //   };
  //   if (this.useHTTPS && this.httpsAgent !== null) {
  //     request.agent = this.httpsAgent;
  //   }
  //   if (body !== null) {
  //     request.body = JSON.stringify(body);
  //     // this.debug(`${debug_str_prefix} -> request:${JSON.stringify(body)}`);
  //   } else {
  //     // this.debug(`${debug_str_prefix}`);
  //   }
  //   const response: Response = await fetch(url, request);
  //   if (!response.ok) {
  //     await this.handleHTTPErrorCodes(response, url, method, body);
  //     return { status_code: response.status, data: { error_code: 'retry_later' } };
  //   } else {
  //     const jsonData = await response.json();
  //     // this.debug(`${debug_str_prefix} -> response (json):${JSON.stringify(jsonData)}`);
  //     return { status_code: response.status, data: jsonData };
  //   }
  // }

  /**
   * Request with axios
   * @param method HTTP method
   * @param url a string representing the url to reach
   * @param headers special headers if needed
   * @param body request body
   * @returns a FBXRequestResult
   */
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
    // if (this.httpsAgent === null) {
    //   throw Error('No HTTPS agent defined ...');
    // }
    headers['User-Agent'] = 'Chrome/59.0.3071.115';
    const request: Request = {
      method: method,
      url: url,
      headers: headers,
    };
    if (this.useHTTPS && this.httpsAgent !== null) {
      request.httpsAgent = this.httpsAgent;
    }
    if (body !== null) {
      request.data = JSON.stringify(body);
      // this.debug(`${debug_str_prefix} -> request:${JSON.stringify(body)}`);
    } else {
      // this.debug(`${debug_str_prefix}`);
    }
    // try {
    request.validateStatus = function (status) {
      return status === 200 || status === 504;
    };
    const response: Response = await axios(request);
    if (!(response.status === 200)) {
      await this.handleHTTPErrorCodes(response, url, method, body);
      return { status_code: response.status, data: { error_code: 'retry_later' } };
    } else {
      // this.debug(JSON.stringify(response.data));
      // this.debug(typeof(response.data));
      const jsonData = response.data;
      // this.debug(`${debug_str_prefix} -> response (json):${JSON.stringify(jsonData)}`);
      return { status_code: response.status, data: jsonData };
    }
    // } catch (e) {
    //   this.error('Exception=' + JSON.stringify(e));
    //   this.error('while treating request=' + JSON.stringify(request));
    //   return { status_code: -1, data: null };
    // }
  }

  private async handleHTTPErrorCodes(response: Response, url: string, method: string, body: unknown) {
    const debug_str_prefix = `${method} ${url}`;
    this.error(debug_str_prefix + ' ' + (body || '') + ' => ' + response.status + ' ' + response.statusText);
    // node fetch: const errortext = await response.data.text();
    const errortext = response.data;
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


  private handleOtherHTTPErrors(response: Response, errortext: string) {
    this.error(JSON.stringify(response.headers.raw()['content-type']));
    this.error(errortext);
    throw new Error(`${response.status}. Got a non-JSON  reply!\n\n${errortext}`);
  }

  private handleHTTPError500(response: Response, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError501(response: Response, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError502(response: Response, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private handleHTTPError503(response: Response, _errortext: string) {
    throw new Error(`${response.status}. ${response.statusText}`);
  }

  private async handleHTTPError504(_response: Response, _errortext: string) {
    // throw new Error(`${response.status}. ${response.statusText}`);
    this.warn('Force a delay');
    await this.delay(5000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}