import { Logging } from 'homebridge';
import { setTimeout as sleep } from 'timers/promises';
import {
  FBXEndPointResult,
  FBXHomeNode,
  FBXHomeNodeCategory,
  FBXHomeNodeEndpoint,
  FBXHomeNodeEndpointValue,
  FBXNodeAccessMode,
} from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';

export interface FBXBlind {
  nodeid: number;
  displayName: string;
  show_endpoints: Array<FBXHomeNodeEndpoint>;
  endpoints: Array<FBXHomeNodeEndpoint>;
  current_position: number | null;
  current_target_position: number | null;
}
export interface BlindPosValue {
  value: number | null;
}

export class ShuttersController {
  private freeboxRequest!: FreeboxRequest;

  private storedBlinds: Array<FBXBlind> = [];
  constructor(
    public readonly log: Logging,
    freeboxRequest: FreeboxRequest,
    // private readonly freeboxAddress: string,
    // private readonly freeboxApiVersion: string,
    private readonly apiUrl: string,
  ) {
    this.freeboxRequest = freeboxRequest;
    this.debug('Create Shutters controller');
  }

  private debug(s: string) {
    this.log.debug(`ShuttersController -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`ShuttersController -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`ShuttersController -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`ShuttersController -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`ShuttersController -> ${s}`);
  }

  private isValidShutterPosition(pos: number): boolean {
    return pos >= 0 && pos <= 100;
  }

  getBlinds(nodes: Array<FBXHomeNode>): Array<FBXBlind> {
    const rval: Array<FBXBlind> = [];
    // const url = `${this.apiUrl}/home/nodes`;
    // const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.AUTO_RETRY);
    // if (result.status_code !== 200) {
    //   this.debug(`received error ${result.status_code} to ${url}`);
    //   return rval;
    // }
    // const data: FBXNodesResult = result.data as FBXNodesResult;
    // if (data !== null) {
    //   if (data.success) {
    for (const node of nodes) {
      if (node.category === FBXHomeNodeCategory.shutter) { //== 'shutter') {
        const o: FBXBlind = {
          nodeid: node.id,
          displayName: node.label,
          show_endpoints: node.show_endpoints,
          endpoints: node.type.endpoints,
          current_position: null,
          current_target_position: null,
        };
        this.debug('found store/shutter=' + o.nodeid + '->' + o.displayName);
        // console.log(JSON.stringify(node))
        rval.push(o);
      }
    }
    //   } else {
    //     this.warn(`Request result said status failed. ${data} for ${url}`);
    //   }
    // } else {
    //   this.warn(`Request result gave no data for ${url}`);
    // }
    this.storedBlinds = rval;
    return rval;
  }

  private getEndPointIdWithNameAndAccess(
    blind: FBXBlind,
    name: string,
    rw_status: FBXNodeAccessMode | null,
  ): number | null {
    if (blind === null) {
      return null;
    }
    for (const endpoint of blind.show_endpoints) {
      if (endpoint.name !== name) {
        continue;
      }
      if (endpoint.access !== null && endpoint.access! === rw_status) {
        // this.debug(`getEndPointIdWithName -> FOUND ! for ${blind.displayName} endpoint ${name} with access ${rw_status}
        //     ==> endpoint id=${endpoint.id}`);
        return endpoint.id;
      } else {
        // this.debug(`getEndPointIdWithName -> no access level data defined for ${blind.displayName} endpoint ${name}`);
        // this.debug('getEndPointIdWithName -> trying ui data');
        if (endpoint.ui !== null && endpoint.ui!.access === rw_status) {
          // this.debug(`getEndPointIdWithName -> FOUND in ui ! for ${blind.displayName} endpoint ${name} with access ${rw_status}
          //   ==> endpoint id=${endpoint.id}`);
          return endpoint.id;
        }
      }
    }
    return null;
  }

  private getEndPointIdWithName(
    blind: FBXBlind,
    name: string,
  ): number | null {
    if (blind === null) {
      return null;
    }
    for (const endpoint of blind.show_endpoints) {
      if (endpoint.name !== name) {
        continue;
      }
      if (endpoint.access !== null) {
        // this.debug(`getEndPointIdWithName -> FOUND ! for ${blind.displayName} endpoint ${name} with access ${rw_status}
        //     ==> endpoint id=${endpoint.id}`);
        return endpoint.id;
      } else {
        // this.debug(`getEndPointIdWithName -> no access level data defined for ${blind.displayName} endpoint ${name}`);
        // this.debug('getEndPointIdWithName -> trying ui data');
        if (endpoint.ui !== null) {
          // this.debug(`getEndPointIdWithName -> FOUND in ui ! for ${blind.displayName} endpoint ${name} with access ${rw_status}
          //   ==> endpoint id=${endpoint.id}`);
          return endpoint.id;
        }
      }
    }
    return null;
  }

