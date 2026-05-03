import {
  API,
  // AccessoryPlugin,
  // CharacteristicEventTypes,
  // CharacteristicSetCallback,
  // CharacteristicValue,
  // Controller,
  HAP,
  PlatformAccessory,
  Service } from 'homebridge';
import { FreeboxPlatform } from './platform.js';
import { StreamingDelegate } from './ffmpeg-camera/streamingDelegate.js';
import { CameraConfig, VideoConfig } from './ffmpeg-camera/configTypes.js';
import { CameraController as FBXCameraController, FBXCameraInstance } from './controllers/CameraController.js';


// export type AutomationReturn = {
//   error: boolean;
//   message: string;
//   cooldownActive?: boolean;
// };

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FBXCamera /*implements AccessoryPlugin*/ {
  private service: Service;
  private cameraInstance: FBXCameraInstance;
  private streamingDelegate? : StreamingDelegate;
  private api : API;
  private hap : HAP;

  private cameraConfig?: CameraConfig;

  // private readonly motionTimers: Map<string, NodeJS.Timeout> = new Map();

  // private readonly cameraControlService?: Service;
  // private readonly cameraStreamManagementService?: Service;
  // private readonly informationService?: Service;

  constructor(
    private readonly platform: FreeboxPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly fbxCameraController : FBXCameraController,
  ) {
    this.api = this.platform.api;
    this.hap = this.platform.api.hap;
    this.cameraInstance = accessory.context.device as FBXCameraInstance;
    // let rtspActivated : boolean = false;
    // setImmediate(async () => {
    //   rtspActivated = await this.fbxCameraController.activateRTSP(this.cameraInstance);
    // },
    // );
    // if (rtspActivated) {
    const videoConfig : VideoConfig = {
      source: `-re -i rtsp://${this.cameraInstance.ip}/live`,
      maxStreams: 2,
      maxWidth: 1280,
      maxHeight: 720,
      maxBitrate: 1000,
      maxFPS: 15,
      audio: false,
      // additionalCommandline: '-pix_fmt yuv420p -x264-params intra-refresh=1:bframes=0',
    };
    this.cameraConfig = {
      name : this.cameraInstance.node_data.label,
      manufacturer : 'Freebox',
      model : 'RocketCam',
      serialNumber : '13377',
      firmwareRevision : '',
      motion : true,
      videoConfig : videoConfig,
    };
    // if (this.cameraConfig.motion) {
    //   const motionSensor = new this.hap.Service.MotionSensor(this.cameraConfig.name);
    //   accessory.addService(motionSensor);
    //   if (this.cameraConfig.switches) {
    //     const motionTrigger = new this.hap.Service.Switch(this.cameraConfig.name + ' Motion Trigger', 'MotionTrigger');
    //     motionTrigger
    //       .getCharacteristic(this.hap.Characteristic.On)
    //       .on(CharacteristicEventTypes.SET, (state: CharacteristicValue, callback: CharacteristicSetCallback) => {
    //         this.motionHandler(accessory, state as boolean, 1);
    //         callback();
    //       });
    //     accessory.addService(motionTrigger);
    //   }
    // }
    this.streamingDelegate = new StreamingDelegate(
      this.platform.log,
      this.cameraConfig,
      this.api,
      this.hap,
    );
    // this.informationService = accessory.getService(this.hap.Service.AccessoryInformation)!;
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Manufacturer, this.cameraConfig.manufacturer || 'Homebridge')
      .setCharacteristic(this.hap.Characteristic.Model, this.cameraConfig.model || 'Camera FFmpeg')
      .setCharacteristic(this.hap.Characteristic.SerialNumber, this.cameraConfig.serialNumber || 'SerialNumber')
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, this.cameraConfig.firmwareRevision || '');

    // this.accessory.category = this.api.hap.Categories.IP_CAMERA;
    this.accessory.category = this.api.hap.Categories.CAMERA;
      
    this.service = this.accessory.getService(this.platform.Service.CameraRTPStreamManagement)
    || this.accessory.addService(this.platform.Service.CameraRTPStreamManagement);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.cameraInstance.node_data.label);
    this.accessory.configureController(this.streamingDelegate.controller);
  }

  // identify(): void {
  //   // throw new Error('Method not implemented.');
  //   this.info('Identify requested.', this.accessory.displayName);
  // }

  // getServices(): Service[] {
  //   return [this.informationService!,
  //     this.cameraControlService!,
  //     this.cameraStreamManagementService!];
  // }

  // getControllers?(): Controller[] {
  //   return this.streamingDelegate.controller;
  // }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(s: string, ...parameters: any[]) {
    this.platform.log.debug(`FBXCamera -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private info(s: string, ...parameters: any[]) {
    this.platform.log.info(`FBXCamera -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private warn(s: string, ...parameters: any[]) {
    this.platform.log.warn(`FBXCamera -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private error(s: string, ...parameters: any[]) {
    this.platform.log.error(`FBXCamera -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private success(s: string, ...parameters: any[]) {
    this.platform.log.success(`FBXCamera -> ${s}`, parameters);
  }

  // private motionHandler(accessory: PlatformAccessory, active = true, minimumTimeout = 0): AutomationReturn {
  //   const motionSensor = accessory.getService(this.hap.Service.MotionSensor);
  //   if (motionSensor) {
  //     this.debug('Switch motion detect ' + (active ? 'on.' : 'off.'), accessory.displayName);
  //     const timeout = this.motionTimers.get(accessory.UUID);
  //     if (timeout) {
  //       clearTimeout(timeout);
  //       this.motionTimers.delete(accessory.UUID);
  //     }
  //     const motionTrigger = accessory.getServiceById(this.hap.Service.Switch, 'MotionTrigger');
  //     // const config = this.cameraConfigs.get(accessory.UUID);
  //     if (active) {
  //       motionSensor.updateCharacteristic(this.hap.Characteristic.MotionDetected, true);
  //       if (motionTrigger) {
  //         motionTrigger.updateCharacteristic(this.hap.Characteristic.On, true);
  //       }
  //       // if (!timeout && config?.motionDoorbell) {
  //       //   this.doorbellHandler(accessory, true);
  //       // }
  //       let timeoutConfig = this.cameraConfig?.motionTimeout ?? 1;
  //       if (timeoutConfig < minimumTimeout) {
  //         timeoutConfig = minimumTimeout;
  //       }
  //       if (timeoutConfig > 0) {
  //         const timer = setTimeout(() => {
  //           this.debug('Motion handler timeout.', accessory.displayName);
  //           this.motionTimers.delete(accessory.UUID);
  //           motionSensor.updateCharacteristic(this.hap.Characteristic.MotionDetected, false);
  //           if (motionTrigger) {
  //             motionTrigger.updateCharacteristic(this.hap.Characteristic.On, false);
  //           }
  //         }, timeoutConfig * 1000);
  //         this.motionTimers.set(accessory.UUID, timer);
  //       }
  //       return {
  //         error: false,
  //         message: 'Motion switched on.',
  //         cooldownActive: !!timeout,
  //       };
  //     } else {
  //       motionSensor.updateCharacteristic(this.hap.Characteristic.MotionDetected, false);
  //       if (motionTrigger) {
  //         motionTrigger.updateCharacteristic(this.hap.Characteristic.On, false);
  //       }
  //       // if (config?.motionDoorbell) {
  //       //   this.doorbellHandler(accessory, false);
  //       // }
  //       return {
  //         error: false,
  //         message: 'Motion switched off.',
  //       };
  //     }
  //   } else {
  //     return {
  //       error: true,
  //       message: 'Motion is not enabled for this camera.',
  //     };
  //   }
  // }

}
