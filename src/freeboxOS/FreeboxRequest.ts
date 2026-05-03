import { Logging } from 'homebridge';
import { FBXRequestResult, Network } from '../network/Network.js';
import { FBXAuthInfo, FBXSessionCredentials, FreeboxSession, FBXLoginSessionReply } from './FreeboxSession.js';

// import { setTimeout as sleep } from 'timers/promises';

export interface StoredCredentials {
  trackId: number | null;
  token: string | null;
}

export enum RetryPolicy {
  NO_RETRY,
  AUTO_RETRY,
}

export interface RequestQueueItem {
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
  // private RETRY_COUNT = 0;

  //   private credentials: Credentials = {
  //     challenge: null,
  //     session: null,
  //     trackId: null,
  //     token: null,
  //   };

  private requestQueue: RequestQueueItem[] = [];

  // private freeboxSession: FreeboxSession;
  public credentials: FBXSessionCredentials;

  constructor(
    public readonly log: Logging,
    public readonly network: Network,
    // private readonly freeboxAddress:string,
    // private readonly freeboxApiVersion:string,
    // private readonly apiUrl:string,
    private readonly freeboxSession: FreeboxSession,
  ) {
    // this.freeboxSession = new FreeboxSession(this.log, this.network, this.apiUrl); // this.freeboxAddress, this.freeboxApiVersion);

    this.credentials = {
      challenge: '',
      session_token: '',
      track_id: 0,
      token: '',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(s: string, ...parameters: any[]) {
    this.log.debug(`FreeboxRequest -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private info(s: string, ...parameters: any[]) {
    this.log.info(`FreeboxRequest -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private warn(s: string, ...parameters: any[]) {
    this.log.warn(`FreeboxRequest -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private error(s: string, ...parameters: any[]) {
    this.log.error(`FreeboxRequest -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private success(s: string, ...parameters: any[]) {
    this.log.success(`FreeboxRequest -> ${s}`, parameters);
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

  // async request(method: RequestQueueItem['method'], url: string, body: unknown, autoRetry = true): Promise<FBXRequestResult> {
  async request(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
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

  private addToQueue(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
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

  private async _treat_reply_failed(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number,
    response: FBXRequestResult,
    respBody: FBXLoginSessionReply,
  ): Promise<FBXRequestResult> {
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

  private async _treat_error_code_retry_later(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number,
    response: FBXRequestResult,
    respBody: FBXLoginSessionReply,
  ): Promise<FBXRequestResult> {
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
      await this.delay(this.RETRY_TIMEOUT); // wait a bit... maybe overwelmed ?!
      this.processNextRequest();
      // return data as is
      return { status_code: response.status_code, data: respBody };
      // <============= QUIT
    }
  }

  private async _treat_error_code_insufficient_rights(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number,
    response: FBXRequestResult,
    respBody: FBXLoginSessionReply,
  ): Promise<FBXRequestResult> {
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
  }

  private async _treat_error_code_auth_required(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number,
    _response: FBXRequestResult, // TODO: unused
    respBody: FBXLoginSessionReply,
  ): Promise<FBXRequestResult> {
    if (this.credentials.challenge !== respBody.result.challenge) {
      this.info('Fbx authed operation requested without credentialsm received salt & challenge');
      // this.info(JSON.stringify(response.data));
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
      throw new Error(`auth_required but credential match ?! ${JSON.stringify(respBody)}`);
    }
  }

  private async _treat_error_codes(
    method: RequestQueueItem['method'],
    url: string,
    body: unknown,
    retryPolicy: RetryPolicy,
    retry_count: number,
    response: FBXRequestResult,
    respBody: FBXLoginSessionReply,
  ): Promise<FBXRequestResult> {
    // HANDLE error codes
    if (respBody.error_code === 'auth_required') {
      return this._treat_error_code_auth_required(
        method,
        url,
        body,
        retryPolicy,
        retry_count,
        response,
        respBody,
      );
    } else if (respBody.error_code === 'insufficient_rights') {
      return this._treat_error_code_insufficient_rights(
        method,
        url,
        body,
        retryPolicy,
        retry_count,
        response,
        respBody,
      );
    } else if (respBody.error_code === 'retry_later') {
      return this._treat_error_code_retry_later(
        method,
        url,
        body,
        retryPolicy,
        retry_count,
        response,
        respBody,
      );
    } else if (respBody.error_code === 'not_updated') {
      throw new DataNotUpdatedError(`Data not updated yet, try again later ${JSON.stringify(response)}`);
    } else {
      throw new Error(`UNHANDLED error code ${respBody.error_code} ... ${JSON.stringify(respBody)}`);
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
        return this._treat_reply_failed(
          method,
          url,
          body,
          retryPolicy,
          retry_count,
          response,
          respBody,
        );
      }
    } else {
      return this._treat_error_codes(method,
        url,
        body,
        retryPolicy,
        retry_count,
        response,
        respBody,
      );
    }
  }

  private async processQueue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void,
  ): Promise<void> {
    while (this.requestQueue.length > 0) {
      // try space out requests from one another, since we got "socket hang up" or HTTP errors 504
      await this.delay(750);
      //
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
      }, 750);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
