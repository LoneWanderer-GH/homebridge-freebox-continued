import { Logging } from 'homebridge';
import { FBXRequestResult, Network } from '../network/Network.js';
import { FBXAuthInfo, FBXSessionCredentials, FreeboxSession, FBXLoginSessionReply } from './FreeboxSession.js';

// import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// interface FBXCredentials {
//     challenge: string | null;
//     session: string | null;
//     trackId: number | null;
//     token: string | null;
// }

// interface FBXRequestType {
//     method: string;
//     url: string;
//     body: JSON;
//     // callback: Function;
//     autoRetry: boolean;
// }
// // class PromiseQueue {
// //     queue = Promise.resolve(true)

// //     add(operation:Function) {
// //       return new Promise((resolve, reject) => {
// //         this.queue = this.queue
// //           .then(operation)
// //           .then(resolve)
// //           .catch(reject)
// //       })
// //     }
// //   }
// export class FreeboxRequest {
//     static readonly RETRY_TIMEOUT = 2000 // 2 seconds
//     private RETRY_COUNT = 0

//     private FreeboxSession: FreeboxSession;
//     private credentials: FBXCredentials;
//     private requestQueue: Array<FBXRequestType>;

//     constructor(
//         public readonly log: Logging,
//         public readonly network: Network,
//     ) {
//         this.FreeboxSession = new FreeboxSession(this.log, this.network);

//         this.credentials = {
//             challenge: "",
//             session: "",
//             trackId: 0,
//             token: "",
//         };
//         this.requestQueue = new Array<FBXRequestType>()
//     }



// eslint-disable-next-line max-len
//     async freeboxAuth(token: string, trackId: number, callback: Function): Promise<[string | null, string | null, number | null, string | null]> {
//         this.info(this.requestQueue)
//         const [new_token, sessionToken, new_trackId, challenge] = await this.FreeboxSession.fbx(token, trackId);
//         this.authCallback(new_token, sessionToken, new_trackId, challenge);
//         return [new_token, sessionToken, new_trackId, challenge];
//     }

//     authCallback(token: string | null, sessionToken: string | null, trackId: number | null, challenge: string | null) {
//         if (token == null) {
//             this.warn('Trying updating with null credentials')
//             return
//         }
//         this.credentials.session = sessionToken
//         this.credentials.challenge = challenge
//         this.credentials.token = token
//         this.credentials.trackId = trackId
//         this.info('Updated credentials')
//     }

// eslint-disable-next-line max-len
//     private addToQueue(method: string, url: string, body: any, callback: Function, autoRetry: boolean): Promise<[number | null, any | null]> {
//         const o = {
//             method: method,
//             url: url,
//             body: body,
//             // callback: callback,
//             autoRetry: autoRetry
//         };
//         // this.requestQueue.push(o);
//         return new Promise(
//             (resolve) => {
//                 this.requestQueue.push(o);
//                 resolve(o);
//             }
//         );
//     }

//     async request(method: string, url: string, body: any,
//         // callback: Function,
//         autoRetry: boolean): Promise<[number | null, any | null]> {
//         if (this.requestQueue == null) {
//             return await this.startRequest(method, url, body, autoRetry)
//         } else {
//             if (this.requestQueue.length == 0) {
//                 return await this.startRequest(method, url, body, autoRetry);
//             } else {
//                 return this.addToQueue(method, url, body,
//                     // callback,
//                     autoRetry);
//             }
//         }
//     }

//     private async startRequest(method: string, url: string, body: any, autoRetry: boolean): Promise<[number | null, any | null]> {

//         if (this.requestQueue != null) {
//             if (this.requestQueue.length == 0) {
//                 //this.requestQueue = this.requestQueue.shift()
//             }
//             if (this.credentials.token == null) {
//                 this.warn('Operation requested with null token')
//                 // callback(null, null)
//                 return [null, null]
//             }
//         }

