import { Logging } from 'homebridge';
import { FBXEndPointResult, FBXHomeNode, FBXHomeNodeCategory, FBXNodeStatus } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest, RetryPolicy } from '../freeboxOS/FreeboxRequest.js';
import fetch, { RequestInit as Request, Response } from 'node-fetch';
import { FBXRequestResult } from '../network/Network.js';
import { PluginLogger } from '../PluginLogger.js';

export interface FBXCameraInstance {
    id: number;
    password: string;
    login: string;
    ip: string;
    node_data: FBXHomeNode;
    streamUrl: string;
}

export class CameraController {
  private readonly logger: PluginLogger;

  constructor(
        public readonly log: Logging,
        private freeboxRequest: FreeboxRequest,
        private readonly apiUrl: string,
  ) {
    this.logger = new PluginLogger(this.log, 'CameraController');
    this.logger.debug('Create Camera controller');
  }

  async getCameras(nodes: Array<FBXHomeNode>): Promise<Array<FBXCameraInstance>> {
    this.logger.debug('getCameras');
    const cameraPromises = nodes
      .filter(node => node.category === FBXHomeNodeCategory.camera)
      .map(async (node) => {
        if (node.status !== FBXNodeStatus.active) {
          this.logger.warn(`Skipping inactive camera node: ${node.name} status=${node.status}`);
          return null;
        }

        if (!node.props || !node.props.Ip || !node.props.Login || !node.props.Pass) {
          this.logger.warn(`Camera node missing props: ${node.name}`);
          return null;
        }

        const streamUrl = node.props.Stream?.trim() //|| node.props.Strteam?.trim() || node.props.stream?.trim()
          || `rtsp://${encodeURIComponent(node.props.Login)}:${encodeURIComponent(node.props.Pass)}@${node.props.Ip}/live`;

        const cameraInstance: FBXCameraInstance = {
          id: node.id,
          password: node.props.Pass,
          login: node.props.Login,
          ip: node.props.Ip,
          node_data: node,
          streamUrl: streamUrl,
        };

        //this.logger.debug(`Found camera node: ${node.name} (${node.label}) ${JSON.stringify(node)}`);
        const activated = await this.activateRTSP(cameraInstance);
        if (!activated) {
          this.logger.warn(`RTSP activation failed for camera ${cameraInstance.node_data.label}; registering accessory anyway.`);
        }
        return cameraInstance;
      });

    const cameras = await Promise.all(cameraPromises);
    return cameras.filter((camera): camera is FBXCameraInstance => camera !== null);
  }

  async getCameraEndpointState(camera: FBXCameraInstance, endpointId: number): Promise<boolean> {
    const url = `${this.apiUrl}/home/endpoints/${camera.id}/${endpointId}`;
    const result: FBXRequestResult = await this.freeboxRequest.request('GET', url, null, RetryPolicy.NO_RETRY);
    const data: FBXEndPointResult = result.data as FBXEndPointResult;
    if (result.status_code === 200 && data.success) {
      const rawValue = data.result.value;
      this.logger.debug(`Camera node state: ${JSON.stringify(result)}`);
      if (typeof rawValue === 'boolean') {
        return rawValue;
      }
      return rawValue === 'true' || rawValue === '1';
    }
    this.logger.warn(`Failed to read camera endpoint ${endpointId} for camera ${camera.node_data.label}`);
    return false;
  }

  private async activateRTSP(camera : FBXCameraInstance) : Promise<boolean> {
    const debug_str = `Failed activating ${camera.login}:XXXXXX@${camera.ip}`;
    if (!camera.ip || camera.ip === '0.0.0.0') {
      this.logger.error(`${debug_str}, invalid IP.`);
      return false;
    }

    const auth = Buffer.from(`${camera.login}:${camera.password}`).toString('base64');
    const url = `http://${camera.ip}/adm/set_group.cgi?group=H264&sp_uri=live`;
    this.logger.debug('Requesting RTSP for camera', camera.id, camera.node_data.label, camera.ip);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const request: Request = {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      signal: controller.signal,
    };

    try {
      const response : Response = await fetch(url, request);
      clearTimeout(timeout);
      if (!response.ok) {
        this.logger.error(`${debug_str} got: ${response.status} ${response.statusText}`);
        return false;
      }
      const text : string = await response.text();
      if (!text.includes('OK')) {
        this.logger.warn(`RTSP activation response: ${text}`);
        this.logger.warn(debug_str);
        return false;
      }
      this.logger.debug(`RTSP activation response: ${text}`);
      this.logger.success(`Successfully activated ${camera.login}@${camera.ip}`);
      return true;
    } catch (error) {
      clearTimeout(timeout);
      this.logger.warn(`${debug_str} failed: ${String(error)}. Continuing without activation.`);
      return false;
    }
  }
}
