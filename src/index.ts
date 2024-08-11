import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings.js';
import { FreeboxPlatform } from './platform.js';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, FreeboxPlatform);
};
