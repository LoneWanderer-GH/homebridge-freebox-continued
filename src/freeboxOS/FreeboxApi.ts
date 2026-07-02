import { Logging } from 'homebridge';
import { PluginLogger } from '../PluginLogger.js';
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


const MAX_API_DISCOVERY_RETRIES = 10;

export class FreeboxController {
  private readonly logger: PluginLogger;


  // private freeboxRequest!: FreeboxRequest;
  private apiInfoUrl: string;
  private apiInfoRetryDelayMs: number = 2000;
  private apiDiscoveryAttempts: number = 0;
  public apiInfo: FBXApiVersion | null = null;

  constructor(
    public readonly log: Logging,
    public readonly network: Network,
    private readonly freeboxAddress: string,
  ) {
    this.logger = new PluginLogger(this.log, 'FreeboxController');

    // this.freeboxRequest = freeboxRequest;
    this.apiInfoUrl = `http://${this.freeboxAddress}/api_version`;
  }


  getApiInfo(): FBXApiVersion {
    if (this.apiInfo === null) {
      throw Error('NOT YET OBTAINED ?!');
    }
    return this.apiInfo;
  }

  async getActualApiUrl(): Promise<FBXAPI> {
    this.logger.info('Discovering Freebox API configuration');
    const apiVersionData: FBXRequestResult = await this.network.request(
      'GET',
      this.apiInfoUrl,
      {},
      null,
      true,
      10000, // 10 second timeout for API discovery
    );
    if (apiVersionData.status_code === 200) {
      this.apiDiscoveryAttempts = 0;
      this.logger.success('Freebox API configuration ' + JSON.stringify(apiVersionData));
      this.apiInfo = apiVersionData.data as FBXApiVersion;
      const majorVersion = this.apiInfo.api_version.split('.')[0];
      return {
        httpUrl: `http://${this.freeboxAddress}${this.apiInfo.api_base_url}v${majorVersion}`,
        // httpsUrl: `https://${this.freeboxAddress}${this.apiInfo.api_base_url}v${majorVersion}`,
        httpsUrl: `https://${this.apiInfo.api_domain}:${this.apiInfo.https_port}${this.apiInfo.api_base_url}v${majorVersion}`,
        webSocketurl: `wss://${this.apiInfo.api_domain}:${this.apiInfo.https_port}${this.apiInfo.api_base_url}v${majorVersion}/ws`,
      };
    } else {
      this.apiDiscoveryAttempts++;
      if (this.apiDiscoveryAttempts >= MAX_API_DISCOVERY_RETRIES) {
        this.apiDiscoveryAttempts = 0;
        throw new Error(`Could not reach Freebox API at ${this.apiInfoUrl} after ${MAX_API_DISCOVERY_RETRIES} attempts. Check freeBoxAddress in config.`);
      }
      this.logger.warn(`No valid response from ${this.apiInfoUrl} ... retry ${this.apiDiscoveryAttempts}/${MAX_API_DISCOVERY_RETRIES} in ${this.apiInfoRetryDelayMs}ms`);
      this.logger.warn(JSON.stringify(apiVersionData));
      // eslint-disable-next-line
      const _finished = await sleep(this.apiInfoRetryDelayMs, '');
      return await this.getActualApiUrl();
    }
  }
}

