import { Logging } from 'homebridge';
import { FBXRequestResult, Network } from '../network/Network.js';
// import { createHmac } from 'node:crypto';
import * as crypto from 'crypto';
import { setTimeout as sleep } from 'timers/promises';

export interface FBXLoginSessionReply {
  msg?: string;
  success: boolean;
  uid?: string;
  error_code?: string;
  missing_right?:string;
  result: {
    session_token: string;
    challenge: string;
    permissions: {
      settings?: boolean;
      contacts?: boolean;
      calls?: boolean;
      explorer?: boolean;
      downloader?: boolean;
      parental?: boolean;
      pvr?: boolean;
      profile?: boolean;
    };
  };
}

export interface FBXAuthInfo {
  app_token: string;
  track_id: number;
}
interface FBXLoginAuthReply {
  success: boolean;
  result: FBXAuthInfo;
}
export interface FBXLoginAuthTrackIdReply {
  success: boolean;
  result: {
    status: string;
    challenge: string;
  };
}

export enum FBXAuthorizationStatus {
  /** The authorization request is still pending and awaiting user validation */
  Pending = 'pending',

  /** The authorization request has timed out without user action */
  Timeout = 'timeout',

  /** The authorization request was granted by the user */
  Granted = 'granted',

  /** The authorization request was denied by the user */
  Denied = 'denied',

  /** The authorization request has been canceled */
  Canceled = 'canceled',
}
function convertStringToEnum(value: string): FBXAuthorizationStatus | undefined {
  return (Object.values(FBXAuthorizationStatus) as Array<string>).includes(value) ? (value as FBXAuthorizationStatus) : undefined;
}
interface FBXAuthStatus {
  status: FBXAuthorizationStatus;
  challenge: string | null;
}
export interface FBXSessionCredentials {
  token: string | null;
  session_token: string | null;
  track_id: number;
  challenge: string | null;
}
export class FreeboxSession {
  // will try every RETRY_TIMEOUT with a delay of RETRY_COUNT
  static readonly RETRY_TIMEOUT = 2000; // 2 seconds
  static readonly RETRY_COUNT = 30;

  private accessAttemptCount = 0;
  private sessionAttemptCount = 0;

  // const network = new Network();
  constructor(
    public readonly log: Logging,
    public readonly network: Network,
    // private readonly freeboxAddress:string,
    // private readonly freeboxApiVersion:string,
    private readonly apiUrl:string,
  ) {

  }

  private debug(s: string) {
    this.log.debug(`FreeboxSession -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`FreeboxSession -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`FreeboxSession -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`FreeboxSession -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`FreeboxSession -> ${s}`);
  }

  // Setup the complete auth process.
  // This method is exposed and will be called when the server starts.
  async fbx(token: string | null, trackId: number | null): Promise<FBXSessionCredentials> {
    const null_return: FBXSessionCredentials = { token: null, session_token: null, track_id: 0, challenge: null };
    if ((token === null || token === 'null') || (trackId === null || trackId === 0)) {
      const [new_token, new_trackId] = await this.auth();
      if (new_token !== null && new_trackId !== null) {
        const [challenge, sessionToken] = await this.start(new_token, new_trackId); //, (challenge: string, sessionToken: string) => {
        if (challenge !== null || sessionToken !== null) {
          // callback(new_token, sessionToken, new_trackId, challenge);
          return { token: new_token, session_token: sessionToken, track_id: new_trackId, challenge: challenge };
        } else {
          this.warn('Challenge or session is null');
          // callback(null, null, null, null);
          return null_return;
        }
        // });
      } else {
        this.warn('Token or trackid is null');
        // callback(null, null, null, null);
        return null_return;
      }
    } else {
      this.info('Starting session with existing token');
      const [challenge, sessionToken] = await this.start(token, trackId); // (challenge: string, sessionToken: string) => {
      if (challenge !== null && sessionToken !== null) {
        // callback(token, sessionToken, trackId, challenge);
        return { token: token, session_token: sessionToken, track_id: trackId, challenge: challenge };
      } else {
        this.warn('Challenge or session is null, with existing track/token');
        // callback(null, null, null, null);
        return null_return;
      }
    }
  }

  // Get a token and a trackId.
  async auth(): Promise<[string | null, number | null]> {
    const url = `${this.apiUrl}/login/authorize/`;
    const data = {
      app_id: 'hb.fbx-home',
      app_name: 'Homebridge-Freebox',
      app_version: '1.0',
      device_name: 'server',
    };
    const header = {};
    const request_result = await this.network.request('POST', url, header, data);
    // console.log(JSON.stringify(request_result));
    const body = request_result.data as FBXLoginAuthReply;
    if (body === null) {
      this.error(`Request ${url} failed. No body received ...`);
      return [null, null];
    }
    if (!body.success) {
      this.error(`Request ${url} failed. Reply: ${JSON.stringify(body)}`);
      return [null, null];
    }
    const trackId = body.result.track_id;
    const token = body.result.app_token;
    return [token, trackId];
  }

