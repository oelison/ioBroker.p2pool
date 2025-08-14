"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
import_axios.default.defaults.timeout = 5e3;
class P2pool extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "p2pool"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  refreshInterval = void 0;
  /**
   * create URL
   * /api/pool_info
   * /api/miner_info/<id|address>
   * /api/side_blocks_in_window?window=[window_size]&from=[height][&noMainStatus][&noUncles][&noMiners]
   * /api/side_blocks_in_window/<id|address>?window=[window_size]&from=[height][&noMainStatus][&noUncles][&noMiners]
   * /api/payouts/<id|address>?search_limit=[search_limit] 0 for all 10 is default
   * /api/found_blocks?limit=[limit]&miner=[id|address]
   * /api/shares?limit=[limit]&miner=[id|address][&onlyBlocks][&noMainStatus][&noUncles][&noMiners]
   * /api/block_by_id/<blockId>[/full|/light|/raw|/info|/payouts|/coinbase]
   * /api/block_by_height/<blockHeight>[/full|/light|/raw|/info|/payouts|/coinbase]
   *
   * @param Command - The command to execute, e.g., see list above
   * @param Limit - The search limit for payouts, e.g., 0 for all, 10 is default
   */
  genURL(Command, Limit) {
    let retVal = "";
    let url = "";
    if (this.config.mini_pool) {
      url = `mini.p2pool.observer`;
    } else {
      url = `p2pool.observer`;
    }
    if (Command === "") {
      this.log.error("Command is empty");
      return retVal;
    } else if (Command === "miner_info") {
      retVal = `https://${url}/api/${Command}/${this.config.monero_key}`;
    } else if (Command === "pool_info") {
      retVal = `https://${url}/api/${Command}`;
    } else if (Command === "payouts") {
      retVal = `https://${url}/api/${Command}/${this.config.monero_key}?limit=${Limit}`;
    } else if (Command === "found_blocks") {
      retVal = `https://${url}/api/${Command}?limit=${Limit}&miner=${this.config.monero_key}`;
    } else if (Command === "shares") {
      retVal = `https://${url}/api/${Command}?limit=${Limit}&miner=${this.config.monero_key}`;
    } else {
      this.log.error(`Unknown command: ${Command}`);
    }
    return retVal;
  }
  async readP2Pool(Command, Limit) {
    const reqUrl = this.genURL(Command, Limit);
    this.log.debug(reqUrl);
    let jsonData = null;
    let validJsonData = false;
    await import_axios.default.get(reqUrl).then((res) => {
      jsonData = res.data;
      validJsonData = true;
    }).catch((error) => {
      if (error instanceof Error) {
        this.log.error(error.message);
      }
      this.log.error("p2pool request failed.");
    });
    if (validJsonData && jsonData !== null) {
      return jsonData;
    }
    this.log.error(`No valid JSON data received from p2pool by fetching ${Command} with limit ${Limit}`);
    return JSON.parse("{}");
  }
  /**
   * Callback function for the interval
   */
  updateP2pool = async () => {
    const miner_address = this.config.monero_key;
    if (!miner_address || miner_address === "") {
      this.log.error("Monero key is not set. Please configure the Monero key in the adapter settings.");
      return;
    }
    this.log.debug("Callback function called");
    const minerInfoData = await this.readP2Pool("miner_info", "0");
    const poolInfoData = await this.readP2Pool("pool_info", "0");
    const payoutsData = await this.readP2Pool("payouts", "1");
    const foundBlocksData = await this.readP2Pool("found_blocks", "1");
    const sharesData = await this.readP2Pool("shares", "1");
    this.log.debug(`p2pool response after callback miner_info: ${JSON.stringify(minerInfoData)}`);
    this.log.debug(`p2pool response after callback pool_info: ${JSON.stringify(poolInfoData)}`);
    this.log.debug(`p2pool response after callback payouts: ${JSON.stringify(payoutsData)}`);
    this.log.debug(`p2pool response after callback found_blocks: ${JSON.stringify(foundBlocksData)}`);
    this.log.debug(`p2pool response after callback shares: ${JSON.stringify(sharesData)}`);
    if (sharesData && Object.keys(sharesData).length > 0) {
      await this.setState("raw.shares", JSON.stringify(sharesData), true);
      if (sharesData[0].software_version) {
        await this.setState("details.shares.software_version", sharesData[0].software_version, true);
        const softwareVersion = sharesData[0].software_version;
        const major = softwareVersion >> 16 & 65535;
        const minor = softwareVersion >> 8 & 255;
        const patch = softwareVersion & 255;
        const softwareVersionName = `${major}.${minor}.${patch}`;
        await this.setState("details.shares.software_version_name", softwareVersionName, true);
      }
      if (sharesData[0].difficulty) {
        await this.setState("details.shares.difficulty", sharesData[0].difficulty, true);
      }
    }
    if (minerInfoData && Object.keys(minerInfoData).length > 0) {
      await this.setState("raw.miner_info", JSON.stringify(minerInfoData), true);
      if (minerInfoData.last_share_height) {
        await this.setState("details.miner_info.last_share_height", minerInfoData.last_share_height, true);
      }
      if (minerInfoData.last_share_timestamp) {
        await this.setState(
          "details.miner_info.last_share_timestamp",
          minerInfoData.last_share_timestamp,
          true
        );
      }
    }
    if (poolInfoData && Object.keys(poolInfoData).length > 0) {
      await this.setState("raw.pool_info", JSON.stringify(poolInfoData), true);
      if (poolInfoData.sidechain && poolInfoData.sidechain.last_block && poolInfoData.sidechain.last_block.software_version) {
        await this.setState(
          "details.pool_info.last_block.software_version",
          poolInfoData.sidechain.last_block.software_version,
          true
        );
        if (poolInfoData.sidechain.last_block.software_version) {
          const softwareVersion = poolInfoData.sidechain.last_block.software_version;
          const major = softwareVersion >> 16 & 65535;
          const minor = softwareVersion >> 8 & 255;
          const patch = softwareVersion & 255;
          const softwareVersionName = `${major}.${minor}.${patch}`;
          await this.setState(
            "details.pool_info.last_block.software_version_name",
            softwareVersionName,
            true
          );
        }
        if (poolInfoData.versions.p2pool.version) {
          let p2poolVersion = poolInfoData.versions.p2pool.version;
          const myLastVersion = await this.getStateAsync("details.shares.software_version_name");
          if (myLastVersion && myLastVersion.val !== null) {
            if (typeof myLastVersion.val === "string" && myLastVersion.val.endsWith(".0")) {
              p2poolVersion = `${p2poolVersion}.0`;
              const myLastVersionVal = `v${myLastVersion.val}`;
              if (p2poolVersion === myLastVersionVal) {
                await this.setState("details.calculated.version_missmatch", false, true);
                this.log.debug(`P2Pool version matches: ${p2poolVersion}`);
              } else {
                await this.setState("details.calculated.version_missmatch", true, true);
                this.log.warn(
                  `P2Pool version mismatch: ${p2poolVersion} (p2pool) vs ${myLastVersion.val} (last known p2pool version)`
                );
              }
            }
          }
        }
      }
    }
    if (payoutsData && Object.keys(payoutsData).length > 0) {
      await this.setState("raw.payouts", JSON.stringify(payoutsData), true);
      if (payoutsData[0].timestamp) {
        await this.setState("details.payouts.timestamp", payoutsData[0].timestamp, true);
      }
      if (payoutsData[0].coinbase_reward) {
        await this.setState("details.payouts.coinbase_reward", payoutsData[0].coinbase_reward, true);
      }
    }
    if (foundBlocksData && Object.keys(foundBlocksData).length > 0) {
      await this.setState("raw.found_blocks", JSON.stringify(foundBlocksData), true);
    }
    this.log.debug("p2pool data update completed");
  };
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    await this.setState("info.connection", false, true);
    const reqUrl = this.genURL("miner_info", "0");
    this.log.debug(reqUrl);
    this.log.info(`config monero key: ${this.config.monero_key}`);
    this.log.info("starting p2pool observer adapter...");
    void this.setObjectNotExists("info", {
      type: "folder",
      common: {
        name: "Information",
        role: "info"
      },
      native: {}
    });
    void this.setObjectNotExists("info.connection", {
      type: "state",
      common: {
        name: "Connection status",
        type: "boolean",
        role: "indicator.connected",
        read: true,
        write: false,
        def: false
      },
      native: {}
    });
    void this.setObjectNotExists("raw", {
      type: "folder",
      common: {
        name: "Raw Data",
        role: "data"
      },
      native: {}
    });
    void this.setObjectNotExists("raw.miner_info", {
      type: "state",
      common: {
        name: "Raw Miner Info",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("raw.pool_info", {
      type: "state",
      common: {
        name: "Raw Pool Info",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("raw.payouts", {
      type: "state",
      common: {
        name: "Raw Payouts",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("raw.found_blocks", {
      type: "state",
      common: {
        name: "Raw Found Blocks",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("raw.shares", {
      type: "state",
      common: {
        name: "Raw Shares",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details", {
      type: "folder",
      common: {
        name: "Details",
        role: "info"
      },
      native: {}
    });
    void this.setObjectNotExists("details.miner_info", {
      type: "folder",
      common: {
        name: "Miner Info",
        role: "info"
      },
      native: {}
    });
    void this.setObjectNotExists("details.miner_info.last_share_height", {
      type: "state",
      common: {
        name: "Miner Info",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.miner_info.last_share_timestamp", {
      type: "state",
      common: {
        name: "Miner Info",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.payouts", {
      type: "folder",
      common: {
        name: "Payouts",
        role: "info"
      },
      native: {}
    });
    void this.setObjectNotExists("details.payouts.timestamp", {
      type: "state",
      common: {
        name: "Miner ID",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.payouts.coinbase_reward", {
      type: "state",
      common: {
        name: "Coinbase Reward",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.shares", {
      type: "folder",
      common: {
        name: "Shares",
        role: "info"
      },
      native: {}
    });
    void this.setObjectNotExists("details.shares.software_version", {
      type: "state",
      common: {
        name: "Main ID",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.shares.software_version_name", {
      type: "state",
      common: {
        name: "Software Version Name",
        type: "string",
        role: "text",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.shares.difficulty", {
      type: "state",
      common: {
        name: "Difficulty",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.pool_info", {
      type: "folder",
      common: {
        name: "Pool Info",
        role: "folder"
      },
      native: {}
    });
    void this.setObjectNotExists("details.pool_info.last_block", {
      type: "folder",
      common: {
        name: "Last Block",
        role: "folder"
      },
      native: {}
    });
    void this.setObjectNotExists("details.pool_info.last_block.software_version", {
      type: "state",
      common: {
        name: "Last Block Software Version",
        type: "number",
        role: "value",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setObjectNotExists("details.pool_info.last_block.software_version_name", {
      type: "state",
      common: {
        name: "Last Block Software Version Name",
        type: "string",
        role: "text",
        read: true,
        write: false
      },
      native: {}
    });
    void this.setForeignObjectNotExists("details.calculated", {
      type: "folder",
      common: {
        name: "Calculated Data",
        role: "folder"
      },
      native: {}
    });
    void this.setObjectNotExists("details.calculated.version_missmatch", {
      type: "state",
      common: {
        name: "Version Missmatch",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false
      },
      native: {}
    });
    await this.updateP2pool();
    this.refreshInterval = this.setInterval(this.updateP2pool, 12e4);
    await this.setState("info.connection", true, true);
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback - function to call after everything is cleaned up
   */
  onUnload(callback) {
    try {
      this.clearInterval(this.refreshInterval);
      callback();
    } catch (error) {
      if (error instanceof Error) {
        this.log.debug(error.message);
      }
      callback();
    }
  }
  // /**
  //  * Is called if a subscribed state changes
  //  *
  //  * @param id - the ID of the state that changed
  //  * @param state - the state object
  //  */
  // private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
  //     if (state) {
  //         // The state was changed
  //         this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
  //     } else {
  //         // The state was deleted
  //         this.log.info(`state ${id} deleted`);
  //     }
  // }
}
if (require.main !== module) {
  module.exports = (options) => new P2pool(options);
} else {
  (() => new P2pool())();
}
//# sourceMappingURL=main.js.map
