import { Logging } from 'homebridge';
import { FBXEndPointResult, FBXHomeNode, FBXHomeNodeCategory } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import { FBXRequestResult } from '../network/Network.js';
import { PluginLogger } from '../PluginLogger.js';

export enum SensorType {
  MOTION = 'pir',
  CONTACT = 'dws',
}

export interface SensorInfo {
  type: SensorType;
  triggered: boolean;
}

export interface SensorInstance {
  sensorNode: FBXHomeNode;
  stateEndPoint: number;
  stateEndPointName: string;
}

export class SensorsController {
  private readonly logger: PluginLogger;

  constructor(
    public readonly log: Logging,
    private freeboxRequest: FreeboxRequest,
    private readonly apiUrl: string,
  ) {
    this.logger = new PluginLogger(this.log, 'SensorsController');
    this.logger.debug('Create Sensors controller');
  }


  getSensors(nodes: Array<FBXHomeNode>): Array<SensorInstance> {
    this.logger.debug('getSensors');
    this.logger.debug(`Processing ${nodes.length} nodes`);
    const sensorsList: Array<SensorInstance> = new Array<SensorInstance>();
    for (const node of nodes) {
      this.logger.debug(`Checking node: ${node.name} category: ${node.category} status: ${node.status}`);
      if (node.category === FBXHomeNodeCategory.motion_sensor || node.category === FBXHomeNodeCategory.contact_sensor) {
        this.logger.success(`Found sensor node! ${node.name} ${node.label} category: ${node.category}`);

        const endpoints = node.show_endpoints && node.show_endpoints.length > 0
          ? node.show_endpoints
          : node.type.endpoints;

        const preferredNames = node.category === FBXHomeNodeCategory.motion_sensor
          ? ['trigger', 'state']
          : ['trigger', 'cover', 'state'];

        const signalEndpoints = endpoints.filter(ep => ep.ep_type === 'signal');
        const selectedEndpoint = signalEndpoints.find(ep => preferredNames.includes(ep.name ?? ''))
          || signalEndpoints.find(ep => ep.value_type === 'bool' || ep.value_type === 'int')
          || signalEndpoints[0];

        if (selectedEndpoint && selectedEndpoint.id !== undefined) {
          const sensorInstance: SensorInstance = {
            sensorNode: node,
            stateEndPoint: selectedEndpoint.id,
            stateEndPointName: selectedEndpoint.name ?? '',
          };
          this.logger.debug(`Selected endpoint ${selectedEndpoint.name} (id=${selectedEndpoint.id}) for sensor ${node.label}`);
          sensorsList.push(sensorInstance);
        } else {
          this.logger.warn(`Sensor ${node.label} has no usable signal endpoint. Node info: ${JSON.stringify(node)}`);
        }
      }
    }
    this.logger.debug(`Found ${sensorsList.length} sensors total`);
    return sensorsList;
  }

  async getSensorState(sensor: SensorInstance): Promise<SensorInfo> {
    const url = `${this.apiUrl}/home/endpoints/${sensor.sensorNode.id}/${sensor.stateEndPoint}`;
    const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
    const data: FBXEndPointResult = result.data as FBXEndPointResult;
    let sensorType: SensorType;
    let triggered: boolean = false;
    if (result && data.success) {
      const rawValue = data.result.value;
      const normalizedValue = this.extractValue(rawValue);
      const boolValue = this.toBoolean(normalizedValue);

      if (sensor.stateEndPointName === 'trigger' || sensor.stateEndPointName === 'cover') {
        triggered = !boolValue;
      } else {
        triggered = boolValue;
      }

      if (sensor.sensorNode.category === FBXHomeNodeCategory.motion_sensor) {
        sensorType = SensorType.MOTION;
      } else if (sensor.sensorNode.category === FBXHomeNodeCategory.contact_sensor) {
        sensorType = SensorType.CONTACT;
      } else {
        throw new Error(`Unknown sensor category: ${sensor.sensorNode.category}`);
      }
    } else {
      this.logger.error(`Failed to get sensor state for ${sensor.sensorNode.label}`);
      sensorType = SensorType.MOTION; // default
    }
    return { type: sensorType, triggered: triggered };
  }

  private extractValue(rawValue: unknown): unknown {
    if (rawValue !== null && typeof rawValue === 'object') {
      if ('value' in rawValue) {
        return (rawValue as { value: unknown }).value;
      }
      if ('history' in rawValue && Array.isArray((rawValue as { history: unknown }).history)) {
        const history = (rawValue as { history: Array<{ value: unknown }> }).history;
        if (history.length > 0) {
          return history[history.length - 1].value;
        }
      }
    }
    return rawValue;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1';
    }
    return false;
  }
}