  private getBlindAtIndex(blind_index: number): FBXBlind {
    if (blind_index < 0 && blind_index >= this.storedBlinds.length) {
      throw new Error(`Failed to get blind at index ${blind_index} : index out of bounds.
            There are ${this.storedBlinds.length} blinds knowns so far`);
    }
    return this.storedBlinds[blind_index];
  }

  private async executeCommand(
    blind_index: number,
    // cmdDisplayName:string,
    expected_end_point_name: string,
    access_mode: FBXNodeAccessMode | null,
    http_method: 'GET' | 'PUT',
    value: boolean | number | null,
    // previousValue: boolean | number | null,
    // ): Promise<{ status: boolean; value: number }> {
  ): Promise<FBXHomeNodeEndpointValue | null> {
    // this.debug(`${expected_end_point_name} ${access_mode} -> blind index=${blind_index}`);
    const blind = this.getBlindAtIndex(blind_index);
    // this.debug(`${expected_end_point_name} ${access_mode} -> blind=${blind.displayName} nodeid=${blind.nodeid}`);
    const node_id = blind.nodeid;
    let ep_id: number | null = null;
    if (access_mode === null) {
      ep_id = this.getEndPointIdWithName(blind, expected_end_point_name);
    } else {
      ep_id = this.getEndPointIdWithNameAndAccess(blind, expected_end_point_name, access_mode);
    }
    if (ep_id === null) {
      this.warn(`${expected_end_point_name} -> expected endpoint with name=${expected_end_point_name} ${access_mode} not found...`);
      throw new Error(`Failed to send ${expected_end_point_name} to blind ${blind.displayName} (nodeid=${node_id}).
                No valid endpointid found (expected=${expected_end_point_name})`);
    }
    const blind_debug_str = `blind ${blind.displayName} (nodeid=${node_id}), endpointid=${ep_id})`;
    const url = `${this.apiUrl}/home/endpoints/${node_id}/${ep_id}`;
    // this.debug(`${blind.displayName} => prepare call ${url}`);
    let payload: unknown = null;
    if (http_method === 'PUT' && value !== null && typeof (value) === 'number') {
      const posValid = this.isValidShutterPosition(value! as number);
      if (!posValid) {
        throw new RangeError(`Won't send cmd to ${blind_debug_str}. Position value invalid ${value} (valid range is [0,100])`);
      }
      payload = { 'value': value };
      // return null;
    }
    // try {
    // this.debug(`${blind.displayName} => perform call ${url}`);
    const result: FBXRequestResult = await this.freeboxRequest.request(
      http_method,
      url,
      payload,
      RetryPolicy.NO_RETRY);
    // RetryPolicy.AUTO_RETRY);
    // this.debug(`${blind.displayName} => call result = ${JSON.stringify(result)}`);
    if (result === null) {
      throw new Error(`Failed to send ${url} ${http_method} ${blind_debug_str}. No HTTP body response`);
    }
    const data: FBXEndPointResult = result.data as FBXEndPointResult;
    // this.debug(`${blind.displayName} => ${JSON.stringify(data)}`);

    if (data.success === null) {
      // all strings below are for linter
      const msg_info = 'No "success" in reply';
      const msg_additional_data = `statusCode=${result.status_code} body=${JSON.stringify(data)}`;
      this.warn(`${url} ${http_method} -> ${blind_debug_str} -> ${msg_info}`);
      this.warn(`${url} ${http_method} -> ${blind_debug_str} -> ${msg_additional_data}`);
      // const err_msg_perfix = `${url} ${http_method} ${blind_debug_str}`;
      // const err_msg = `${err_msg_perfix}. ${msg_info}. ${msg_additional_data}`;
      // throw new Error(err_msg);
      return null;
    } else if (data.success === false) {
      this.warn(`${url} ${http_method} -> ${blind_debug_str} -> success was false. No value found`);
      return null;
    } else {
      return data.result;
    }
  }