//         // const options = {
//         //     url: url,
//         //     method: method,
//         //     headers: {
//         //         'X-Fbx-App-Auth': this.credentials.session
//         //     },
//         //     json: true,
//         //     body: body
//         // }
//         // var self = this
//         try {
//             let cred: string = this.credentials.session!
//             const response = await fetch(url, {
//                 method: method,
//                 headers: {
//                     'X-Fbx-App-Auth': cred
//                 },
//                 body: body,
//             });
//             // if the challenge has changed -> request new session token
//             // returns the new auth stuff and retry the request
//             if ((body.error_code != null && body.error_code == 'auth_required') && this.credentials.challenge != body.result.challenge) {
//                 this.info('Fbx authed operation requested without credentials')
//                 this.info(body)
//                 const new_sessionToken = await this.FreeboxSession.session(this.credentials.token, body.result.challenge);
//                 if (new_sessionToken == null) {
//                     if (autoRetry) {
//                         this.warn('Freebox OS returned a null sessionToken. Trying again...')
//                         const res = await sleep(FreeboxRequest.RETRY_TIMEOUT, "");
//                         return await this.request(method, url, body,
//                             // callback,
//                             autoRetry)
//                     } else {
//                         this.warn('Freebox OS returned null sessionToken.')
//                         return [401, null]
//                     }
//                 }
//                 this.authCallback(this.credentials.token, new_sessionToken, this.credentials.trackId, body.result.challenge)
//                 this.request(method, url, body,
//                     // callback,
//                     autoRetry)
//             } else {
//                 if (body.error_code != null && body.error_code == 'insufficient_rights') {
//                     if (autoRetry) {
//                         this.warn('Insufficient rights to request home api (' + body.missing_right + '). Trying again...')
//                         const res = await sleep(FreeboxRequest.RETRY_TIMEOUT, "");
//                         return await this.request(method, url, body,
//                             // callback,
//                             autoRetry);
//                     } else {
//                         this.warn('Insufficient rights to request home api.')
//                         return [401, null]
//                     }
//                 } else if (body.success == false) {
//                     const res = await sleep(FreeboxRequest.RETRY_TIMEOUT, "");
//                     if (this.RETRY_COUNT < 3) {
//                         this.RETRY_COUNT++
//                         return await this.request(method, url, body,
//                             // callback,
//                             autoRetry)
//                     } else {
//                         this.RETRY_COUNT = 0
//                         return [401, null]
//                     }
//                 } else {
//                     return [response.status, body]
//                 }
//                 if (this.requestQueue != null) {
//                     if (this.requestQueue.length > 0) {
//                         const res = await sleep(500, "");
//                         let next = this.requestQueue[0]
//                         return await this.startRequest(next.method, next.url, next.body,
//                             // next.callback,
//                             next.autoRetry)
//                     }
//                 }
//             }

//         } catch (error) {
//             this.error(JSON.stringify(error));
//             return [null, null]
//         }
//         return [null, null]
//     }
// }

export interface StoredCredentials {
  trackId: number | null;
  token: string | null;
}

export enum RetryPolicy {
  NO_RETRY,
  AUTO_RETRY,
}

interface RequestQueueItem {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  body: unknown;
  retry_policy: RetryPolicy;
  retry_count: number;
}

export class DataNotUpdatedError extends Error {

}

export class FreeboxRequest {
  private RETRY_TIMEOUT = 2000; // 2 seconds
  private RETRY_COUNT = 0;

  //   private credentials: Credentials = {
  //     challenge: null,
  //     session: null,
  //     trackId: null,
  //     token: null,
  //   };

  private requestQueue: RequestQueueItem[] = [];

  private freeboxSession: FreeboxSession;
  private credentials: FBXSessionCredentials;

