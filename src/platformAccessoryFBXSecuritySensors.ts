import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { PluginLogger } from './PluginLogger.js';

import { SensorsController, SensorInstance } from './controllers/SensorsController.js';
import { FreeboxPlatform } from './platform.js';
import { FBXHomeNodeCategory } from './FreeboxHomeTypes/FBXHomeTypes.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FBXSecuritySensors {
  private readonly logger: PluginLogger;

  private service: Service;
  private sensorRefreshRateMilliSeconds: number;
  private sensorInstance: SensorInstance;

  constructor(
    private readonly platform: FreeboxPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly sensorsController: SensorsController,
  ) {
    this.logger = new PluginLogger(this.platform.log, 'FBXSecuritySensors');

    this.sensorRefreshRateMilliSeconds = this.platform.config.sensorRefreshRateMilliSeconds || 5000;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Freebox')
      .setCharacteristic(this.platform.Characteristic.Model, 'Home Sensor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'FBX-SENSOR-' + accessory.context.device.id);

    this.sensorInstance = accessory.context.device as SensorInstance;

    if (this.sensorInstance.sensorNode.category === FBXHomeNodeCategory.motion_sensor) {
      // Motion Sensor
      this.service = this.accessory.getService(this.platform.Service.MotionSensor) ||
        this.accessory.addService(this.platform.Service.MotionSensor);
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.sensorInstance.sensorNode.label);

      this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
        .onGet(this.getMotionDetected.bind(this));
    } else if (this.sensorInstance.sensorNode.category === FBXHomeNodeCategory.contact_sensor) {
      // Contact Sensor
      this.service = this.accessory.getService(this.platform.Service.ContactSensor) ||
        this.accessory.addService(this.platform.Service.ContactSensor);
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.sensorInstance.sensorNode.label);

      this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getContactSensorState.bind(this));
    } else {
      throw new Error(`Unknown sensor category: ${this.sensorInstance.sensorNode.category}`);
    }

    // Polling for updates
    setInterval(async () => {
      try {
        const sensorInfo = await this.sensorsController.getSensorState(this.sensorInstance);
        if (this.sensorInstance.sensorNode.category === FBXHomeNodeCategory.motion_sensor) {
          this.service.updateCharacteristic(this.platform.Characteristic.MotionDetected, sensorInfo.triggered);
        } else if (this.sensorInstance.sensorNode.category === FBXHomeNodeCategory.contact_sensor) {
          const state = sensorInfo.triggered ?
            this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
          this.service.updateCharacteristic(this.platform.Characteristic.ContactSensorState, state);
        }
      } catch (error) {
        this.platform.log.error('Error updating sensor state:', error);
      }
    }, this.sensorRefreshRateMilliSeconds);
  }

  async getMotionDetected(): Promise<CharacteristicValue> {
    try {
      const sensorInfo = await this.sensorsController.getSensorState(this.sensorInstance);
      this.logger.debug(`Motion detected: ${sensorInfo.triggered}`);
      return sensorInfo.triggered;
    } catch (error) {
      this.logger.error('Error getting motion detected:', error);
      throw error;
    }
  }

  async getContactSensorState(): Promise<CharacteristicValue> {
    try {
      const sensorInfo = await this.sensorsController.getSensorState(this.sensorInstance);
      const state = sensorInfo.triggered ?
        this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
        this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
      this.logger.debug(`Contact sensor state: ${state}`);
      return state;
    } catch (error) {
      this.logger.error('Error getting contact sensor state:', error);
      throw error;
    }
  }
}
