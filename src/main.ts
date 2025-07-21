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
    refreshInterval: ioBroker.Interval | undefined = undefined;
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
     * @param SearchLimit - The search limit for payouts, e.g., 0 for all, 10 is default
     */
    private genURL(Command: string, SearchLimit: string): string {
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
            retVal = `https://${url}/api/${Command}/${this.config.monero_key}?search_limit=${SearchLimit}`;
        } else {
            this.log.error(`Unknown command: ${Command}`);
        }
        return retVal;
    }
    private async readMinerInfo(): Promise<JSON> {
        // This function can be used to read miner information
        // It can be called from the updateP2pool function or elsewhere
        // Example: this.readMinerInfo();
        const reqUrl = this.genURL("miner_info", "0");
        this.log.debug(reqUrl);
        let jsonData = null;
        let validJsonData = false;
        await axios
            .get(reqUrl)
            .then((res) => {
                jsonData = res.data;
                validJsonData = true;
                if (validJsonData) {
                    try {
                        this.log.info(`p2pool response: ${JSON.stringify(jsonData)}`);
                    } catch (error) {
                        if (error instanceof Error) {
                            this.log.error(error.message);
                        }
                        this.log.error(`json format invalid:${JSON.stringify(jsonData)}`);
                    }
                } else {
                    this.log.error(`p2pool rejected the request: ${res.data.toString()}`);
                }
            })
            .catch((error) => {
                if (error instanceof Error) {
                    this.log.error(error.message);
                }
                this.log.error("p2pool request failed.");
            });
        if (validJsonData && jsonData !== null) {
            return jsonData;
        }
        this.log.error("No valid JSON data received from p2pool.");
        return JSON.parse("{}");
    }
    /**
     * Callback function for the interval
     */
    private updateP2pool = async (): Promise<void> => {
        // This function will be called every 2 seconds
        this.log.debug("Callback function called");
        // You can add your logic here, e.g., fetching data from an API
        const jsonData = await this.readMinerInfo();
        this.log.info(`p2pool response after callback: ${JSON.stringify(jsonData)}`);
        if (jsonData && Object.keys(jsonData).length > 0) {
            // Process the JSON data as needed
            this.log.info(`Received data: ${JSON.stringify(jsonData)}`);
            // Here you can update states or perform other actions with the received data
        }
    };
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.setState("info.connection", false, true);
        // Initialize your adapter here
        const reqUrl = this.genURL("miner_info", "0");
        this.log.debug(reqUrl);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info(`config monero key: ${this.config.monero_key}`);
        this.log.info("starting p2pool observer adapter...");
        await this.updateP2pool(); // Initial call to fetch data immediately
        this.refreshInterval = this.setInterval(this.updateP2pool, 120000); // 120 seconds
        await this.setState("info.connection", true, true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - function to call after everything is cleaned up
     */
    private onUnload(callback: () => void): void {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            this.clearInterval(this.refreshInterval);

            callback();
        } catch (error) {
            if (error instanceof Error) {
                this.log.debug(error.message);
            }
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
     *
     * @param id - the ID of the state that changed
     * @param state - the state object
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
