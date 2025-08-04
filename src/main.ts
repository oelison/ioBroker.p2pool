/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import axios from "axios";

// Load your modules here, e.g.:
// import * as fs from "fs";

interface MinerInfoShare {
    shares: number;
    uncles: number;
    last_height: number;
}

interface MinerInfo {
    id: number;
    address: string;
    shares: MinerInfoShare[];
    last_share_height: number;
    last_share_timestamp: number;
}

interface Payout {
    miner: number;
    template_id: string;
    side_height: number;
    main_id: string;
    main_height: number;
    timestamp: number;
    coinbase_id: string;
    coinbase_reward: number;
    coinbase_private_key: string;
    coinbase_output_index: number;
    global_output_index: number;
    including_height: number;
}

interface Share {
    main_id: string;
    main_height: number;
    template_id: string;
    root_hash: string;
    side_height: number;
    parent_template_id: string;
    miner: number;
    effective_height: number;
    nonce: number;
    extra_nonce: number;
    timestamp: number;
    software_id: number;
    software_version: number;
    window_depth: number;
    window_outputs: number;
    difficulty: number;
    cumulative_difficulty: number;
    pow_difficulty: number;
    pow_hash: string;
    inclusion: number;
    transaction_count: number;
    miner_address: string;
    main_difficulty: number;
}

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
     * @param Limit - The search limit for payouts, e.g., 0 for all, 10 is default
     */
    private genURL(Command: string, Limit: string): string {
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
    private async readP2Pool(Command: string, Limit: string): Promise<JSON> {
        // This function can be used to read miner information
        // It can be called from the updateP2pool function or elsewhere
        // Example: this.readMinerInfo();
        const reqUrl = this.genURL(Command, Limit);
        this.log.debug(reqUrl);
        let jsonData = null;
        let validJsonData = false;
        await axios
            .get(reqUrl)
            .then((res) => {
                jsonData = res.data;
                validJsonData = true;
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
        this.log.error(`No valid JSON data received from p2pool by fetching ${Command} with limit ${Limit}`);
        return JSON.parse("{}");
    }
    /**
     * Callback function for the interval
     */
    private updateP2pool = async (): Promise<void> => {
        // This function will be called every 2 seconds
        this.log.debug("Callback function called");
        // You can add your logic here, e.g., fetching data from an API
        const minerInfoData: MinerInfo = (await this.readP2Pool("miner_info", "0")) as unknown as MinerInfo;
        const poolInfoData = await this.readP2Pool("pool_info", "0");
        const payoutsData: Payout[] = (await this.readP2Pool("payouts", "1")) as unknown as Payout[];
        const foundBlocksData = await this.readP2Pool("found_blocks", "1");
        const sharesData: Share[] = (await this.readP2Pool("shares", "1")) as unknown as Share[];
        this.log.debug(`p2pool response after callback miner_info: ${JSON.stringify(minerInfoData)}`);
        this.log.debug(`p2pool response after callback pool_info: ${JSON.stringify(poolInfoData)}`);
        this.log.debug(`p2pool response after callback payouts: ${JSON.stringify(payoutsData)}`);
        this.log.debug(`p2pool response after callback found_blocks: ${JSON.stringify(foundBlocksData)}`);
        this.log.debug(`p2pool response after callback shares: ${JSON.stringify(sharesData)}`);
        if (minerInfoData && Object.keys(minerInfoData).length > 0) {
            await this.setState("raw.miner_info", JSON.stringify(minerInfoData), true);
            // Set additional details from miner_info
            if (minerInfoData.last_share_height) {
                await this.setState("details.miner_info.last_share_height", minerInfoData.last_share_height, true);
            }
            if (minerInfoData.last_share_timestamp) {
                await this.setState(
                    "details.miner_info.last_share_timestamp",
                    minerInfoData.last_share_timestamp,
                    true,
                );
            }
        }
        if (poolInfoData && Object.keys(poolInfoData).length > 0) {
            await this.setState("raw.pool_info", JSON.stringify(poolInfoData), true);
        }
        if (payoutsData && Object.keys(payoutsData).length > 0) {
            await this.setState("raw.payouts", JSON.stringify(payoutsData), true);
            // Set additional details from payouts
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
        if (sharesData && Object.keys(sharesData).length > 0) {
            await this.setState("raw.shares", JSON.stringify(sharesData), true);
            // Set additional details from shares
            if (sharesData[0].software_version) {
                await this.setState("details.shares.software_version", sharesData[0].software_version, true);
                // Convert software version to human-readable format
                const softwareVersion = sharesData[0].software_version;
                const major = (softwareVersion >> 16) & 0xffff;
                const minor = (softwareVersion >> 8) & 0xff;
                const patch = softwareVersion & 0xff;
                const softwareVersionName = `${major}.${minor}.${patch}`;
                await this.setState("details.shares.software_version_name", softwareVersionName, true);
            }
            if (sharesData[0].difficulty) {
                await this.setState("details.shares.difficulty", sharesData[0].difficulty, true);
            }
        }
        this.log.debug("p2pool data update completed");
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
        void this.setObjectNotExists("info.connection", {
            type: "state",
            common: {
                name: "Connection status",
                type: "boolean",
                role: "indicator.connected",
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });
        void this.setObjectNotExists("raw.miner_info", {
            type: "state",
            common: {
                name: "Raw Miner Info",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("raw.pool_info", {
            type: "state",
            common: {
                name: "Raw Pool Info",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("raw.payouts", {
            type: "state",
            common: {
                name: "Raw Payouts",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("raw.found_blocks", {
            type: "state",
            common: {
                name: "Raw Found Blocks",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("raw.shares", {
            type: "state",
            common: {
                name: "Raw Shares",
                type: "string",
                role: "json",
                read: true,
                write: false,
            },
            native: {},
        });
        //p2pool response after callback miner_info:
        // {
        //   "id":12345,
        //   "address":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //   "shares":[
        //   {
        //     "shares":0,
        //     "uncles":0,
        //     "last_height":0
        //   },
        //   {
        //     "shares":195,
        //     "uncles":2,
        //     "last_height":11366313
        //   },
        //   {
        //     "shares":0,
        //     "uncles":0,
        //     "last_height":0
        //   }
        //   ],
        //   "last_share_height":11366313,
        //   "last_share_timestamp":1754230754
        //}
        void this.setObjectNotExists("details.miner_info.last_share_height", {
            type: "state",
            common: {
                name: "Miner Info",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("details.miner_info.last_share_timestamp", {
            type: "state",
            common: {
                name: "Miner Info",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        // p2pool response after callback payouts:
        // [
        //   {
        //     "miner":12345,
        //     "template_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "side_height":11359661,
        //     "main_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "main_height":3469273,
        //     "timestamp":1754162211,
        //     "coinbase_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "coinbase_reward":219444964,
        //     "coinbase_private_key":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "coinbase_output_index":138,
        //     "global_output_index":136825676,
        //     "including_height":11357501
        //   }
        // ]
        void this.setObjectNotExists("details.payouts.timestamp", {
            type: "state",
            common: {
                name: "Miner ID",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("details.payouts.coinbase_reward", {
            type: "state",
            common: {
                name: "Coinbase Reward",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        // p2pool response after callback found_blocks: []
        // p2pool response after callback shares:
        // [
        //   {
        //     "main_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "main_height":3469837,
        //     "template_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "root_hash":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "side_height":11366313,
        //     "parent_template_id":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "miner":12345,
        //     "effective_height":11366313,
        //     "nonce":4294918361,
        //     "extra_nonce":957395883,
        //     "timestamp":1754230754,
        //     "software_id":0,
        //     "software_version":264448,
        //     "window_depth":2160,
        //     "window_outputs":653,
        //     "difficulty":141309770,
        //     "cumulative_difficulty":1659937539026060,
        //     "pow_difficulty":22673417117,
        //     "pow_hash":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "inclusion":1,
        //     "transaction_count":1,
        //     "miner_address":"45ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF",
        //     "main_difficulty":690295196720
        //   }
        // ]
        void this.setObjectNotExists("details.shares.software_version", {
            type: "state",
            common: {
                name: "Main ID",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("details.shares.software_version_name", {
            type: "state",
            common: {
                name: "Software Version Name",
                type: "string",
                role: "text",
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists("details.shares.difficulty", {
            type: "state",
            common: {
                name: "Difficulty",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
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