  constructor(
    public readonly log: Logging,
    public readonly network: Network,
    private readonly freeboxAddress:string,
    private readonly freeboxApiVersion:string,
  ) {
    this.freeboxSession = new FreeboxSession(this.log, this.network, this.freeboxAddress, this.freeboxApiVersion);

    this.credentials = {
      challenge: '',
      session_token: '',
      track_id: 0,
      token: '',
    };
    // this.requestQueue = new Array<FBXRequestType>()
  }

  private debug(s: string) {
    this.log.debug(`FreeboxRequest -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`FreeboxRequest -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`FreeboxRequest -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`FreeboxRequest -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`FreeboxRequest -> ${s}`);
  }

  async freeboxAuth(
    authInfo: FBXAuthInfo,
    // token: string,
    // trackId: number
  ): Promise<FBXSessionCredentials> {
    this.info('Queue length=' + this.requestQueue.length);
    const s: FBXSessionCredentials = await this.freeboxSession.fbx(authInfo.app_token, authInfo.track_id);
    this.authCallback(s);
    return s;
  }

  private authCallback(sessionChallenge: FBXSessionCredentials) {
    //token: string | null, sessionToken: string, trackId: number, challenge: string): void {
    if (sessionChallenge.token === null) {
      this.warn('Trying updating with null credentials');
      return;
    }
    this.credentials.session_token = sessionChallenge.session_token;
    this.credentials.challenge = sessionChallenge.challenge;
    this.credentials.token = sessionChallenge.token;
    this.credentials.track_id = sessionChallenge.track_id;
    this.info('Updated credentials');
  }

  private addToQueue(method: RequestQueueItem['method'], url: string, body: unknown, retryPolicy: RetryPolicy,
    retry_count: number = 0,
  ): void {
    this.requestQueue.push({
      method,
      url,
      body,
      retry_policy: retryPolicy,
      retry_count: retry_count,
    });
  }

  // async request(method: RequestQueueItem['method'], url: string, body: unknown, autoRetry = true): Promise<FBXRequestResult> {
  async request(method: RequestQueueItem['method'], url: string, body: unknown, retryPolicy: RetryPolicy,
    retry_count: number = 0,
  ): Promise<FBXRequestResult> {
    if (this.requestQueue === null || this.requestQueue.length === 0) {
      // this.debug('Queue empty, launch request immediately');
      return this.startRequest(method, url, body, retryPolicy, retry_count);
    } else {
      this.debug(`Queue length=${this.requestQueue.length}>0, add to queue`);
      this.addToQueue(method, url, body, retryPolicy, retry_count);
      return new Promise((resolve, reject) => {
        this.processQueue(resolve, reject);
      });
    }
  }

