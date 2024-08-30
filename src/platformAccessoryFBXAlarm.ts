import { CharacteristicSetCallback, CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { AlarmController, AlarmKind as FBXAlarmKind, AlarmState as FBXAlarmState, AlarmInfo as FBXAlarmInfo } from './controllers/AlarmController.js';
import { FBXHomeNode } from './FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxPlatform } from './platform.js';

// import { setImmediate, setTimeout as sleep } from 'timers/promises';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FBXAlarm {
  private service: Service;
  private currentState: CharacteristicValue;
  private currentTargetState: CharacteristicValue;
  private alarmRefreshRateMilliSeconds: number;

  private currentTargetStateF2H: { [key in FBXAlarmKind]: CharacteristicValue };
  private currentStateF2H: { [key in FBXAlarmState]: CharacteristicValue };

  constructor(
    private readonly platform: FreeboxPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly alarmController: AlarmController,
    // TODO: add sensors !
  ) {
    this.alarmRefreshRateMilliSeconds = this.platform.config.alarmRefreshRateMilliSeconds;
    this.currentState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
    this.currentTargetState = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
    // static readonly STAY_ARM = 0;
    // static readonly AWAY_ARM = 1;
    // static readonly NIGHT_ARM = 2;
    // static readonly DISARM = 3;
    this.currentTargetStateF2H = {
      [FBXAlarmKind.MAIN_ALARM]: 1, //'AWAY',
      [FBXAlarmKind.NIGHT_ALARM]: 2, // 'NIGHT',
      [FBXAlarmKind.OFF]: 3, //'DISARM',
    };
    this.currentStateF2H = {
      [FBXAlarmState.idle]: this.platform.Characteristic.SecuritySystemCurrentState.DISARMED,
      [FBXAlarmState.MAIN_alarm_arming]: this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      [FBXAlarmState.NIGHT_alarm_arming]: this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM,
      [FBXAlarmState.MAIN_alarm_armed]: this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      [FBXAlarmState.NIGHT_alarm_armed]: this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM,
      [FBXAlarmState.MAIN_alarm_alert_timer]: this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED,
      [FBXAlarmState.NIGHT_alarm_alert_timer]: this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED,
      [FBXAlarmState.alert]: this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED,
    };

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem)
      || this.accessory.addService(this.platform.Service.SecuritySystem);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    const devicedata = accessory.context.device as FBXHomeNode;
    this.service.setCharacteristic(this.platform.Characteristic.Name, devicedata.label);

    // https://developers.homebridge.io/#/service/SecuritySystem
    // this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemAlarmType)
    //   .onGet(this.getSecuritySystemAlarmType.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.getSecuritySystemCurrentState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onGet(this.getSecuritySystemTargetState.bind(this))
      .onSet(this.setSecuritySystemTargetState.bind(this));

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same subtype id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    // const motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);
    // setInterval(async () => {
    //   const currentAlarmKindTarget: FBXAlarmKind = await this.alarmController.getAlarmKind();
    //   this.currentTargetState = this.currentTargetStateF2H[currentAlarmKindTarget];
    // }, this.alarmRefreshRateMilliSeconds);
    // setImmediate(async () => {
    //   const _finished = await sleep(1000, '');
    // });
    // setInterval(async () => {
    //   const alarmState: FBXAlarmState | null = await this.alarmController.getAlarmState();
    //   if (alarmState !== null) {
    //     //this.debug(`FBX alarm state ${alarmState} converting to ${this.currentStateF2H[alarmState]}`);
    //     this.currentState = this.currentStateF2H[alarmState];
    //   }
    // }, this.alarmRefreshRateMilliSeconds);
    setInterval(async () => {
      const alarmInfo: FBXAlarmInfo = await this.alarmController.getAlarmKindAndState();
      this.currentTargetState = this.currentTargetStateF2H[alarmInfo.kind];
      this.currentState = this.currentStateF2H[alarmInfo.state];
    }, this.alarmRefreshRateMilliSeconds);
  }

  private debug(s: string) {
    this.platform.log.debug(`FBXAlarm -> ${s}`);
  }

  private info(s: string) {
    this.platform.log.info(`FBXAlarm -> ${s}`);
  }

  private warn(s: string) {
    this.platform.log.warn(`FBXAlarm -> ${s}`);
  }

  private error(s: string) {
    this.platform.log.error(`FBXAlarm -> ${s}`);
  }

  private success(s: string) {
    this.platform.log.success(`FBXAlarm -> ${s}`);
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  async getSecuritySystemTargetState(): Promise<CharacteristicValue> {
    this.debug(`Triggered GET getSecuritySystemTargetState -> returning ${this.currentTargetState}`);
    return this.currentTargetState;
  }

  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  async setSecuritySystemTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    this.debug(`Triggered SET SecuritySystemTargetState: ${value}`);
    switch (value) {
      case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        {
          this.debug('DISARM');
          const status = await this.alarmController.setAlarmDisabled();
          if (status) {
            this.currentTargetState = value;
          } else {
            this.error('Asked DISARM, but it failed ?!');
          }
          break;
        }
      case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        {
          this.debug('AWAY_ARM');
          const status = await this.alarmController.setMainAlarm();
          if (status) {
            this.currentTargetState = value;
          } else {
            this.error('Asked AWAY_ARM, but it failed ?!');
          }
          break;
        }
      case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
      case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        {
          this.debug('STAY_ARM OR NIGHT_ARM');
          const status = await this.alarmController.setNightAlarm();
          if (status) {
            this.currentTargetState = value;
          } else {
            this.error('Asked STAY_ARM OR NIGHT_ARM, but it failed ?!');
          }
          break;
        }
      default:
        throw new Error('WTF BBQ');
    }
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  async getSecuritySystemCurrentState(): Promise<CharacteristicValue> {
    this.debug(`Triggered getSecuritySystemCurrentState -> returning ${this.currentState}`);
    return this.currentState;
  }

  // async getSecuritySystemAlarmType(): Promise<CharacteristicValue> {
  //   return 0;
  // }

}