  async getBlindTargetPosition(blind_index: number): Promise<BlindPosValue> {
    const blind = this.getBlindAtIndex(blind_index);
    // this.debug('getBlindTargetPosition ' + blind.displayName + '@' + blind.nodeid);
    const rval = await this.executeCommand(
      blind_index,
      'position_set',
      'w',
      'GET', // get the write data in GET mode ?!
      null,
    );
    if (rval !== null && rval !== undefined) {
      if (rval.value_type !== null && rval.value_type !== undefined) {
        if (rval.value_type === 'int') {
          const v: number = parseInt(rval.value);
          blind.current_target_position = v;
          // this.debug('getBlindTargetPosition ' + blind.displayName + '@' + blind.nodeid + ' targetpos=' + v);
        } else {
          throw new EvalError(`Expected int type for result... got ${JSON.stringify(rval)}`);
        }
      } else {
        throw new EvalError(`No value type in reply ? ${JSON.stringify(rval)}`);
      }
      if (rval.refresh !== null && rval.refresh !== undefined) {
        this.debug('Freebox returned refresh wait ' + rval.refresh + ' ms');
        this.debug('sleep for '+ rval.refresh+ ' ms');
        await sleep(rval.refresh, '');
      }
    }
    return { value: blind.current_target_position };
  }

  async getBlindCurrentPosition(blind_index: number): Promise<BlindPosValue> {
    const blind = this.getBlindAtIndex(blind_index);
    // this.debug('getBlindCurrentPosition ' + blind.displayName + '@' + blind.nodeid);
    const rval = await this.executeCommand(
      blind_index,
      'position_set',
      'r',
      'GET',
      null,
    );
    if (rval !== null && rval !== undefined) {
      if (rval.value_type !== null && rval.value_type !== undefined) {
        if (rval.value_type === 'int') {
          const v: number = parseInt(rval.value);
          blind.current_position = v;
        } else {
          throw new EvalError(`Expected int type for result... got ${JSON.stringify(rval)}`);
        }
      } else {
        throw new EvalError(`Expected int type for result... no value type defined ?! ${JSON.stringify(rval)}`);
      }
      if (rval.refresh !== null && rval.refresh !== undefined) {
        this.debug('Freebox returned refresh wait ' + rval.refresh + ' ms');
        this.debug('sleep for '+ rval.refresh+ ' ms');
        await sleep(rval.refresh, '');
      }
    }
    return { value: blind.current_position };
  }

  async setBlindPosition(blind_index: number, value: number): Promise<boolean> {
    const blind = this.getBlindAtIndex(blind_index);
    // this.debug('setBlindPosition ' + blind.displayName + '@' + blind.nodeid);
    const rval = await this.executeCommand(
      blind_index,
      //   'setBlindPosition',
      'position_set',
      'w',
      'PUT',
      value,
    );
    if (rval !== null) {
      if (rval.value_type === 'bool') {
        const v: boolean = JSON.parse(rval.value); // as unknown as boolean;
        if (v) { // TODO: necessary ?
          blind.current_target_position = value;
        }
        return v;
      } else {
        throw new EvalError(`Expected bool type for result... got ${JSON.stringify(rval)}`);
      }
    }
    return false;
  }

  async stopBlind(blind_index: number): Promise<boolean> {
    const blind = this.getBlindAtIndex(blind_index);
    this.debug('stopBlind ' + blind.displayName + '@' + blind.nodeid);
    const rval = await this.executeCommand(
      blind_index,
      //   'stopBlind',
      'stop',
      'w',
      'PUT',
      true,
    );
    if (rval !== null) {
      if (rval.value_type === 'bool') {
        const v: boolean = JSON.parse(rval.value); // as unknown as boolean;
        return v;
      } else {
        throw new EvalError(`Expected bool type for result... got ${JSON.stringify(rval)}`);
      }
    }
    return false;
  }

  async toggleBlind(blind_index: number): Promise<boolean> {
    const blind = this.getBlindAtIndex(blind_index);
    this.debug('toggleBlind ' + blind.displayName + '@' + blind.nodeid);
    const rval = await this.executeCommand(
      blind_index,
      //   'toggleBlind',
      'toggle',
      'w',
      'PUT',
      true,
    );
    if (rval !== null) {
      if (rval.value_type === 'bool') {
        const v: boolean = JSON.parse(rval.value); // as unknown as boolean;
        return v;
      } else {
        throw new EvalError(`Expected bool type for result... got ${JSON.stringify(rval)}`);
      }
    }
    return false;
  }

  async openBlind(blind_index: number): Promise<boolean> {
    const blind = this.getBlindAtIndex(blind_index);
    this.debug('openBlind ' + blind.displayName + '@' + blind.nodeid);
    return this.setBlindPosition(blind_index, 0);
  }

  async closeBlind(blind_index: number): Promise<boolean> {
    const blind = this.getBlindAtIndex(blind_index);
    this.debug('closeBlind ' + blind.displayName + '@' + blind.nodeid);
    return this.setBlindPosition(blind_index, 100);
  }
}