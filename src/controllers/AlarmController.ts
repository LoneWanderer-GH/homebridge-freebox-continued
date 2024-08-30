import { Logging } from 'homebridge';
// import { setTimeout as sleep } from 'timers/promises';
import { FBXEndPointResult, FBXHomeNode, FBXHomeNodeCategory } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';

export enum AlarmKind {
  OFF = 'off',
  MAIN_ALARM = 'alarm1', //1,
  NIGHT_ALARM = 'alarm2', //2,
}

export enum AlarmState {
  //The alarm is off
  idle = 'idle',
  //The main alarm is beeing activated, it’s a countdown when only the sensors not in the timed zone can trigger the alert
  MAIN_alarm_arming = 'alarm1_arming',
  //The night alarm is beeing activated, it’s a countdown when only the sensors not in the timed zone can trigger the alert
  NIGHT_alarm_arming = 'alarm2_arming',
  //The main alarm is on
  MAIN_alarm_armed = 'alarm1_armed',
  //The night alarm is on
  NIGHT_alarm_armed = 'alarm2_armed',
  //The main alarm has been trigged by a sensor in the timed zone and the siren will ring after a countdown
  MAIN_alarm_alert_timer = 'alarm1_alert_timer',
  //The night alarm has been trigged by a sensor in the timed zone and the siren will ring after a countdown
  NIGHT_alarm_alert_timer = 'alarm2_alert_timer',
  //The siren is ringing
  alert = 'alert',
}

export interface AlarmInfo {
  kind: AlarmKind;
  state: AlarmState;
}

export class AlarmController {
  private storedAlarmTargetKind: AlarmKind = AlarmKind.OFF;
  private storedAlarmState: AlarmState = AlarmState.idle;

  private storedAlarmNode: FBXHomeNode | null = null;
  private isArming: boolean = false;
  private freeboxRequest!: FreeboxRequest;

  private alarmKindEndPointsMap: Map<AlarmKind, number> = new Map<AlarmKind, number>();
  private stateEndPoint: number = -1;

  constructor(
    public readonly log: Logging,
    freeboxRequest: FreeboxRequest,
    // private readonly freeboxAddress: string,
    // private readonly freeboxApiVersion: string,
    private readonly apiUrl: string,
  ) {
    this.freeboxRequest = freeboxRequest;
    // this.alarmKindEndPointsMap = {
    //   AlarmKind.alarm1 =  -1,
    //   AlarmKind.alarm2 =  -1,
    //   AlarmKind.off =  -1,
    // };
    this.debug('Create Alarm controller');
  }

  private debug(s: string) {
    this.log.debug(`AlarmController -> ${s}`);
  }

  private info(s: string) {
    this.log.info(`AlarmController -> ${s}`);
  }

  private warn(s: string) {
    this.log.warn(`AlarmController -> ${s}`);
  }

  private error(s: string) {
    this.log.error(`AlarmController -> ${s}`);
  }

  private success(s: string) {
    this.log.success(`AlarmController -> ${s}`);
  }

  //   async init(freeboxRequest: FreeboxRequest) {
  //     this.freeboxRequest = freeboxRequest;
  //     const alarmNode: FBXHomeNode | null = await this.getAlarm();
  //     if (alarmNode) {
  //       this.storedAlarmNode = alarmNode;
  //       this.refreshAlarmTarget();
  //     }
  //   }

