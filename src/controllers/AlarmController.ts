import { Logging } from 'homebridge';
// import { setTimeout as sleep } from 'timers/promises';
import { FBXEndPointResult, FBXHomeNode, FBXHomeNodeCategory } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';

export enum AlarmKind {
  NO_ALARM = 0,
  MAIN_ALARM = 1,
  NIGHT_ALARM = 2,
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

export class AlarmController {
  private storedAlarmTarget: AlarmKind = AlarmKind.NO_ALARM;
  private storedAlarmNode: FBXHomeNode | null = null;
  private isArming: boolean = false;
  private freeboxRequest!: FreeboxRequest;

  constructor(
    public readonly log: Logging,
    freeboxRequest: FreeboxRequest,
    // private readonly freeboxAddress: string,
    // private readonly freeboxApiVersion: string,
    private readonly apiUrl: string,
  ) {
    this.freeboxRequest = freeboxRequest;
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

  async refreshAlarmTarget() {
    if (this.storedAlarmNode) {
      const ep_id = this.getStateEndpoint();
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
      const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        const value = data.result.value;
        if (data.result.value_type !== 'void' && data.result.value_type !== 'string') {
          this.warn(`Value type is "${data.result.value_type}", expected void or string. Reply ${JSON.stringify(data.result)}`);
        }
        if (value.includes('alarm1')) {
          this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
        } else if (value.includes('alarm2')) {
          this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
        } else {
          this.storedAlarmTarget = AlarmKind.NO_ALARM;
        }
      }
      //   const _res = await sleep(10000, '');
      //   this.refreshAlarmTarget();
    } else {
      //   const _res = await sleep(10000, '');
      //   const alarmNode: FBXHomeNode | null = await this.getAlarm();
      //   if (alarmNode) {
      //     this.storedAlarmNode = alarmNode;
      //     this.refreshAlarmTarget();
      this.warn('No alarm node found yet ... Did discovery happened yet ?!');
    }
    return this.storedAlarmTarget;
  }

  private getMainEndpoint(): number {
    return this.getEndpointIdWithName('alarm1');
  }

  private getSecondaryEndpoint(): number{
    return this.getEndpointIdWithName('alarm2');
  }

  private getAlarmKindEndpoint(kind: AlarmKind): number {
    return this.getEndpointIdWithName(AlarmKind[kind]);
  }

  private getOffEndpoint(): number {
    return this.getEndpointIdWithName('off');
  }

  private getStateEndpoint(): number {
    return this.getEndpointIdWithName('state');
  }

  private getEndpointIdWithName(name: string): number {
    if (this.storedAlarmNode) {
      let id = 0;
      for (const endpoint of this.storedAlarmNode.type.endpoints) {
        if (endpoint.name === name) {
          return id;
        } else {
          id++;
        }
      }
    }
    throw Error(`endpoint with name ${name} not found ...`);
  }

  private async checkAlarmActivable(target: AlarmKind): Promise<boolean> {
    if (this.storedAlarmNode) {
      if (!this.isArming) {
        const state: AlarmState | null = await this.getAlarmState();
        if (state && state.includes(target.toString())) { // TODO: better/more explicit code ?
          this.info(`About to activate [${target}] while state is [${state}]`);
          return false;
        }
        if (state !== AlarmState.idle) {
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

  async getAlarmState(): Promise<AlarmState | null> {
    if (this.storedAlarmNode) {
      const ep_id = this.getStateEndpoint();
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
      const _payload = {
        id: this.storedAlarmNode.id,
        value: null,
      };
      const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        const value = AlarmState[data.result.value as keyof typeof AlarmState];
        switch (value) {
          //if (value === 'alarm1_armed' || value === 'alarm1_arming') {
          case AlarmState.MAIN_alarm_armed:
            this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
            break;
          case AlarmState.MAIN_alarm_arming:
            this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
            this.isArming = true;
            break;
          // } else if (value === 'alarm2_armed' || value === 'alarm2_arming') {
          case AlarmState.NIGHT_alarm_armed:
            this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
            break;
          case AlarmState.NIGHT_alarm_arming:
            this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
            this.isArming = true;
            break;
          case AlarmState.idle:
            this.storedAlarmTarget = AlarmKind.NO_ALARM;
            this.isArming = false;
            break;
          default:
            this.error(`WTF ?! Received Alarm state ${JSON.stringify(data.result)} => ${value}`);
        }
        // this.isArming = value.includes('arming');
        //   callback(value);
        return value;
      } else {
        //   callback(null);
        return null;
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
      return null;
    }
  }

  async getAlarmTarget(): Promise<AlarmKind> { //callback: Callback<number>) {
    return this.storedAlarmTarget;
  }

  async setAlarmDisabled(): Promise<boolean> {
    if (this.storedAlarmNode) {
      const ep_id = this.getOffEndpoint();
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
      this.storedAlarmTarget = AlarmKind.NO_ALARM;
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
      return false;
    }
  }

  private async setAlarm(kind: AlarmKind): Promise<boolean> {
    switch (kind) {
      case AlarmKind.MAIN_ALARM:
      case AlarmKind.NIGHT_ALARM:
        break;
      case AlarmKind.NO_ALARM:
        this.error(`Cant' set alarm for ${kind}`);
        return false;
      default:
        this.error(`Cant' set alarm for ${kind}`);
        return false;
    }
    const activable: boolean = await this.checkAlarmActivable(kind);
    if (activable && this.storedAlarmNode) {
      const ep_id = this.getAlarmKindEndpoint(kind);
      const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
      this.storedAlarmTarget = kind;
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
    // const activable: boolean = await this.checkAlarmActivable(AlarmKind.MAIN_ALARM);
    // if (activable && this.storedAlarmNode) {
    //   const ep_id = this.getMainEndpoint();
    //   const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
    //   this.storedAlarmTarget = AlarmKind.MAIN_ALARM;
    //   const result: FBXRequestResult = await this.freeboxRequest.request('PUT', url,
    //     { id: this.storedAlarmNode.id, value: null }); //, (statusCode, body) => {
    //   const data: FBXEndPointResult = result.data as FBXEndPointResult;
    //   if (result && data.success) {
    //     return true;
    //   } else {
    //     return false;
    //   }
    // } else {
    //   this.info(`Alarm ${AlarmKind.MAIN_ALARM} not activable ${activable} or no alarm node found...`);
    //   return false;
    // }
    return await this.setAlarm(AlarmKind.MAIN_ALARM);
  }

  async setNightAlarm(): Promise<boolean> {
    // const activable: boolean = await this.checkAlarmActivable(AlarmKind.NIGHT_ALARM);
    // if (activable && this.storedAlarmNode) {
    //   const ep_id = this.getSecondaryEndpoint();
    //   const url = `${this.apiUrl}/home/endpoints/${this.storedAlarmNode.id}/${ep_id}`;
    //   this.storedAlarmTarget = AlarmKind.NIGHT_ALARM;
    //   const result: FBXRequestResult = await this.freeboxRequest.request('PUT', url, { id: this.storedAlarmNode.id, value: null });
    //   const data: FBXEndPointResult = result.data as FBXEndPointResult;
    //   if (result && data.success) {
    //     return true;
    //   } else {
    //     return false;
    //   }
    // } else {
    //   this.info(`Alarm ${AlarmKind.MAIN_ALARM} not activable ${activable} or no alarm node found...`);
    //   return false;
    // }
    return await this.setAlarm(AlarmKind.NIGHT_ALARM);
  }
}