  // Start a session with a token and a trackId.
  async start(token: string, trackId: number): Promise<[string | null, string | null]> {
    const accessData: FBXAuthStatus = await this.grantAccess(trackId);
    if (accessData.status === FBXAuthorizationStatus.Granted) {// 1 GRANTED
      this.accessAttemptCount = 0;
      if (token !== null || accessData.challenge !== null) {
        const sessionToken = await this.session(token, accessData.challenge);
        return [accessData.challenge, sessionToken];
      } else {
        const _res = await sleep(FreeboxSession.RETRY_TIMEOUT, '');
        this.warn('Challenge or token is null');
        return await this.start(token, trackId);
      }
    } else if (accessData.status === FBXAuthorizationStatus.Canceled
      || accessData.status === FBXAuthorizationStatus.Denied
      || accessData.status === FBXAuthorizationStatus.Timeout) {
      this.info('Operation canceled after ' + this.accessAttemptCount + ' attempt, access has not been granted');
      this.sessionAttemptCount = 0;
      return [null, null];
    } else if (accessData.status === FBXAuthorizationStatus.Pending) {
      const _res = await sleep(FreeboxSession.RETRY_TIMEOUT, '');
      if (this.accessAttemptCount < Number.MAX_SAFE_INTEGER) {
        this.accessAttemptCount++;
        this.info('Trying again, attempt ' + this.accessAttemptCount);
        return await this.start(token, trackId);
      } else {
        this.info('Operation canceled after ' + this.accessAttemptCount + ' attempt');
        this.sessionAttemptCount = 0;
        return [null, null];
      }
    } else {
      // not reachable
    }
    return [null, null]; // safety
  }

  // Check for the access to be granted (user has taped the check mark on the box).
  async grantAccess(trackId: number): Promise<FBXAuthStatus> { //, callback: Function) {
    const url = `${this.apiUrl}/login/authorize/${trackId}`;
    const fbxREquestResult = await this.network.request('GET', url, {}); //, (_statusCode: number, body: FBXLoginAuthTrackIdReply) => {
    const body = fbxREquestResult.data as FBXLoginAuthTrackIdReply;
    if (body === null) {
      this.warn('Unable to check access');
      return { status: FBXAuthorizationStatus.Denied, challenge: null };
    }
    if (body.result === null) {
      this.warn('Unable to check access');
      return { status: FBXAuthorizationStatus.Denied, challenge: null };
    }
    // const status: FBXAuthorizationStatus = FBXAuthorizationStatus[body.result.status as keyof typeof FBXAuthorizationStatus];
    const status: FBXAuthorizationStatus|undefined = convertStringToEnum(body.result.status);
    switch (status) {
      case FBXAuthorizationStatus.Granted:  // body.result.status == 'granted'
        return { status: status, challenge: body.result.challenge }; // 1 GRANTED
      case FBXAuthorizationStatus.Pending: // body.result.status == 'pending'
        this.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        this.warn('Pending access, check your Freebox device and manually accept the app request');
        this.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        return { status: status, challenge: null }; // 2 PENDING
      case FBXAuthorizationStatus.Denied:
      case FBXAuthorizationStatus.Canceled:
      case FBXAuthorizationStatus.Timeout:
        this.warn('Access status: ' + status);
        return { status: status, challenge: null }; // 0 DENIED
      default:
        this.error(`Status not recognized ${status}`);
        this.error(`    Reply was: ${JSON.stringify(body)}`);
        // return { status: FBXAuthorizationStatus.Denied, challenge: null }; // 0 DENIED
        throw new Error(`Status not recognized ${status} (Reply was: ${JSON.stringify(body)})`);
    }
  }

  // Request a session with a token and a challenge.
  // This method is exposed and will be called whenever the session needs to be renewed.
  async session(token: string | null, challenge: string | null): Promise<string | null> {
    if (challenge === null || token === null) {
      this.info('Operation canceled : token and/or challenge doesn\'t seem good');
      return null;
    } else {
      // const password = crypto.HmacSHA1(challenge, token).toString();
      const password = crypto.createHmac('sha1', token)
        .update(challenge)
        .digest('hex');
      const url = `${this.apiUrl}/login/session`;
      const header = {
        'X-Fbx-App-Auth': token,
      };
      const data = {
        'app_id': 'hb.fbx-home',
        'app_version': '1.0',
        'password': password,
      };
      const fbxResult: FBXRequestResult = await this.network.request('POST', url, header, data);
      const body = fbxResult.data as FBXLoginSessionReply;
      if (body.success === false) {
        this.warn('Unable to start session');
        const _res = await sleep(FreeboxSession.RETRY_TIMEOUT, '');
        if (this.sessionAttemptCount < FreeboxSession.RETRY_COUNT) {
          this.sessionAttemptCount++;
          this.info('Trying again, attempt ' + this.sessionAttemptCount);
          return this.session(token, body.result.challenge);// callback);
        } else {
          this.info('Operation canceled after ' + this.sessionAttemptCount + ' attempt');
          return null;
        }
      } else {
        this.sessionAttemptCount = 0;
        this.info('Session started');
        return body.result.session_token;
      }
    }
  }
}