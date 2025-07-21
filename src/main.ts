/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import axios from "axios";

// Load your modules here, e.g.:
// import * as fs from "fs";

class P2pool extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "p2pool",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
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
    private genURL(Command: string, SearchLimit: string): string {
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
    private async onReady(): Promise<void> {
        // Initialize your adapter here
        let reqUrl = this.genURL("pool_info", "0");
        this.log.debug(reqUrl);
        axios
            .get(reqUrl)
            .then(async (res) => {
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
            })
            .catch((error) => {
                if (error instanceof Error) {
                    this.log.error(error.message);
                }
                this.log.error("mediola device not reached by getting sys vars");
            });
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("config monero key: " + this.config.monero_key);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
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
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new P2pool(options);
} else {
    // otherwise start the instance directly
    (() => new P2pool())();
}
