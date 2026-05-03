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
  isArming: boolean;
}

export interface AlarmInstance {
  alarmNode: FBXHomeNode;
  kindEndpointsMap: Map<AlarmKind, number>;
  stateEndPoint: number;
  isArming: boolean;
}

export class AlarmController {

  constructor(
    public readonly log: Logging,
    private freeboxRequest: FreeboxRequest,
    private readonly apiUrl: string,
  ) {
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

  getAlarms(nodes: Array<FBXHomeNode>): Array<AlarmInstance> {
    this.debug('getAlarms');
    const alarmsList: Array<AlarmInstance> = new Array<AlarmInstance>();
    let stateEndPoint: number = -1;
    for (const node of nodes) {
      if (node.category === FBXHomeNodeCategory.alarm) {
        this.success(`Found alarm node ! ${node.name} ${node.label}`);
        const kindEndpointsMap: Map<AlarmKind, number> = new Map<AlarmKind, number>();
        for (const ep of node.type.endpoints) {
          if (ep.name !== null) {
            if (ep.name === 'alarm1') {
              kindEndpointsMap.set(AlarmKind.MAIN_ALARM, ep.id);
            } else if (ep.name === 'alarm2') {
              kindEndpointsMap.set(AlarmKind.NIGHT_ALARM, ep.id);
            } else if (ep.name === 'off') {
              kindEndpointsMap.set(AlarmKind.OFF, ep.id);
            } else if (ep.name === 'state') {
              stateEndPoint = ep.id;
            } else {
              continue;
            }
          }
        }
        const alarmInstance: AlarmInstance = {
          alarmNode: node,
          kindEndpointsMap: kindEndpointsMap,
          stateEndPoint: stateEndPoint,
          isArming: false,
        };
        alarmsList.push(alarmInstance);
      }
    }
    return alarmsList;
  }

  private async checkAlarmActivable(
    alarm: AlarmInstance,
    target: AlarmKind): Promise<boolean> {
    this.debug('checkAlarmActivable, kind=' + JSON.stringify(target));
    if (!alarm.isArming) {
      // const state: AlarmState | null = await this.getAlarmState();
      const alarmInfo: AlarmInfo = await this.getAlarmKindAndState(alarm);
      if (alarmInfo.state && alarmInfo.state.includes(target.toString())) { // TODO: better/more explicit code ?
        this.info(`About to activate [${target}] while state is already [${alarmInfo.state}]`);
        return false;
      }
      if (alarmInfo.state !== AlarmState.idle) {
        return await this.setAlarmDisabled(alarm);
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  async getAlarmKindAndState(
    alarm: AlarmInstance,
  ): Promise<AlarmInfo> {
    const url = `${this.apiUrl}/home/endpoints/${alarm.alarmNode.id}/${alarm.stateEndPoint}`;
    // this.debug('getAlarmKindAndState, url=' + url);
    // const _payload = {
    //   id: alarm.alarmNode.id,
    //   value: null,
    // };
    const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
    const data: FBXEndPointResult = result.data as FBXEndPointResult;
    let alarmTargetKind: AlarmKind = AlarmKind.OFF;
    let alarmState: AlarmState = AlarmState.idle;
    // let isArming :boolean = false;
    if (result && data.success) {
      alarmState = data.result.value as AlarmState; //AlarmState[data.result.value as keyof typeof AlarmState];
      switch (alarmState) {
        //if (value === 'alarm1_armed' || value === 'alarm1_arming') {
        case AlarmState.MAIN_alarm_armed:
          alarmTargetKind = AlarmKind.MAIN_ALARM;
          break;
        case AlarmState.MAIN_alarm_arming:
          alarmTargetKind = AlarmKind.MAIN_ALARM;
          alarm.isArming = true;
          break;
        // } else if (value === 'alarm2_armed' || value === 'alarm2_arming') {
        case AlarmState.NIGHT_alarm_armed:
          alarmTargetKind = AlarmKind.NIGHT_ALARM;
          break;
        case AlarmState.NIGHT_alarm_arming:
          alarmTargetKind = AlarmKind.NIGHT_ALARM;
          alarm.isArming = true;
          break;
        case AlarmState.idle:
          alarmTargetKind = AlarmKind.OFF;
          alarm.isArming = false;
          break;
        default:
          this.error(`WTF ?! Received Alarm state ${JSON.stringify(data.result)} => ${alarmState}`);
      }
      //
    } else {
      //
    }
    return { kind: alarmTargetKind, state: alarmState, isArming: alarm.isArming };
  }

  async setAlarmDisabled(
    alarm: AlarmInstance,
  ): Promise<boolean> {
    if (alarm.alarmNode) {
      const url = `${this.apiUrl}/home/endpoints/${alarm.alarmNode.id}/${alarm.kindEndpointsMap.get(AlarmKind.OFF)}`;
      this.debug('setAlarmDisabled - url=' + url);
      const result: FBXRequestResult = await this.freeboxRequest.request(
        'PUT',
        url,
        { id: alarm.alarmNode.id, value: null },
        RetryPolicy.NO_RETRY,
      );
      const data: FBXEndPointResult = result.data as FBXEndPointResult;
      if (result && data.success) {
        // this.storedAlarmTargetKind = AlarmKind.OFF;
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }


  private async setAlarm(
    alarm: AlarmInstance,
    kind: AlarmKind): Promise<boolean> {
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
    const activable: boolean = await this.checkAlarmActivable(alarm, kind);
    if (activable && alarm.alarmNode) {
      const ep_id = alarm.kindEndpointsMap.get(kind);
      const url = `${this.apiUrl}/home/endpoints/${alarm.alarmNode.id}/${ep_id}`;
      this.debug('setAlarm - activable => url=' + url);
      // this.storedAlarmTargetKind = kind;
      const result: FBXRequestResult = await this.freeboxRequest.request(
        'PUT',
        url,
        { id: alarm.alarmNode.id, value: null },
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

  async setMainAlarm(
    alarm: AlarmInstance,
  ): Promise<boolean> {
    this.debug('setMainAlarm');
    return await this.setAlarm(alarm, AlarmKind.MAIN_ALARM);
  }

  async setNightAlarm(
    alarm: AlarmInstance,
  ): Promise<boolean> {
    this.debug('setNightAlarm');
    return await this.setAlarm(alarm, AlarmKind.NIGHT_ALARM);
  }
}