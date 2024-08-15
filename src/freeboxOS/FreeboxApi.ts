import { Logging } from 'homebridge';
// import { setTimeout as sleep } from 'timers/promises';
// import { FBXEndPointResult, FBXHomeNode, FBXHomeNodeCategory, FBXNodesResult } from '../FreeboxHomeTypes/FBXHomeTypes.js';
// import { FreeboxRequest, RetryPolicy } from './FreeboxRequest.js';
import { setTimeout as sleep } from 'timers/promises';
import { FBXRequestResult, Network } from '../network/Network.js';

export interface FBXApiVersion {
  box_model_name: string; //: "Freebox v7 (r1)",
  api_base_url: string; //: "/api/",
  https_port: number; //: 2565,
  device_name: string; //: "Freebox Server",
  https_available: boolean; //: true,
  box_model: string; //: "fbxgw7-r1/full",
  api_domain: string; //: "vjenuw7r.fbxos.fr",
  uid: string; //: "91e50ecc2c9b1066466e8795947e1f9f",
  api_version: string; //: "12.0",
  device_type: string; //: "FreeboxServer7,1"
}

export interface FBXAPI {
  httpUrl: string;
  httpsUrl: string;
  webSocketurl: string;
}


export class FreeboxController {
  // private freeboxRequest!: FreeboxRequest;
  private apiInfoUrl: string;
  private apiInfoRetryDelayMs: number = 2000;

  constructor(
    public readonly log: Logging,
    public readonly network: Network,
    private readonly freeboxAddress: string,
  ) {
    // this.freeboxRequest = freeboxRequest;
    this.apiInfoUrl = `https://${this.freeboxAddress}/api_version`;
  }

  private debug(s: string) {
    this.log.debug(`FreeboxController -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`FreeboxController -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`FreeboxController -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`FreeboxController -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`FreeboxController -> ${s}`);
  }

  async getActualApiUrl(): Promise<FBXAPI> {
    this.info('Discovering Freebox API configuration');
    const apiVersionData: FBXRequestResult = await this.network.request(
      'GET',
      this.apiInfoUrl,
      {},
      null);
    if (apiVersionData.status_code === 200) {
      this.success('Freebox API configuration ' + JSON.stringify(apiVersionData));
      const apiInfo: FBXApiVersion = apiVersionData.data as FBXApiVersion;
      const majorVersion = apiInfo.api_version.split('.')[0];
      return {
        httpUrl: `http://${this.freeboxAddress}${apiInfo.api_base_url}v${majorVersion}`,
        // httpsUrl: `https://${this.freeboxAddress}:${apiInfo.https_port}${apiInfo.api_base_url}v${majorVersion}`,
        httpsUrl: `https://${apiInfo.api_domain}:${apiInfo.https_port}${apiInfo.api_base_url}v${majorVersion}`,
        webSocketurl: `wss://${apiInfo.api_domain}:${apiInfo.https_port}${apiInfo.api_base_url}v${majorVersion}/ws`,
      };
    } else {
      this.warn(`No valid response from ${this.apiInfoUrl} ... retry in ${this.apiInfoRetryDelayMs}`);
      this.warn(JSON.stringify(apiVersionData));
      const _finished = await sleep(this.apiInfoRetryDelayMs, '');
      return await this.getActualApiUrl();
    }
  }
}

