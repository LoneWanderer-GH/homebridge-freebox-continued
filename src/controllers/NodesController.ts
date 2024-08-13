import { Logging } from 'homebridge';
// import { setTimeout as sleep } from 'timers/promises';
import { FBXHomeNode, FBXNodesResult } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';

export class NodesController {
    private freeboxRequest!: FreeboxRequest;

    constructor(
        public readonly log: Logging,
        freeboxRequest: FreeboxRequest,
        private readonly apiUrl: string,
    ) {
        this.freeboxRequest = freeboxRequest;
        this.debug('Create Alarm controller');
    }

    private debug(s: string) {
        this.log.debug(`NodesController -> ${s}`);
    }

    private info(s: string) {
        this.log.info(`NodesController -> ${s}`);
    }

    private warn(s: string) {
        this.log.warn(`NodesController -> ${s}`);
    }

    private error(s: string) {
        this.log.error(`NodesController -> ${s}`);
    }

    private success(s: string) {
        this.log.success(`NodesController -> ${s}`);
    }

    async getNodes(): Promise<Array<FBXHomeNode>> {
        const url = `${this.apiUrl}/home/nodes`;
        const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.AUTO_RETRY);
        const data: FBXNodesResult = result.data as FBXNodesResult;
        if (result.status_code === 200 && data.success) {
            // this.nodes = data.result;
            return data.result;
        }
        throw new Error("No Home nodes found on Freebox ?!");
    }

}