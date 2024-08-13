
import {
  CharacteristicSetCallback,
  CharacteristicValue,
  HAPStatus,
  PlatformAccessory,
  Service,
} from 'homebridge';

import { setImmediate, setTimeout as sleep } from 'timers/promises';

import { FreeboxPlatform } from './platform.js';

import { BlindPosValue, FBXBlind, ShuttersController } from './controllers/ShuttersController.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FBXShutters {
  private service: Service;
  private shutterDevice: FBXBlind;
  // private controllerShutterIndex: number;
  private currentPosition: number;
  private previousPosition: number;
  private previousTargetPosition: number;
  private currentTargetPosition: number;
  private debugName: string;

  constructor(
    private readonly platform: FreeboxPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly shuttersController: ShuttersController,
    private readonly controllerShutterIndex: number,
    private readonly shuttersRefreshRateMilliSeconds: number,
  ) {
    this.shutterDevice = accessory.context.device as FBXBlind;
    this.platform.log.info('Create shutter ' + this.shutterDevice.displayName + ' ' + this.shutterDevice.nodeid);
    this.debugName = `${this.shutterDevice.displayName}@${this.shutterDevice.nodeid}`;
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.WindowCovering)
      || this.accessory.addService(this.platform.Service.WindowCovering);



    this.currentPosition = this.shutterDevice.current_position || 0;
    this.previousPosition = this.currentPosition;
    this.currentTargetPosition = this.shutterDevice.current_target_position || this.currentPosition;
    this.previousTargetPosition = this.currentTargetPosition;

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.shutterDevice.displayName);

    // https://developers.homebridge.io/#/service/WindowCovering
    this.platform.log.info('Register services');
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));
    // .on('get', this.handleCurrentPositionGet.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));
    // .on('get', this.handlePositionStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(this.getTargetPosition.bind(this))
      // // .on('get', this.handleTargetPositionGet.bind(this))
      .onSet(this.setTargetPosition.bind(this));
    // .on('set', this.handleTargetPositionSet.bind(this));

    // useless in Homekit ?
    // this.service.getCharacteristic(this.platform.Characteristic.HoldPosition)
    //   .onSet(this.setHoldPosition.bind(this));
    // // .on('set', this.handleHoldPositionSet.bind(this));



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

    // // Example: add two "motion sensor" services to the accessory
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
    this.platform.log.info('Get initial positions before triggering any event');
    setImmediate(async () => {
      await this.updateCurrentPosition(false);
      const gotCurrentTargetPos = await this.updateCurrentTargetPosition(false);
      if (!gotCurrentTargetPos) {
        this.warn("Could not find a initial target position");
      }
    });

    this.platform.log.info('Wait 5 sec');
    setImmediate(async () => {
      const finished = await sleep(5000, '');
      this.platform.log.info('Timer finished !');
    });

    this.platform.log.info('Start periodic timer');
    setInterval(async () => {
      await this.updateCurrentPosition();
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
    }, this.shuttersRefreshRateMilliSeconds);
    setImmediate(async () => {
      const finished = await sleep(1000, '');
    });
    setInterval(async () => {
      await this.updateCurrentTargetPosition();
    }, this.shuttersRefreshRateMilliSeconds);
    setImmediate(async () => {
      const finished = await sleep(1000, '');
    });
    setInterval(async () => {
      const trend = this.updateTrends();
      this.service.updateCharacteristic(this.platform.Characteristic.PositionState, trend);
    }, this.shuttersRefreshRateMilliSeconds);
  }

  private debug(s: string) {
    this.platform.log.debug(`FBXShutters ${this.debugName} -> ${s}`);
  }

  private info(s: string) {
    this.platform.log.info(`FBXShutters ${this.debugName} -> ${s}`);
  }

  private warn(s: string) {
    this.platform.log.warn(`FBXShutters ${this.debugName} -> ${s}`);
  }

  private error(s: string) {
    this.platform.log.error(`FBXShutters ${this.debugName} -> ${s}`);
  }

  private success(s: string) {
    this.platform.log.success(`FBXShutters ${this.debugName} -> ${s}`);
  }

  private async updateCurrentPosition(doPublish: boolean = true) {
    const funcname = "updateCurrentPosition";
    const currentPos: BlindPosValue = await this.shuttersController.getBlindCurrentPosition(this.controllerShutterIndex);
    if (currentPos.value !== null) {
      // apple convention  : 100 = OPEN /   0 = CLOSED
      // Freebox convention: 0   = OPEN / 100 = CLOSED
      // Freebox convention: 100 = CLOSED / 0 = OPEN
      const apple_convention_pos: number = Math.abs(100 - currentPos.value); // abs in case of weird values from FBX ...
      if (currentPos.value > 100 || currentPos.value < 0) {
        this.platform.log.error(`${funcname} FBX pos = ${currentPos.value} / apple pos=${apple_convention_pos}`);
      }
      this.previousPosition = this.currentPosition;
      this.currentPosition = apple_convention_pos;
      if (doPublish) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
        const trend = await this.updateTrends();
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, trend);
      }
    }
  }
  private async updateCurrentTargetPosition(doPublish: boolean = true): Promise<boolean> {
    const funcname = "updateCurrentTargetPosition";
    const currentTargetPos: BlindPosValue = await this.shuttersController.getBlindTargetPosition(this.controllerShutterIndex);
    if (currentTargetPos.value !== null) {
      const apple_convention_pos: number = Math.abs(100 - currentTargetPos.value);
      if (currentTargetPos.value > 100 || currentTargetPos.value < 0) {
        this.platform.log.error(`${funcname} FBX pos = ${currentTargetPos.value} / apple pos=${apple_convention_pos}`);
      }
      this.previousTargetPosition = this.currentTargetPosition;
      this.currentTargetPosition = apple_convention_pos;
      if (doPublish) {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.currentTargetPosition);
      }
      return true;
    }
    return false;
  }

  async getCurrentPosition(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.warn(`Triggered GET CurrentPosition`);
    //callback(null, this.currentPosition);
    return this.currentPosition;
  }

  async getPositionState(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.warn(`Triggered GET PositionState`);
    const trend = this.updateTrends();
    this.warn(`PositionState -> ${trend}`);
    return trend;
  }

  async getTargetPosition(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.warn(`Triggered GET TargetPosition`);
    return this.currentTargetPosition;
  }

  async setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.warn(`Triggered SET TargetPosition: ${value}`);
    const posVal: number = value as number;
    // apple convention  : 100 = OPEN / 0 = CLOSED
    // Freebox convention: 100 = CLOSED / 0 = OPEN
    //switch to FBX convention
    const fbx_convention_pos: number = 100 - posVal;
    // if(fbx_convention_pos !== this.currentPosition) {
    const status: boolean = await this.shuttersController.setBlindPosition(this.controllerShutterIndex, fbx_convention_pos);
    if (status) {
      this.previousTargetPosition = this.currentTargetPosition;
      this.currentTargetPosition = posVal;
    } else {
      this.debug(`Triggered SET TargetPosition: ${value} FAILED. KEPT LAST VALUE`);
      callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }
    // }
  }

  // async setHoldPosition(value: CharacteristicValue/*callback: CharacteristicSetCallback*/) {
  //   this.warn(`Triggered SET HoldPosition ${value}`);
  //   const status: boolean = await this.shuttersController.stopBlind(this.controllerShutterIndex);
  //   if (status) {
  //     this.debug(`Triggered SET HoldPosition success`);
  //     // callback(null);
  //   } else {
  //     this.debug(`Triggered SET HoldPosition FAILED ...`);
  //     // callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
  //   }
  // }

  private updateTrends(): CharacteristicValue {
    // apple convention  : 100 = OPEN / 0 = CLOSED
    if (this.currentPosition > this.previousPosition) {
      // this.debug(`PositionState -> INCREASING`);
      return this.platform.Characteristic.PositionState.INCREASING;
    } else if (this.currentPosition < this.previousPosition) {
      // this.debug(`PositionState -> DECREASING`);
      return this.platform.Characteristic.PositionState.DECREASING;
    } else {
      // this.debug(`PositionState -> STOPPED`);
      // this.currentTargetPosition = this.currentPosition;

      // necessary ?
      this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.currentPosition);
      // this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.platform.Characteristic.PositionState.STOPPED);
      return this.platform.Characteristic.PositionState.STOPPED;
    }
  }
}
