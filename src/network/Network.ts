import { Logging } from 'homebridge';
import fetch from 'node-fetch';


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
    headers: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any = null,
  ): Promise<FBXRequestResult> { //, callback:Function) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    // try {
    let request = null;
    if (body !== null) {
      request = {
        method: method,
        headers: headers,
        body: JSON.stringify(body),
      };
    } else {
      request = {
        method: method,
        headers: headers,
      };
    }
    // this.debug(`Sending to ${url}`);
    // this.debug(`   |-> payload        : ${JSON.stringify(request)}`);
    const response = await fetch(url, request);
    // const clone = response.clone();
    // this.debug(`   |-> response       : ${JSON.stringify(response)}`);
    // try{
    if (response.status !== 200) {
      const replyContentType: string[] = response.headers.raw()['content-type'];
      if (replyContentType.length === 1) {
        if (!replyContentType[0].includes('application/json'.toLowerCase())) {
          const errortext = await response.text();
          this.debug(url + ' ' + method + ' ' + body || ' => ' + response.status);
          if (errortext.includes('<title>Freebox :: Erreur interne</title>') && errortext.includes('essayez plus tard')) {
            //throw new RetryLaterError("Got a retry later notification !");
            return { status_code: response.status, data: { success: false, error_code: 'retry_later' } };
          } else if (response.status === 503) {
            return { status_code: response.status, data: { success: false, error_code: 'retry_later' } };
          } else {
            this.error(JSON.stringify(response.headers.raw()['content-type']));
            this.error(errortext);
            throw new Error(`Error: ${response.status}. Got a non-JSON  reply!\n\n${errortext}`);
          }
        }
      } else {
        throw new Error(`Error: ${response.status}.Weird header content-type ... ${replyContentType}`);
      }
    }
    const jsonData = await response.json();
    // this.debug(`   |-> response (json): ${JSON.stringify(data)}`);
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
}