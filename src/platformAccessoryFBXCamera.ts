import {
  API,
  // AccessoryPlugin,
  // CharacteristicEventTypes,
  // CharacteristicSetCallback,
  // CharacteristicValue,
  // Controller,
  HAP,
  PlatformAccessory,
  //Service
} from 'homebridge';
import { FreeboxPlatform } from './platform.js';
import { PluginLogger } from './PluginLogger.js';
import { StreamingDelegate } from './ffmpeg-camera/streamingDelegate.js';
import { CameraConfig, VideoConfig } from './ffmpeg-camera/configTypes.js';
import { CameraController as FBXCameraController, FBXCameraInstance } from './controllers/CameraController.js';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FBXCamera /*implements AccessoryPlugin*/ {
  private readonly logger: PluginLogger;
  private cameraInstance: FBXCameraInstance;
  private streamingDelegate? : StreamingDelegate;
  private api : API;
  private hap : HAP;

  private cameraConfig?: CameraConfig;

  constructor(
    private readonly platform: FreeboxPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly fbxCameraController : FBXCameraController,
  ) {
    this.logger = new PluginLogger(this.platform.log, 'FBXCamera');

    this.api = this.platform.api;
    this.hap = this.platform.api.hap;
    this.cameraInstance = accessory.context.device as FBXCameraInstance;

    const streamSource = this.buildStreamSource(this.cameraInstance.streamUrl, false);
    const snapshotSource = this.buildStreamSource(this.cameraInstance.streamUrl, true);

    const videoConfig : VideoConfig = {
      source: streamSource,
      stillImageSource: snapshotSource,
      maxStreams: 2,
      maxWidth: 1920,
      maxHeight: 1080,
      maxBitrate: 2000,
      maxFPS: 30,
      vcodec: 'libx264',
      encoderOptions: '-preset ultrafast -tune zerolatency',
      audio: true,
      debug: false,
    };
    this.cameraConfig = {
      name: this.cameraInstance.node_data.label,
      manufacturer : 'Freebox',
      model : this.cameraInstance.node_data.type.labelDisplay || 'Freebox Camera',
      serialNumber : `FBX-CAM-${this.cameraInstance.id}`,
      firmwareRevision : '1.0.0',
      motion : false,
      videoConfig : videoConfig,
    };

    this.streamingDelegate = new StreamingDelegate(
      this.platform.log,
      this.cameraConfig,
      this.api,
      this.hap,
    );

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.hap.Characteristic.Manufacturer, this.cameraConfig.manufacturer || 'Homebridge')
      .setCharacteristic(this.hap.Characteristic.Model, this.cameraConfig.model || 'Camera FFmpeg')
      .setCharacteristic(this.hap.Characteristic.SerialNumber, this.cameraConfig.serialNumber || 'SerialNumber')
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, this.cameraConfig.firmwareRevision || '');

    this.accessory.category = this.api.hap.Categories.IP_CAMERA;

    this.accessory.configureController(this.streamingDelegate.controller);

    const cameraService = this.accessory.getService(this.platform.Service.CameraRTPStreamManagement);
    if (cameraService) {
      cameraService.setCharacteristic(this.platform.Characteristic.Name, this.cameraInstance.node_data.label);
    } else {
      this.logger.error('Failed to find CameraRTPStreamManagement service after configuring controller.');
    }
  }

  private buildStreamSource(streamUrl: string, isSnapshot: boolean): string {
    const normalizedUrl = streamUrl.trim();
    if (normalizedUrl.startsWith('-')) {
      return isSnapshot ? normalizedUrl.replace(/\s*-re\s*/g, ' ') : normalizedUrl;
    }

    const isRtsp = normalizedUrl.startsWith('rtsp://') || normalizedUrl.startsWith('rtsps://');
    const isHttp = normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://');

    if (isRtsp) {
      return isSnapshot
        ? `-rtsp_transport tcp -i ${normalizedUrl}`
        : `-rtsp_transport tcp -re -i ${normalizedUrl}`;
    }

    if (isHttp) {
      const timeoutArgs = '-rw_timeout 5000000 -fflags nobuffer';
      return isSnapshot
        ? `${timeoutArgs} -i ${normalizedUrl}`
        : `-re ${timeoutArgs} -i ${normalizedUrl}`;
    }

    return isSnapshot
      ? `-rtsp_transport tcp -i ${normalizedUrl}`
      : `-rtsp_transport tcp -re -i ${normalizedUrl}`;
  }
}