  private async startRequest(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number = 0,
  ): Promise<FBXRequestResult> {
    // this.debug('startRequest Queue !');
    if (this.credentials.token === null) {
      this.warn('Operation requested with null token');
      throw new Error('Null token');
    }
    // this.debug(`Launch request ${method} @ ${url} with credentials`);
    const response: FBXRequestResult = await this.network.request(
      method,
      url,
      {
        'X-Fbx-App-Auth': this.credentials.session_token || '',
      },
      body,
    );
    // this.debug(`Got reply to ${method} @ ${url} = ${JSON.stringify(response)}`);
    const respBody: FBXLoginSessionReply = response.data as FBXLoginSessionReply;
    // this.debug('Parsing reply');
    if (respBody.error_code === undefined || respBody.error_code === null) {
      // server gracefully replied
      if (respBody.success === true) {
        // we did it
        this.processNextRequest();
        return { status_code: response.status_code, data: respBody };
        // <============= QUIT
      } else {
        // server replied but no cigar ..
        if (retryPolicy === RetryPolicy.AUTO_RETRY) {
          // retry !
          if (retry_count < 3) {
            retry_count += 1;
            await this.delay(this.RETRY_TIMEOUT);
            return this.request(method, url, body, retryPolicy, retry_count);
            // <============= QUIT
          } else {
            throw new Error(`Request failed after ${retry_count} retries. ${JSON.stringify(response)}`);
          }
        } else {
          // go to next request in line
          this.processNextRequest();
          // return data as is
          return { status_code: response.status_code, data: respBody };
          // <============= QUIT
        }
      }
    } else {
      // HANDLE error codes
      if (respBody.error_code === 'auth_required') {
        if (this.credentials.challenge !== respBody.result.challenge) {
          this.info('Fbx authed operation requested without credentials');
          this.info(JSON.stringify(response.data));
          const newSessionToken = await this.freeboxSession.session(this.credentials.token, respBody.result.challenge);
          if (newSessionToken === null) {
            if (retryPolicy === RetryPolicy.AUTO_RETRY) {
              this.warn('Freebox OS returned a null sessionToken. Trying again...');
              retry_count += 1;
              await this.delay(this.RETRY_TIMEOUT);
              return this.request(method, url, body, retryPolicy, retry_count);
              // <============= QUIT
            } else {
              throw new Error('Null sessionToken');
            }
          }
          this.authCallback({
            token: this.credentials.token,
            session_token: newSessionToken,
            track_id: this.credentials.track_id!,
            challenge: respBody.result.challenge,
          });
          return this.request(method, url, body, retryPolicy, retry_count);
          // <============= QUIT
        } else {
          throw new Error(`auth_required but credential match ?! ${respBody}`);
        }
      } else if (respBody.error_code === 'insufficient_rights') {
        // NO RIGHTS
        if (retryPolicy === RetryPolicy.AUTO_RETRY) {
          this.warn(`Insufficient rights to request home API (${respBody.missing_right}). Trying again...`);
          retry_count += 1;
          await this.delay(this.RETRY_TIMEOUT);
          return this.request(method, url, body, retryPolicy, retry_count);
          // <============= QUIT
        } else {
          throw new Error(`Insufficient rights to request home API (${respBody.missing_right}). ${JSON.stringify(response)}`);
        }
      } else if (respBody.error_code === 'retry_later') {
        this.debug('Server asked to retry later !');
        if (retryPolicy === RetryPolicy.AUTO_RETRY) {
          this.debug('Retry!');
          retry_count += 1;
          await this.delay(this.RETRY_TIMEOUT);
          return this.request(method, url, body, retryPolicy, retry_count);
          // <============= QUIT
        } else {
          this.debug('Ignore!');
          // throw new Error(`Retry later (${respBody.error_code}). ${url} ${method} ${body || 'no body'}\n${JSON.stringify(response)}`);
          // go to next request in line
          this.processNextRequest();
          // return data as is
          return { status_code: response.status_code, data: respBody };
          // <============= QUIT
        }
      } else if (respBody.error_code === 'not_updated') {
        throw new DataNotUpdatedError(`Data not updated yet, try again later ${JSON.stringify(response)}`);
      } else {
        throw new Error(`UNHANDLED error code ${respBody.error_code} ... ${JSON.stringify(respBody)}`);
      }
    }
    // } else if (respBody.success === false) {
    //   if (retry_count < 3) {
    //     retry_count+=1;
    //     await this.delay(this.RETRY_TIMEOUT);
    //     return this.request(method, url, body, retryPolicy, retry_count);
    //   } else {
    //     this.RETRY_COUNT = 0;
    //     throw new Error(`Request failed after retries. ${JSON.stringify(response)}`);
    //   }
    // }
    // } else {
    //   this.processNextRequest();
    //   return { status_code: response.status_code, data: respBody };
    // }
  }


  private async processQueue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void,
  ): Promise<void> {
    while (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      if (next) {
        try {
          const result = await this.startRequest(next.method, next.url, next.body, next.retry_policy);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    }
  }

  private processNextRequest(): void {
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue[0];
      setTimeout(() => {
        this.startRequest(next.method, next.url, next.body, next.retry_policy);
      }, 500);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