  getAlarm(nodes: Array<FBXHomeNode>): FBXHomeNode | null {
    this.debug('getAlarm');
    //const url = `${this.apiUrl}/${this.freeboxApiVersion}/home/nodes`;
    // const url = `${this.apiUrl}/home/nodes`;
    // const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.AUTO_RETRY);
    // const data: FBXNodesResult = result.data as FBXNodesResult;
    // if (result.status_code === 200 && data.success) {
    for (const node of nodes) {
      if (node.category === FBXHomeNodeCategory.alarm) { //=== 'alarm') {
        this.storedAlarmNode = node;
        this.success(`Found alarm node ! ${node.name} ${node.label}`);
        for (const ep of this.storedAlarmNode.type.endpoints) {
          if (ep.name !== null) {
            if (ep.name === 'alarm1') {
              this.alarmKindEndPointsMap.set(AlarmKind.MAIN_ALARM, ep.id);
            } else if (ep.name === 'alarm2') {
              this.alarmKindEndPointsMap.set(AlarmKind.NIGHT_ALARM, ep.id);
            } else if (ep.name === 'off') {
              this.alarmKindEndPointsMap.set(AlarmKind.OFF, ep.id);
            } else if (ep.name === 'state') {
              this.stateEndPoint = ep.id;
            } else {
              continue;
            }
          }
        }
        return node;
      }
    }
    // } else {
    //   this.warn(`Got a ${result.status_code}, unable to request: ${url}`);
    //   this.error(JSON.stringify(data));
    //   return null;
    // }
    return null;
  }

  // async getAlarmKind(): Promise<AlarmKind> {
  //   if (this.storedAlarmNode) {
  //     // const ep_id = this.getStateEndpoint();
  //     const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${this.stateEndPoint}`;
  //     this.debug('getAlarmKind - url=' + url);
  //     const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
  //     const data: FBXEndPointResult = result.data as FBXEndPointResult;
  //     if (result && data.success) {
  //       const value = data.result.value;
  //       if (data.result.value_type !== 'void' && data.result.value_type !== 'string') {
  //         this.warn(`Value type is "${data.result.value_type}", expected void or string. Reply ${JSON.stringify(data.result)}`);
  //       }
  //       if (value.includes('alarm1')) {
  //         this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
  //       } else if (value.includes('alarm2')) {
  //         this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
  //       } else {
  //         this.storedAlarmTarget = AlarmKind.OFF;
  //       }
  //     }
  //     //   const _res = await sleep(10000, '');
  //     //   this.refreshAlarmTarget();
  //   } else {
  //     //   const _res = await sleep(10000, '');
  //     //   const alarmNode: FBXHomeNode | null = await this.getAlarm();
  //     //   if (alarmNode) {
  //     //     this.storedAlarmNode = alarmNode;
  //     //     this.refreshAlarmTarget();
  //     throw new Error('No alarm node found yet ... Did discovery happened yet ?!');
  //   }
  //   return this.storedAlarmTarget;
  // }

  // private getMainEndpoint(): number {
  //   return this.getEndpointIdWithName('alarm1');
  // }

  // private getSecondaryEndpoint(): number {
  //   return this.getEndpointIdWithName('alarm2');
  // }

  // private getAlarmKindEndpoint(kind: AlarmKind): number {
  //   // return this.getEndpointIdWithName(kind);
  //   return this.alarmKindEndPointsMap[kind];
  // }

  // private getOffEndpoint(): number {
  //   return this.getEndpointIdWithName('off');
  // }

  // private getStateEndpoint(): number {
  //   return this.getEndpointIdWithName('state');
  // }

  // private getEndpointIdWithName(name: string): number {
  //   if (this.storedAlarmNode) {
  //     let id = 0;
  //     for (const endpoint of this.storedAlarmNode.type.endpoints) {
  //       if (endpoint.name === name) {
  //         return id;
  //       } else {
  //         id++;
  //       }
  //     }
  //   }
  //   throw Error(`endpoint with name ${name} not found ...`);
  // }

