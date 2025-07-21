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
class P2pool extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "p2pool"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
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
   */
  genURL(Command, SearchLimit) {
    let retVal = "";
    if (Command === "") {
      this.log.error("Command is empty");
      return retVal;
    } else if (Command === "miner_info") {
      retVal = `https://p2pool.observer/api/${Command}/${this.config.monero_key}`;
    } else if (Command === "pool_info") {
      retVal = `https://p2pool.observer/api/${Command}`;
    } else if (Command === "payouts") {
      retVal = `https://p2pool.observer/api/${Command}/${this.config.monero_key}?search_limit=${SearchLimit}`;
    } else {
      this.log.error(`Unknown command: ${Command}`);
    }
    return retVal;
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    let reqUrl = this.genURL("pool_info", "0");
    this.log.debug(reqUrl);
    import_axios.default.get(reqUrl).then(async (res) => {
      this.log.debug(JSON.stringify(res.data));
      let jsonData = null;
      let validJsonData = false;
      if (res.data.toString().startsWith("{XC_SUC}")) {
        jsonData = JSON.parse(res.data.substring(8));
        validJsonData = true;
      } else if (JSON.stringify(res.data).startsWith('{"XC_SUC":[')) {
        jsonData = res.data.XC_SUC;
        validJsonData = true;
      } else {
        jsonData = [];
      }
      if (validJsonData) {
        try {
        } catch (error) {
          if (error instanceof Error) {
            this.log.error(error.message);
          }
          this.log.error(`json format invalid:${JSON.stringify(jsonData)}`);
        }
      } else {
        this.log.error(`mediola device rejected the request: ${res.data.toString()}`);
      }
    }).catch((error) => {
      if (error instanceof Error) {
        this.log.error(error.message);
      }
      this.log.error("mediola device not reached by getting sys vars");
    });
    this.log.info("config monero key: " + this.config.monero_key);
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      callback();
    }
  }
  // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
  // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
  // /**
  //  * Is called if a subscribed object changes
  //  */
  // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
  //     if (obj) {
  //         // The object was changed
  //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
  //     } else {
  //         // The object was deleted
  //         this.log.info(`object ${id} deleted`);
  //     }
  // }
  /**
   * Is called if a subscribed state changes
   */
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  */
  // private onMessage(obj: ioBroker.Message): void {
  //     if (typeof obj === "object" && obj.message) {
  //         if (obj.command === "send") {
  //             // e.g. send email or pushover or whatever
  //             this.log.info("send command");
  //             // Send response in callback if required
  //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
  //         }
  //     }
  // }
}
if (require.main !== module) {
  module.exports = (options) => new P2pool(options);
} else {
  (() => new P2pool())();
}
//# sourceMappingURL=main.js.map
