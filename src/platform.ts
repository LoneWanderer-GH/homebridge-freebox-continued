import { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { Network } from './network/Network.js';
// import { FreeboxWebSocket } from './network/WebSocket.js';
import { FBXShutters } from './platformAccessoryFBXShutters.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
// import { FreeboxSession } from "./freeboxOS/FreeboxSession.js";
import * as fs from 'fs';
import * as path from 'path';
import { FreeboxRequest } from './freeboxOS/FreeboxRequest.js';
import { FBXAuthInfo, FBXSessionCredentials, FreeboxSession } from './freeboxOS/FreeboxSession.js';
// import { AlarmController } from './controllers/AlarmController.js';
import { AlarmController } from './controllers/AlarmController.js';
import { NodesController } from './controllers/NodesController.js';
import { FBXBlind, ShuttersController } from './controllers/ShuttersController.js';
import { FBXHomeNode } from './FreeboxHomeTypes/FBXHomeTypes.js';
import { FBXAPI, FreeboxController } from './freeboxOS/FreeboxApi.js';
import { FBXAlarm } from './platformAccessoryFBXAlarm.js';
// import * as express from 'express';


/**
 * FreeboxPlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class FreeboxPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private authInfo: FBXAuthInfo = {
    app_token: '',
    track_id: 0,
  };

  private readonly authFilePath: string;
  // private router: express.Router;
  private fbxNetwork: Network;
  private fbxAPIController: FreeboxController;
  // private fbxRequest: FreeboxRequest | null;
  // private fbxSession : FreeboxSession | null;
  private alarmController: AlarmController | null = null;
  private shuttersController: ShuttersController | null = null;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.authFilePath = path.join(this.api.user.storagePath(), 'freebox-auth.json');
    const _freeboxApiVersion: string = this.config.apiVersion;
    const freeboxIPAddress: string = this.config.freeBoxAddress;
    //const shuttersRefreshRateMilliSeconds:string = this.config.shuttersRefreshRateMilliSeconds;


    this.fbxNetwork = new Network(this.log);
    this.fbxAPIController = new FreeboxController(this.log,
      this.fbxNetwork,
      freeboxIPAddress,
    );

    // this.router = express.Router();
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');

      const apiUrl: FBXAPI = await this.fbxAPIController.getActualApiUrl();

      const fbxSession = new FreeboxSession(this.log, this.fbxNetwork, apiUrl.httpsUrl); // this.freeboxAddress, this.freeboxApiVersion);
      const fbxRequest = new FreeboxRequest(this.log, this.fbxNetwork, fbxSession); // freeboxIPAddress, freeboxApiVersion);
      const nodesCtrl = new NodesController(this.log, fbxRequest, apiUrl.httpsUrl);

      const auth_sucess: boolean = await this.initializeAuth(fbxRequest);
      if (auth_sucess) {

        // const _ws: FreeboxWebSocket = new FreeboxWebSocket(this.log, apiUrl.webSocketurl, fbxRequest.credentials);
        this.alarmController = new AlarmController(
          this.log,
          fbxRequest,
          apiUrl.httpsUrl,
          // freeboxIPAddress,
          // freeboxApiVersion,
        );
        this.shuttersController = new ShuttersController(
          this.log,
          fbxRequest,
          apiUrl.httpsUrl,
          // freeboxIPAddress,
          // freeboxApiVersion,
        );
        // run the method to discover / register your devices as accessories
        await this.discoverDevices(nodesCtrl);
      } else {
        this.log.error(`Could not authenticate as an app with Freebox. "${PLATFORM_NAME}" "${PLUGIN_NAME}" initialization failed`);
      }
    });
  }



  async initializeAuth(
    fbxRequest: FreeboxRequest,
  ): Promise<boolean> {
    if (fs.existsSync(this.authFilePath)) {
      this.authInfo = JSON.parse(fs.readFileSync(this.authFilePath, 'utf-8'));
      this.log.info('Auth info loaded from file.');
    } else {
      //
    }
    const result: boolean = await this.startFreeboxAuthentication(fbxRequest,
      this.authInfo);
    return result;
  }

  async startFreeboxAuthentication(
    fbxRequest: FreeboxRequest,
    authInfo: FBXAuthInfo,
    // token: string,
    // trackId: number
  ): Promise<boolean> {
    const sessionCredentials: FBXSessionCredentials = await fbxRequest.freeboxAuth(authInfo); // token, trackId);
    if (sessionCredentials.token !== null && sessionCredentials.token !== 'null') {
      this.authInfo = {
        app_token: sessionCredentials.token,
        track_id: sessionCredentials.track_id,
      };
      fs.writeFileSync(this.authFilePath, JSON.stringify(this.authInfo));
      return true;
    }
    this.log.error(`Could not authenticate as an app with Freebox. Received credential data ${JSON.stringify(sessionCredentials)}`);
    return false;
  }



  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices(nodesCtrl: NodesController) {
    this.log.info('Discover devices');
    const nodes: Array<FBXHomeNode> = await nodesCtrl.getNodes();
    await this.discoverShutters(nodes);
    await this.discoverAlarms(nodes);
  }

  private async discoverShutters(nodes: Array<FBXHomeNode>) {
    if (this.shuttersController === null) {
      throw new Error('Can\'t discover devices - Freebox Shutters Controller not instanciated');
    }
    this.log.info('Get shutters/blinds');
    const shutters: Array<FBXBlind> = this.shuttersController.getBlinds(nodes);
    this.log.info('Found from Freebox ' + shutters.length + 'shutters');
    // let createdShutters: Array<FBXShutters> = [];
    for (const [_index, shutter] of shutters.entries()) {
      const uuid = this.api.hap.uuid.generate(shutter.nodeid + shutter.displayName);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        existingAccessory.context.device = shutter;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        // createdShutters.push(
        new FBXShutters(this,
          existingAccessory,
          this.shuttersController,
        );
        // );

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', shutter.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(shutter.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = shutter;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        // createdShutters.push(
        new FBXShutters(this,
          accessory,
          this.shuttersController,
        );
        // );

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  private async discoverAlarms(nodes: Array<FBXHomeNode>) {
    if (this.alarmController === null) {
      throw new Error('Can\'t discover devices - Freebox Alarm Controller not instanciated');
    }
    const alarmNode: FBXHomeNode | null = this.alarmController.getAlarm(nodes);

    if (alarmNode !== null) {
      const uuid = this.api.hap.uuid.generate(alarmNode.id + alarmNode.name);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        existingAccessory.context.device = alarmNode;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new FBXAlarm(this,
          existingAccessory,
          this.alarmController);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', alarmNode.name + alarmNode.label);

        // create a new accessory
        const accessory = new this.api.platformAccessory(alarmNode.label, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = alarmNode;

        // create the accessory handler for the newly created accessory
        // this is imported from `platformAccessory.ts`
        new FBXAlarm(this,
          accessory,
          this.alarmController);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

  }
}