  private async checkAlarmActivable(target: AlarmKind): Promise<boolean> {
    if (this.storedAlarmNode) {
      this.debug('checkAlarmActivable, kind=' + JSON.stringify(target));
      if (!this.isArming) {
        // const state: AlarmState | null = await this.getAlarmState();
        const alarmInfo : AlarmInfo = await this.getAlarmKindAndState();
        if (alarmInfo.state && alarmInfo.state.includes(target.toString())) { // TODO: better/more explicit code ?
          this.info(`About to activate [${target}] while state is already [${alarmInfo.state}]`);
          return false;
        }
        if (alarmInfo.state !== AlarmState.idle) {
          return await this.setAlarmDisabled();
        } else {
          return true;
        }
      } else {
        return true;
      }
    } else {
      //   const alarmNode: FBXHomeNode | null = await this.getAlarm();
      //   if (alarmNode) {
      //     this.storedAlarmNode = alarmNode;
      //     return await this.checkAlarmActivable(target);
      //   } else {
      //     return false;
      //   }
      this.warn('No alarm node found yet ... Did discovery happened yet ?!');
      return false;
    }
  }

  // async getAlarmState(): Promise<AlarmState | null> {

  //   if (this.storedAlarmNode) {
  //     // const ep_id = this.getStateEndpoint();
  //     const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${this.stateEndPoint}`;
  //     this.debug('getAlarmState, url=' + url);
  //     // const _payload = {
  //     //   id: this.storedAlarmNode.id,
  //     //   value: null,
  //     // };
  //     const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
  //     const data: FBXEndPointResult = result.data as FBXEndPointResult;
  //     if (result && data.success) {
  //       const value = data.result.value as AlarmState; //AlarmState[data.result.value as keyof typeof AlarmState];
  //       switch (value) {
  //         //if (value === 'alarm1_armed' || value === 'alarm1_arming') {
  //         case AlarmState.MAIN_alarm_armed:
  //           this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
  //           break;
  //         case AlarmState.MAIN_alarm_arming:
  //           this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
  //           this.isArming = true;
  //           break;
  //         // } else if (value === 'alarm2_armed' || value === 'alarm2_arming') {
  //         case AlarmState.NIGHT_alarm_armed:
  //           this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
  //           break;
  //         case AlarmState.NIGHT_alarm_arming:
  //           this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
  //           this.isArming = true;
  //           break;
  //         case AlarmState.idle:
  //           this.storedAlarmTarget = AlarmKind.OFF;
  //           this.isArming = false;
  //           break;
  //         default:
  //           this.error(`WTF ?! Received Alarm state ${JSON.stringify(data.result)} => ${value}`);
  //       }
  //       // this.isArming = value.includes('arming');
  //       //   callback(value);
  //       return value;
  //     } else {
  //       //   callback(null);
  //       return null;
  //     }
  //   } else {
  //     //   const alarmNode: FBXHomeNode | null = await this.getAlarm();
  //     //   if (alarmNode) {
  //     //     this.storedAlarmNode = alarmNode;
  //     //     return await this.getAlarmState();
  //     //   } else {
  //     //     return null;
  //     //   }
  //     this.warn('No alarm node found yet ... Did discovery happened yet ?!');
  //     return null;
  //   }
  // }

