import { Logging } from 'homebridge';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';


export interface FBXRequestResult {
  status_code: number | null;
  data: unknown;
}

export class Network {
  constructor(
    public readonly log: Logging,
  ) {
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
    const debug_str_prefix = `${method} ${url}`;
    headers['Content-Type'] = 'application/json; charset=utf-8';
    // try {
    let request = null;
    if (body !== null) {// TODO: better syntax for this ?!
      request = {
        method: method,
        headers: headers,
        body: JSON.stringify(body),
      };
      this.debug(`${debug_str_prefix} -> request:${JSON.stringify(body)}`);
    } else {
      request = {
        method: method,
        headers: headers,
      };
      this.debug(`${debug_str_prefix} -> request: (no body)`);
    }
    const response: NodeFetchResponse = await fetch(url, request);
    // const clone = response.clone();
    // this.debug(`   |-> response size  : ${JSON.stringify(response)}`);
    // try{
    if (!response.ok) {
      await this.handleHTTPErrorCodes(response, url, method, body);
    }
    const jsonData = await response.json();
    this.debug(`${debug_str_prefix} -> response (json):${JSON.stringify(jsonData)}`);
    return { status_code: response.status, data: jsonData };
    // } catch (error) {
    //   this.error(JSON.stringify(error));
    //   return { status_code: null, data: null };
    // }
    // } catch(error) {
    //   this.debug(`   |-> response body  : ${clone.status}\n\n${clone.text()}`);
    //   throw error;
    // }
  }

  private async handleHTTPErrorCodes(response: NodeFetchResponse, url: string, method: string, body: unknown) {
    const debug_str_prefix = `${method} ${url}`;
    this.error(debug_str_prefix + ' ' + (body || '') + ' => ' + response.status + response.statusText);
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
      this.handleHTTPError504(response, errortext);
    } else {
      this.handleOtherHTTPErrors(response, errortext);
    }

    // const replyContentType: string[] = response.headers.raw()['content-type'];

    // if (replyContentType.length === 1) {
    //   // so far so good with Freebox API
    //   if (!replyContentType[0].includes('application/json'.toLowerCase())) {
    //     await this.handleReplyIsNotJSON(response);
    //   } else {
    //     // that was a JSON ?!
    //     const jsonData = await response.json();
    //     throw new Error(`${response.status}. ${JSON.stringify(jsonData)}`);
    //   }
    // } else {
    //   throw new Error(`${response.status}.Weird header content-type ... ${replyContentType}`);
    // }
  }
  // private async handleReplyIsNotJSON(response: NodeFetchResponse) {

  //   this.error(errortext);
  //   if (response.status === 503) {
  //     this.handleHTTPError503(errortext, response);
  //   } else {
  //     this.handleOtherHTTPErrors(response, errortext);
  //   }
  // }

  private handleOtherHTTPErrors(response: NodeFetchResponse, errortext: string) {
    this.error(JSON.stringify(response.headers.raw()['content-type']));
    this.error(errortext);
    throw new Error(`${response.status}. Got a non-JSON  reply!\n\n${errortext}`);
  }

  private handleHTTPError500(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. Internal error 500 Internal Server Error`);
  }

  private handleHTTPError501(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. Internal error 501 Not Implemented`);
  }

  private handleHTTPError502(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. Internal error 502 Bad Gateway or Proxy Error`);
  }

  private handleHTTPError503(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. Internal error 503 Service Unavailable`);
  }

  private handleHTTPError504(response: NodeFetchResponse, _errortext: string) {
    throw new Error(`${response.status}. Internal error 504 Gateway Time-out`);
  }
}