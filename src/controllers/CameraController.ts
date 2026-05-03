import { Logging } from 'homebridge';
import { FBXHomeNode, FBXHomeNodeCategory } from '../FreeboxHomeTypes/FBXHomeTypes.js';
import { FreeboxRequest } from '../freeboxOS/FreeboxRequest.js';
import fetch, { RequestInit as Request, Response } from 'node-fetch';

export interface FBXCameraInstance {
    id: number;
    password: string;
    login: string;
    ip: string;
    node_data: FBXHomeNode;
}


export class CameraController {

  constructor(
        public readonly log: Logging,
        private freeboxRequest: FreeboxRequest,
        private readonly apiUrl: string,
  ) {
    this.debug('Create Camera controller');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(s: string, ...parameters: any[]) {
    this.log.debug(`CameraController -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private info(s: string, ...parameters: any[]) {
    this.log.info(`CameraController -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private warn(s: string, ...parameters: any[]) {
    this.log.warn(`CameraController -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private error(s: string, ...parameters: any[]) {
    this.log.error(`CameraController -> ${s}`, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private success(s: string, ...parameters: any[]) {
    this.log.success(`CameraController -> ${s}`, parameters);
  }

  getCameras(nodes: Array<FBXHomeNode>): Array<FBXCameraInstance> {
    this.debug('getAlarms');
    const cameraList: Array<FBXCameraInstance> = new Array<FBXCameraInstance>();
    for (const node of nodes) {
      if (node.category === FBXHomeNodeCategory.camera) {
        if (node.props === undefined || node.props === null) {
          throw new Error('Camera props not found ?!');
        }
        this.success(`Found camera node ! ${node.name} ${node.label}`);
        const cameraInstance: FBXCameraInstance = {
          id: node.id,
          password: node.props.Pass,
          login: node.props.Login,
          ip: node.props.Ip,
          node_data: node,
        };
        setImmediate(async () => {
          const success : boolean = await this.activateRTSP(cameraInstance);
          if (success) {
            cameraList.push(cameraInstance);
          }
        });
      }
    }
    return cameraList;
  }

  private async activateRTSP(camera : FBXCameraInstance) : Promise<boolean> {
    const debug_str = `Failed activating ${camera.login}:XXXXXX@${camera.ip}`;
    if (camera.ip === '0.0.0.0') {
      this.error(`${debug_str}, invalid IP.`);
      return false;
    }
    const password = encodeURIComponent(camera.password);
    // const url = `http://${camera.login}:${password}@${camera.ip}/adm/set_group.cgi?group=H264&sp_uri=live`;
    const url = `http://${camera.ip}/adm/set_group.cgi?group=H264&sp_uri=live`;
    this.debug('Requesting RTSP for camera', camera.id, camera.node_data.label, camera.ip);
    const request: Request = {
      headers : {
        'Authorization': `Basic ${btoa(camera.login + ':' + password)}`,
      },
    };
    const response : Response = await fetch(url, request);
    if (!response.ok) {
      this.error(`${debug_str} got: ${response.status} ${response.statusText}`);
      return false;
    }
    if (response.body === null) {
      this.error(`${debug_str} got a null body response.`);
      return false;
    }
    const text :string = await response.text();
    if(!text.includes('OK')) {
      this.warn(`Received: ${text}`);
      this.warn(`${debug_str}`);
      return false;
    }
    this.success('Successfully activated '+camera.login+':XXXXXX@'+camera.ip);
    return true;
  }
}
