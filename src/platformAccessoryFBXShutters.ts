
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
        this.platform.log.warn("Could not find a initial target position");
      }
    });

    this.platform.log.info('Wait 5 sec');
    setImmediate(async () => {
      const finished = await sleep(5000, '');
      this.platform.log.info('Timer finished !');
    });

    this.platform.log.info('Start periodic timer');
    setInterval(async () => {
      // this.platform.log.debug(`${this.debugName} - Periodic shutter position GET`);
      // try {
      // const currentPos: BlindPosValue = await this.shuttersController.getBlindCurrentPosition(this.controllerShutterIndex);
      // if (currentPos.value !== null) {
      //   // apple convention  : 100 = OPEN / 0 = CLOSED
      //   // Freebox convention: 100 = CLOSED / 0 = OPEN
      //   const apple_convention_pos: number = 100 - currentPos.value;
      //   this.platform.log.debug(`${this.debugName} - position ${apple_convention_pos} (apple convention)`);
      //   this.previousPosition = this.currentPosition;
      //   this.currentPosition = apple_convention_pos;
      // }
      await this.updateCurrentPosition();
      // const currentTargetPos: BlindPosValue = await this.shuttersController.getBlindTargetPosition(this.controllerShutterIndex);
      // if (currentTargetPos.value !== null) {
      //   const apple_convention_pos: number = 100 - currentTargetPos.value;
      //   this.previousTargetPosition = this.currentTargetPosition;
      //   this.currentTargetPosition = apple_convention_pos;
      //   this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.currentTargetPosition);
      // }
      await this.updateCurrentTargetPosition();

      // if (trend === this.platform.Characteristic.PositionState.STOPPED) {
      //   this.currentTargetPosition = this.currentPosition;
      // }


      //   if (currentPos.value !== null) {
      //     // apple convention  : 100 = OPEN / 0 = CLOSED
      //     // Freebox convention: 100 = CLOSED / 0 = OPEN
      //     //switch to FBX convention
      //     const fbx_convention_pos: number = 100 - currentPos.value;
      //     if (fbx_convention_pos !== this.previousPosition) {
      //       this.platform.log.warn(`${this.debugName} - New shutter position = ${fbx_convention_pos} (previous=${this.previousPosition})`);
      //       this.previousPosition = this.currentPosition;
      //       this.currentPosition = fbx_convention_pos;
      //     } else {
      //       this.platform.log.warn(`${this.debugName} - position unchanged = ${fbx_convention_pos}`);
      //     }
      //   } else {
      //     this.platform.log.warn(`${this.debugName} - Not shutter position found from http request, try from controller cached data`);
      //     if (this.shutterDevice.current_position !== null) {
      //       this.previousPosition = this.currentPosition;
      //       this.currentPosition = 100 - this.shutterDevice.current_position;
      //     } else {
      //       this.platform.log.warn(`${this.debugName} - Not shutter position found in controller cached data !`);
      //     }
      //   }
      // } catch (error) {
      //   this.platform.log.error(`${error}`);
      // }
      // this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
      // // this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.updateTrends());
      // this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.updateTrends());
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
      const trend = this.updateTrends();
      // this.platform.log.debug(`${this.debugName} - trend ${trend.toString()}`);
      this.service.updateCharacteristic(this.platform.Characteristic.PositionState, trend);
    }, 1000);
  }

  private async updateCurrentPosition(doPublish: boolean = true) {
    const currentPos: BlindPosValue = await this.shuttersController.getBlindCurrentPosition(this.controllerShutterIndex);
    if (currentPos.value !== null) {
      // apple convention  : 100 = OPEN / 0 = CLOSED
      // Freebox convention: 100 = CLOSED / 0 = OPEN
      const apple_convention_pos: number = 100 - currentPos.value;
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
    const currentTargetPos: BlindPosValue = await this.shuttersController.getBlindTargetPosition(this.controllerShutterIndex);
    if (currentTargetPos.value !== null) {
      const apple_convention_pos: number = 100 - currentTargetPos.value;
      this.previousTargetPosition = this.currentTargetPosition;
      this.currentTargetPosition = apple_convention_pos;
      if (doPublish) {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.currentTargetPosition);
      }
      return true;
    }
    return false;
  }

  // private async updatePosition(){
  //   try {
  //     const currentPos: BlindPosValue = await this.shuttersController.getBlindCurrentPosition(this.controllerShutterIndex);
  //     if (currentPos.value !== null) {
  //       // apple convention  : 100 = OPEN / 0 = CLOSED
  //       // Freebox convention: 100 = CLOSED / 0 = OPEN
  //       //switch to FBX convention
  //       const fbx_convention_pos: number = 100 - currentPos.value;
  //       if (fbx_convention_pos !== this.previousPosition) {
  //         this.platform.log.debug(`${this.debugName} - New shutter position = ${fbx_convention_pos} (previous=${previousPosition})`);
  //         this.previousPosition = this.currentPosition;
  //         this.currentPosition = fbx_convention_pos;
  //       } else {
  //         // this.platform.log.debug(`${this.debugName} - position unchanged = ${fbx_convention_pos}`);
  //       }
  //     } else {
  //       this.platform.log.warn(`${this.debugName} - Not shutter position found from http request, try from controller cached data`);
  //       if (this.shutterDevice.current_position !== null) {
  //         this.previousPosition = this.currentPosition;
  //         this.currentPosition = 100 - this.shutterDevice.current_position;
  //       } else {
  //         this.platform.log.warn(`${this.debugName} - Not shutter position found in controller cached data !`);
  //       }
  //     }
  //   } catch (error) {
  //     this.platform.log.error(`${error}`);
  //   }
  //   // this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);
  //   // this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.updateTrends());
  // }

  async getCurrentPosition(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.platform.log.warn(`${this.debugName} - Triggered GET CurrentPosition`);
    //callback(null, this.currentPosition);
    return this.currentPosition;
  }

  async getPositionState(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.platform.log.warn(`${this.debugName} - Triggered GET PositionState`);
    const trend = this.updateTrends();
    this.platform.log.warn(`${this.debugName} - PositionState -> ${trend}`);
    return trend;
  }

  // async getTargetPosition(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
  //   this.platform.log.warn(`${this.debugName} - Triggered GET TargetPosition`);
  //   // if (this.shutterDevice.target_position !== null) {
  //   //   this.lastTargetPosition = this.shutterDevice.target_position;
  //   //   // callback(null, this.lastTargetPosition);
  //   // }
  //   // this.platform.log.debug(`${this.debugName} - controller last target pos not defined ... using cached one !`);
  //   // // callback(null, this.lastTargetPosition);
  //   return this.currentTargetPosition;
  // }
  async getTargetPosition(/*callback: CharacteristicGetCallback*/): Promise<CharacteristicValue> {
    this.platform.log.warn(`${this.debugName} - Triggered GET TargetPosition`);
    return this.currentTargetPosition;
  }

  async setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.warn(`${this.debugName} - Triggered SET TargetPosition: ${value}`);
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
      this.platform.log.debug(`${this.debugName} - Triggered SET TargetPosition: ${value} FAILED. KEPT LAST VALUE`);
      callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }
    // }
  }

  // async setHoldPosition(value: CharacteristicValue/*callback: CharacteristicSetCallback*/) {
  //   this.platform.log.warn(`${this.debugName} - Triggered SET HoldPosition ${value}`);
  //   const status: boolean = await this.shuttersController.stopBlind(this.controllerShutterIndex);
  //   if (status) {
  //     this.platform.log.debug(`${this.debugName} - Triggered SET HoldPosition success`);
  //     // callback(null);
  //   } else {
  //     this.platform.log.debug(`${this.debugName} - Triggered SET HoldPosition FAILED ...`);
  //     // callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
  //   }
  // }

  private updateTrends(): CharacteristicValue {
    // apple convention  : 100 = OPEN / 0 = CLOSED
    if (this.currentPosition > this.previousPosition) {
      // this.platform.log.debug(`${this.debugName} - PositionState -> INCREASING`);
      return this.platform.Characteristic.PositionState.INCREASING;
    } else if (this.currentPosition < this.previousPosition) {
      // this.platform.log.debug(`${this.debugName} - PositionState -> DECREASING`);
      return this.platform.Characteristic.PositionState.DECREASING;
    } else {
      // this.platform.log.debug(`${this.debugName} - PositionState -> STOPPED`);
      // this.currentTargetPosition = this.currentPosition;

      // necessary ?
      this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.currentPosition);
      // this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.platform.Characteristic.PositionState.STOPPED);
      return this.platform.Characteristic.PositionState.STOPPED;
    }
  }
}
