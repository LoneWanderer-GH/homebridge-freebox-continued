import { Logging } from 'homebridge';
import { FBXHomeNode, FBXNodesResult } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';
import { PluginLogger } from '../PluginLogger.js';

export class NodesController {
  private freeboxRequest!: FreeboxRequest;
  private readonly logger: PluginLogger;

  constructor(
    public readonly log: Logging,
    freeboxRequest: FreeboxRequest,
    private readonly apiUrl: string,
  ) {
    this.freeboxRequest = freeboxRequest;
    this.logger = new PluginLogger(this.log, 'NodesController');
    this.logger.debug('Create Nodes controller');
  }


  async getNodes(): Promise<Array<FBXHomeNode>> {
    const url = `${this.apiUrl}/home/nodes`;
    const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.AUTO_RETRY);
    const data: FBXNodesResult = result.data as FBXNodesResult;
    if (result.status_code === 200 && data.success) {
      // this.nodes = data.result;
      return data.result;
    }
    throw new Error('No Home nodes found on Freebox ?!');
  }

}