  async getAlarmKindAndState(): Promise<AlarmInfo> {
    if (this.storedAlarmNode) {
      // const ep_id = this.getStateEndpoint();
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${this.stateEndPoint}`;
      // this.debug('getAlarmKindAndState, url=' + url);
      // const _payload = {
      //   id: this.storedAlarmNode.id,
      //   value: null,
      // };
      const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        this.storedAlarmState = data.result.value as AlarmState; //AlarmState[data.result.value as keyof typeof AlarmState];
        switch (this.storedAlarmState) {
          //if (value === 'alarm1_armed' || value === 'alarm1_arming') {
          case AlarmState.MAIN_alarm_armed:
            this.storedAlarmTargetKind = AlarmKind.MAIN_ALARM;
            break;
          case AlarmState.MAIN_alarm_arming:
            this.storedAlarmTargetKind = AlarmKind.MAIN_ALARM;
            this.isArming = true;
            break;
          // } else if (value === 'alarm2_armed' || value === 'alarm2_arming') {
          case AlarmState.NIGHT_alarm_armed:
            this.storedAlarmTargetKind = AlarmKind.NIGHT_ALARM;
            break;
          case AlarmState.NIGHT_alarm_arming:
            this.storedAlarmTargetKind = AlarmKind.NIGHT_ALARM;
            this.isArming = true;
            break;
          case AlarmState.idle:
            this.storedAlarmTargetKind = AlarmKind.OFF;
            this.isArming = false;
            break;
          default:
            this.error(`WTF ?! Received Alarm state ${JSON.stringify(data.result)} => ${this.storedAlarmState}`);
        }
        // this.isArming = value.includes('arming');
        //   callback(value);
      } else {
        //   callback(null);
      }
    } else {
      //   const alarmNode: FBXHomeNode | null = await this.getAlarm();
      //   if (alarmNode) {
      //     this.storedAlarmNode = alarmNode;
      //     return await this.getAlarmState();
      //   } else {
      //     return null;
      //   }
      this.warn('No alarm node found yet ... Did discovery happened yet ?!');
    }
    return { kind: this.storedAlarmTargetKind, state: this.storedAlarmState };
  }

  // async getAlarmTarget(): Promise<AlarmKind> { //callback: Callback<number>) {
  //   return this.storedAlarmTarget;
  // }

  // async setAlarmDisabled(): Promise<boolean> {
  //   if (this.storedAlarmNode) {
  //     const ep_id = this.getOffEndpoint();
  //     const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
  //     const result: FBXRequestResult = await this.freeboxRequest.request(
  //       'PUT',
  //       url,
  //       { id: this.storedAlarmNode.id, value: null },
  //       RetryPolicy.NO_RETRY,
  //     );
  //     const data: FBXEndPointResult = result.data as FBXEndPointResult;
  //     if (result && data.success) {
  //       this.storedAlarmTarget = AlarmKind.OFF;
  //       return true;
  //     } else {
  //       return false;
  //     }
  //   } else {
  //     return false;
  //   }
  // }

  async setAlarmDisabled(): Promise<boolean> {
    if (this.storedAlarmNode) {
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${this.alarmKindEndPointsMap.get(AlarmKind.OFF)}`;
      this.debug('setAlarmDisabled - url=' + url);
      const result: FBXRequestResult = await this.freeboxRequest.request(
        'PUT',
        url,
        { id: this.storedAlarmNode.id, value: null },
        RetryPolicy.NO_RETRY,
      );
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        this.storedAlarmTargetKind = AlarmKind.OFF;
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }


  private async setAlarm(kind: AlarmKind): Promise<boolean> {
    this.debug('setAlarm');
    switch (kind) {
      case AlarmKind.MAIN_ALARM:
      case AlarmKind.NIGHT_ALARM:
        break;
      default:
        // this.error(`Cant' set alarm for ${kind}`);
        // return false;
        throw Error('Wrong service called, should use setAlarmDisabled');
    }
    const activable: boolean = await this.checkAlarmActivable(kind);
    if (activable && this.storedAlarmNode) {
      const ep_id = this.alarmKindEndPointsMap.get(kind);
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
      this.debug('setAlarm - activable => url=' + url);
      this.storedAlarmTargetKind = kind;
      const result: FBXRequestResult = await this.freeboxRequest.request(
        'PUT',
        url,
        { id: this.storedAlarmNode.id, value: null },
        RetryPolicy.NO_RETRY,
      );
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        return true;
      } else {
        return false;
      }
    } else {
      this.info(`Alarm ${AlarmKind.MAIN_ALARM} not activable ${activable} or no alarm node found...`);
      return false;
    }
  }

  async setMainAlarm(): Promise<boolean> {
    this.debug('setMainAlarm');
    return await this.setAlarm(AlarmKind.MAIN_ALARM);
  }

  async setNightAlarm(): Promise<boolean> {
    this.debug('setNightAlarm');
    return await this.setAlarm(AlarmKind.NIGHT_ALARM);
  }
}