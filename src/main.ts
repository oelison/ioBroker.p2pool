/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import axios from 'axios';

axios.defaults.timeout = 5000; // Set a timeout of 5 seconds for all requests

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

interface PoolInfo {
    sidechain: {
        consensus: {
            network_type: string;
            name: string;
            password: string;
            block_time: number;
            min_diff: number;
            pplns_window: number;
            uncle_penalty: number;
            hard_forks: Array<{
                version: number;
                height: number;
                threshold: number;
                time: number;
            }>;
            id: string;
        };
        last_block: Share;
        seconds_since_last_block: number;
        last_found: {
            main_block: {
                id: string;
                height: number;
                timestamp: number;
                reward: number;
                coinbase_id: string;
                difficulty: number;
                side_template_id: string;
                root_hash: string;
                coinbase_private_key: string;
            };
            side_height: number;
            miner: number;
            effective_height: number;
            window_depth: number;
            window_outputs: number;
            transaction_count: number;
            difficulty: number;
            cumulative_difficulty: number;
            inclusion: number;
        };
        effort: {
            current: number;
            average10: number;
            average: number;
            average200: number;
            last: Array<{
                id: string;
                effort: number;
            }>;
        };
        window: {
            miners: number;
            blocks: number;
            uncles: number;
            top: string;
            bottom: string;
            weight: number;
            versions: Array<{
                weight: number;
                share: number;
                count: number;
                software_id: number;
                software_version: number;
                software_string: string;
            }>;
        };
        found: number;
        miners: number;
        id: string;
        height: number;
        version: number;
        difficulty: number;
        cumulative_difficulty: number;
        timestamp: number;
        window_size: number;
        max_window_size: number;
        block_time: number;
        uncle_penalty: number;
    };
    mainchain: {
        consensus: {
            block_time: number;
            transaction_unlock_time: number;
            miner_reward_unlock_time: number;
            hard_fork_supported_version: number;
            hard_forks: Array<{
                version: number;
                height: number;
                threshold: number;
                time: number;
            }>;
        };
        id: string;
        coinbase_id: string;
        height: number;
        difficulty: number;
        reward: number;
        base_reward: number;
        next_difficulty: number;
        block_time: number;
    };
    versions: {
        p2pool: {
            version: string;
            timestamp: number;
            link: string;
        };
        monero: {
            version: string;
            timestamp: number;
            link: string;
        };
    };
}

class P2pool extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'p2pool',
        });
        this.on('ready', this.onReady.bind(this));
        // this.on('stateChange', this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
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
        let retVal = '';
        let url = '';
        if (this.config.mini_pool) {
            url = `mini.p2pool.observer`;
        } else {
            url = `p2pool.observer`;
        }
        if (Command === '') {
            this.log.error('Command is empty');
            return retVal;
        } else if (Command === 'miner_info') {
            retVal = `https://${url}/api/${Command}/${this.config.monero_key}`;
        } else if (Command === 'pool_info') {
            retVal = `https://${url}/api/${Command}`;
        } else if (Command === 'payouts') {
            retVal = `https://${url}/api/${Command}/${this.config.monero_key}?limit=${Limit}`;
        } else if (Command === 'found_blocks') {
            retVal = `https://${url}/api/${Command}?limit=${Limit}&miner=${this.config.monero_key}`;
        } else if (Command === 'shares') {
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
            .then(res => {
                jsonData = res.data;
                validJsonData = true;
            })
            .catch(error => {
                if (error instanceof Error) {
                    this.log.error(error.message);
                }
                this.log.error('p2pool request failed.');
            });
        if (validJsonData && jsonData !== null) {
            return jsonData;
        }
        this.log.error(`No valid JSON data received from p2pool by fetching ${Command} with limit ${Limit}`);
        return JSON.parse('{}');
    }
    /**
     * Callback function for the interval
     */
    private updateP2pool = async (): Promise<void> => {
        const miner_address = this.config.monero_key;
        if (!miner_address || miner_address === '') {
            this.log.error('Monero key is not set. Please configure the Monero key in the adapter settings.');
            return;
        }
        // This function will be called every 2 seconds
        this.log.debug('Callback function called');
        // You can add your logic here, e.g., fetching data from an API
        const minerInfoData: MinerInfo = (await this.readP2Pool('miner_info', '0')) as unknown as MinerInfo;
        const poolInfoData: PoolInfo = (await this.readP2Pool('pool_info', '0')) as unknown as PoolInfo;
        const payoutsData: Payout[] = (await this.readP2Pool('payouts', '1')) as unknown as Payout[];
        const foundBlocksData = await this.readP2Pool('found_blocks', '1');
        const sharesData: Share[] = (await this.readP2Pool('shares', '1')) as unknown as Share[];
        this.log.debug(`p2pool response after callback miner_info: ${JSON.stringify(minerInfoData)}`);
        this.log.debug(`p2pool response after callback pool_info: ${JSON.stringify(poolInfoData)}`);
        this.log.debug(`p2pool response after callback payouts: ${JSON.stringify(payoutsData)}`);
        this.log.debug(`p2pool response after callback found_blocks: ${JSON.stringify(foundBlocksData)}`);
        this.log.debug(`p2pool response after callback shares: ${JSON.stringify(sharesData)}`);
        if (sharesData && Object.keys(sharesData).length > 0) {
            await this.setState('raw.shares', JSON.stringify(sharesData), true);
            // Set additional details from shares
            if (sharesData[0].software_version) {
                await this.setState('details.shares.software_version', sharesData[0].software_version, true);
                // Convert software version to human-readable format
                const softwareVersion = sharesData[0].software_version;
                const major = (softwareVersion >> 16) & 0xffff;
                const minor = (softwareVersion >> 8) & 0xff;
                const patch = softwareVersion & 0xff;
                const softwareVersionName = `${major}.${minor}.${patch}`;
                await this.setState('details.shares.software_version_name', softwareVersionName, true);
            }
            if (sharesData[0].difficulty) {
                await this.setState('details.shares.difficulty', sharesData[0].difficulty, true);
            }
        }
        if (minerInfoData && Object.keys(minerInfoData).length > 0) {
            await this.setState('raw.miner_info', JSON.stringify(minerInfoData), true);
            // Set additional details from miner_info
            if (minerInfoData.last_share_height) {
                await this.setState('details.miner_info.last_share_height', minerInfoData.last_share_height, true);
            }
            if (minerInfoData.last_share_timestamp) {
                await this.setState(
                    'details.miner_info.last_share_timestamp',
                    minerInfoData.last_share_timestamp,
                    true,
                );
            }
        }
        if (poolInfoData && Object.keys(poolInfoData).length > 0) {
            await this.setState('raw.pool_info', JSON.stringify(poolInfoData), true);
            // Set additional details from pool_info
            if (
                poolInfoData.sidechain &&
                poolInfoData.sidechain.last_block &&
                poolInfoData.sidechain.last_block.software_version
            ) {
                await this.setState(
                    'details.pool_info.last_block.software_version',
                    poolInfoData.sidechain.last_block.software_version,
                    true,
                );
                if (poolInfoData.sidechain.last_block.software_version) {
                    // Convert software version to human-readable format
                    const softwareVersion = poolInfoData.sidechain.last_block.software_version;
                    const major = (softwareVersion >> 16) & 0xffff;
                    const minor = (softwareVersion >> 8) & 0xff;
                    const patch = softwareVersion & 0xff;
                    const softwareVersionName = `${major}.${minor}.${patch}`;
                    await this.setState(
                        'details.pool_info.last_block.software_version_name',
                        softwareVersionName,
                        true,
                    );
                }
                if (poolInfoData.versions.p2pool.version) {
                    let p2poolVersion = poolInfoData.versions.p2pool.version;
                    const myLastVersion = await this.getStateAsync('details.shares.software_version_name');
                    if (myLastVersion && myLastVersion.val !== null) {
                        if (typeof myLastVersion.val === 'string' && myLastVersion.val.endsWith('.0')) {
                            p2poolVersion = `${p2poolVersion}.0`; // Ensure the version format matches
                            const myLastVersionVal = `v${myLastVersion.val}`;
                            if (p2poolVersion === myLastVersionVal) {
                                await this.setState('details.calculated.version_missmatch', false, true);
                                this.log.debug(`P2Pool version matches: ${p2poolVersion}`);
                            } else {
                                await this.setState('details.calculated.version_missmatch', true, true);
                                this.log.warn(
                                    `P2Pool version mismatch: ${p2poolVersion} (p2pool) vs ${myLastVersion.val} (last known p2pool version)`,
                                );
                            }
                        }
                    }
                }
            }
        }
        if (payoutsData && Object.keys(payoutsData).length > 0) {
            await this.setState('raw.payouts', JSON.stringify(payoutsData), true);
            // Set additional details from payouts
            if (payoutsData[0].timestamp) {
                await this.setState('details.payouts.timestamp', payoutsData[0].timestamp, true);
            }
            if (payoutsData[0].coinbase_reward) {
                await this.setState('details.payouts.coinbase_reward', payoutsData[0].coinbase_reward, true);
            }
        }
        if (foundBlocksData && Object.keys(foundBlocksData).length > 0) {
            await this.setState('raw.found_blocks', JSON.stringify(foundBlocksData), true);
        }
        this.log.debug('p2pool data update completed');
    };
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.setState('info.connection', false, true);
        // Initialize your adapter here
        const reqUrl = this.genURL('miner_info', '0');
        this.log.debug(reqUrl);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        // This log is okay, because the monero_key is not sensitive data. It is the public address of the miner.
        this.log.info(`config monero key: ${this.config.monero_key}`);
        this.log.info('starting p2pool observer adapter...');
        void this.setObjectNotExists('info', {
            type: 'folder',
            common: {
                name: 'Information',
                role: 'info',
            },
            native: {},
        });
        void this.setObjectNotExists('info.connection', {
            type: 'state',
            common: {
                name: 'Connection status',
                type: 'boolean',
                role: 'indicator.connected',
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });
        void this.setObjectNotExists('raw', {
            type: 'folder',
            common: {
                name: 'Raw Data',
                role: 'data',
            },
            native: {},
        });
        void this.setObjectNotExists('raw.miner_info', {
            type: 'state',
            common: {
                name: 'Raw Miner Info',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('raw.pool_info', {
            type: 'state',
            common: {
                name: 'Raw Pool Info',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('raw.payouts', {
            type: 'state',
            common: {
                name: 'Raw Payouts',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('raw.found_blocks', {
            type: 'state',
            common: {
                name: 'Raw Found Blocks',
                type: 'string',
                role: 'json',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('raw.shares', {
            type: 'state',
            common: {
                name: 'Raw Shares',
                type: 'string',
                role: 'json',
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
        void this.setObjectNotExists('details', {
            type: 'folder',
            common: {
                name: 'Details',
                role: 'info',
            },
            native: {},
        });
        void this.setObjectNotExists('details.miner_info', {
            type: 'folder',
            common: {
                name: 'Miner Info',
                role: 'info',
            },
            native: {},
        });
        void this.setObjectNotExists('details.miner_info.last_share_height', {
            type: 'state',
            common: {
                name: 'Miner Info',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('details.miner_info.last_share_timestamp', {
            type: 'state',
            common: {
                name: 'Miner Info',
                type: 'number',
                role: 'value',
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
        void this.setObjectNotExists('details.payouts', {
            type: 'folder',
            common: {
                name: 'Payouts',
                role: 'info',
            },
            native: {},
        });
        void this.setObjectNotExists('details.payouts.timestamp', {
            type: 'state',
            common: {
                name: 'Miner ID',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('details.payouts.coinbase_reward', {
            type: 'state',
            common: {
                name: 'Coinbase Reward',
                type: 'number',
                role: 'value',
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
        void this.setObjectNotExists('details.shares', {
            type: 'folder',
            common: {
                name: 'Shares',
                role: 'info',
            },
            native: {},
        });
        void this.setObjectNotExists('details.shares.software_version', {
            type: 'state',
            common: {
                name: 'Main ID',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('details.shares.software_version_name', {
            type: 'state',
            common: {
                name: 'Software Version Name',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('details.shares.difficulty', {
            type: 'state',
            common: {
                name: 'Difficulty',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        // p2pool response after callback pool_info:
        // {
        //   "sidechain":
        //   {
        //     "consensus":
        //     {
        //       "network_type":"mainnet",
        //       "name":"mini",
        //       "password":"",
        //       "block_time":10,
        //       "min_diff":100000,
        //       "pplns_window":2160,
        //       "uncle_penalty":20,
        //       "hard_forks":
        //       [
        //         {
        //           "version":1,"height":0,"threshold":0,"time":0
        //         },
        //         {"version":2,"height":0,"threshold":0,"time":1679173200},
        //         {"version":3,"height":0,"threshold":0,"time":1728763200}
        //       ],
        //       "id":"3982c91a95aec7fa4250bd126cd8c2dc88173f184071dd2cdb5627a335187ec4"
        //     },
        //     "last_block":
        //     {
        //       "main_id":"49921b4cbcf988723f08cde635703f9e82c84370b82c56c27303f4b839b1928d",
        //       "main_height":3470472,"template_id":"f126d99776ad57faa36682eb867a5fd44f82dd06e66e55180b4519f6772e93f0",
        //       "root_hash":"57bbd14b63f187e30ab9d32306a3c38e6fffee4139f161003daa282cedc3efdd",
        //       "side_height":11374092,"parent_template_id":"f2731e5fe9a11209731ba5e54552eb087804d0ad6fafaf76764f9ce6c8f35c61",
        //       "miner":25015,
        //       "effective_height":11374092,
        //       "nonce":10232,
        //       "extra_nonce":1835395105,
        //       "timestamp":1754310728,
        //       "software_id":0,
        //       "software_version":264448,
        //       "window_depth":2160,
        //       "window_outputs":669,
        //       "difficulty":137557872,
        //       "cumulative_difficulty":1661029751467386,
        //       "pow_difficulty":191266879,
        //       "pow_hash":"a6687a7a8c830c89e89cfd7c44b42ad805da6d6684436e9aaeb3927416000000",
        //       "inclusion":1,
        //       "transaction_count":86,
        //       "miner_address":"43F9PUjjG9N82ivSEtQj19GBqXEaNDN1P8LUqMFDLqRNVUoNfr9yiUiXsxmzE2T5Jt7FY9tLpGfDB4cMWxqqAULf9aPD3JP"
        //     },
        //     "seconds_since_last_block":19,
        //     "last_found":
        //     {
        //       "main_block":
        //       {
        //         "id":"34154db30842a5071654e458aa72e6dd8ed55a27d135ce1d521f7acdcb9d7741",
        //         "height":3470445,
        //         "timestamp":1754307083,
        //         "reward":630527520000,
        //         "coinbase_id":"29efe7f6de9ba48bfb8ba7f698da9d0e9032d3857372d940c620ceb4c87e92c5",
        //         "difficulty":676207917023,
        //         "side_template_id":"b49305127b6c071ae585f6cef61442f5dcea961e229737259a136e958d32b02c",
        //         "root_hash":"51360814a6371075aa82e1ebff2e44d1139dba0d87132c3d8191af5a9f7b7174",
        //         "coinbase_private_key":"c5cb713711fff7cb87f1ea49b7876faafdb420bc9e69e5e2f5240244a3b8fa0b"
        //       },
        //       "side_height":11373737,
        //       "miner":19071,
        //       "effective_height":11373737,
        //       "window_depth":2160,
        //       "window_outputs":655,
        //       "transaction_count":87,
        //       "difficulty":134263769,
        //       "cumulative_difficulty":1660980431909314,
        //       "inclusion":1
        //     },
        //     "effort":
        //     {
        //       "current":7.277046622288886,
        //       "average10":155.74548440622334,
        //       "average":132.96031168898276,
        //       "average200":107.56093482246662,
        //       "last":
        //       [
        //         {"id":"34154db30842a5071654e458aa72e6dd8ed55a27d135ce1d521f7acdcb9d7741","effort":291.4022736576415},
        //         {"id":"45c0bed018139fcb486b103ef76f61d77d8e9e4e5cf7261e3470c5ce3100231c","effort":136.33265651131055},
        //         {"id":"8970be2236f31e26b55c9780bc259fed52d3ce545a503e47fad1dc9a7c99e65d","effort":230.17137672494925},
        //         {"id":"cf86240dfefa8cdb92af7e6e19cf92bacae6c51eb75e418a732daa94bdb51ec4","effort":63.041230656423664},
        //         {"id":"92babe0bd9d6c22acf550c1c17b6e14623beb298fc79a080ebe645f2976d934a","effort":200.027061913596},
        //         {"id":"d529c8fba979217d1981120b0954d1819904b47c68532e0e6c88bafc1ab78f1f","effort":80.68399156440736},
        //         {"id":"5796c0133e13d01e483158ffd3c3e9c60eab7f7743aafdd96b8635c4ae6d134b","effort":372.76552970597675},
        //         {"id":"8e968363cb29991f9a8837a73d0471294d78889f2e654743e31b75c5d1cac359","effort":29.020490683211158},
        //         {"id":"c6f6e4452ba7a5233b695eacf7490442e612c677b911fefb73667af1b80db117","effort":130.2747686025963},
        //         {"id":"7b3afd1f2ba5483d4d1a5dbfc82458ff802a46fdcab3b73d068b504ca1031707","effort":23.735464042120736},
        //         {"id":"31df1f52a9c8e6db39913cff574996269a8d7cd7cd568da527158b5e8aa18893","effort":167.0954988717625},
        //         {"id":"d941c640126554ebe35b8b222bcd72068034280f24dd7c291234007e39cbc0fb","effort":200.45907643952646},
        //         {"id":"d05d2d56030946a9defa03789cf0f609f25ae015e838d8da570f39c9698c2343","effort":46.383555796274415},
        //         {"id":"dc2ebc9710dca6b417127be6d515ce8f715320a424bdcadefad9cff6cd907ef2","effort":137.043963969148},
        //         {"id":"b2a94379bdc38b857f784c4ab6409767483cb13c26ce36dfabdce02d3870bc15","effort":142.1081630869209},
        //         {"id":"df2019a9c24ded9131cf02a1103a215b86b8965ae1dffdbcfd3c7d02430198b0","effort":79.75218222486068},
        //         {"id":"e94e4f98242cba3cc848796416828128cba3eb5cfcebc3248be109447f5821c7","effort":6.10176474536786},
        //         {"id":"092a720d2a5d48124dda9b093ef86dc86504b3210031a5c24cc780b6f61108a9","effort":117.29054048310265},
        //         {"id":"4eebd309dd156e1c0359b25c6d6e7cb36e7a56acfb0bbd0a2ceb0867cf814351","effort":57.39727141895322},
        //         {"id":"4f38d7f70122eed68fd1c0696fd36557b79fc0243c6e35d11fcc9dc75af382b8","effort":132.2461041742314},
        //         {"id":"0feb11f1c0fec7609e10497f19837b5e70d2c00b23e8ff247b693e93f64a3eab","effort":131.0848928200822},
        //         {"id":"ff3623f1c3246455105ccb985dc48aae9ee021468a108992ecb96e2ea48783a9","effort":109.0377156197355},
        //         {"id":"5d57b9f788b7e6211455cc21988f35723e38fd418ed7ee2b15c387bc5e37c8b3","effort":264.70700699505903},
        //         {"id":"d28335be3b8dad2873943e4ee198e01182c8c58755424f3ee34e9d94e08ee7f2","effort":145.27482410106919},
        //         {"id":"cbc3b333aa413e4d403e4b4b524a425f25b548b70b55cd3e5fbddfe7fde740fd","effort":48.835858213206805},
        //         {"id":"dcd40df386f09b32214e3922295f577371d12a813301a32169e6adcaed2b96fc","effort":40.78659197748349},
        //         {"id":"b31324361bb693b3edf686c62a764e4d9bda779e9b92d030390ce45f3fe3daf0","effort":5.106369001289908},
        //         {"id":"f18ee67fd657801239e14d51616d3bd7d508b3f542cbc6a578dbb371f8408039","effort":282.13497231762375},
        //         {"id":"4650ee0e1b28291741ab8929fe1b9a4252a65917feb147bf3a4e684b3b9c255a","effort":219.8610831789604},
        //         {"id":"bd3fe66f76ec1e3b18b01eb98b3cba1f83591dc12d9e432f67ebd9bef0971fe4","effort":99.79562080340936},
        //         {"id":"bcd60b9999ff9599e73f759f5c85cc694cf5efeac8995f5fb175174933df2008","effort":666.7731405441826},
        //         {"id":"54b3da7974cbf46dc5c79abfa81fda034e1623483d0514d6ef36a278c1c37671","effort":115.58055666154328},
        //         {"id":"faa9531fcd43c672248e3c6d94b298763a43a1d139fc98e7d9a7000a6eec4768","effort":297.2510957052254},
        //         {"id":"311e04ffb8b8ca9639268e4304c32927f468434657861f28ecc89b48cbaaa0d3","effort":47.194998183955455},
        //         {"id":"e5ffc429cdccc569ffb74ba7216eae1fc9d47bb9be924cdfdd8bdee186af4e61","effort":7.834237020277659},
        //         {"id":"7d945d4bc0a7be4e8d517a937e4d724ddc8fa70b3dc3d9d8850e2186848f1f3f","effort":69.39436372709145},
        //         {"id":"cfcc856429ea1e83a71cd8edbf585a69ab13cf37f99ccefc524b978432394144","effort":2.6175996097258154},
        //         {"id":"69d6c9304e8e4f0af095e2c0a6029cb17ef4ca10259c9cf39bf8ca1456490022","effort":6.057813914710331},
        //         {"id":"65cc8b144866051d1873797ff81eb3cb655a86d37e2c06f5a462e0c55c04de00","effort":37.93227108079429},
        //         {"id":"9fddda0e57df34f0043e8b0ff399a6befd87f7618e7619baebd6ac097ab1412b","effort":1.2679104104933094},
        //         {"id":"e5e303aa0c6d3d74243e10a498225a184d8297e469a6f94f84e4d31ad400c126","effort":261.7019029290623},
        //         {"id":"88ca0317959df76e62d7751295e67b405c7efc3bdf880382b822ffce9f8c01fd","effort":29.974338533062728},
        //         {"id":"2b9f92f8f8a6dc1467c1c4c21b6c6a54ffe13af46346cf661933d70bfaa84c8f","effort":108.74420597454112},
        //         {"id":"6a8c4187f16fa737049694926653def51f6c3253013ea33ec26fa0c3e5594456","effort":21.296167295996614},
        //         {"id":"865353879ff418fa59f46a3a7c2e1a932379a2b29ff70c2b5cc5eadddd164d88","effort":220.18944864398105},
        //         {"id":"96863ed59db4ba825a28841767c1857a89e3d0f0e394979adef86291d9726d6a","effort":170.39139546639265},
        //         {"id":"4cdd98252bc62219bd9a32d3093a476f673011c10f81029765062f506f47aa31","effort":286.3236677398956},
        //         {"id":"a1147630a663a64adfcaee83215d886d41d65e7bae0bbd0b7e0063b1135a9115","effort":7.791012994314767},
        //         {"id":"6b4ab1a0e5dc0d80796e72d25726c15055855229dc22a30641a48cfb2bba2062","effort":54.614902340339555},
        //         {"id":"d6c84e5bd7bbf90bb4628b3bef9568f8e47c6073ac7ce10fd662448055dcf0cc","effort":245.1266553732514},
        //         {"id":"59a33a90c1a71997babc4209ae1e65ff7b7e74a62ec05ed129998c32a55d2705","effort":13.082320371276705},
        //         {"id":"7e68a08c68909adb206c6868268fab50880a9e7036ddd8abdb0fcd4860be9cb7","effort":42.820879489716006},
        //         {"id":"bd3f0011290a6b30d575f6a09d8ed528b317576dfedcb731be9f72b09b2c69d7","effort":8.845188709274032},
        //         {"id":"f6d8dbd1f1fb0d5ac0b5a62ccc28217b1cb3823fad2e43fd4b4b6b8ece5703bf","effort":375.21929275693407},
        //         {"id":"f18b9acc5a21fc1883c4c1a7c561cfa3a7abb6346c615fd5d717b749d4ae395b","effort":70.13806069086819},
        //         {"id":"9d3e16644f7f626a15d7e51e6f34481bc8ce31c86959feac4e1bdfadbcb051fb","effort":227.52002539307054},
        //         {"id":"d92dd74216a746a3676241844c5459c033d27293fdade876f7a83117daf38560","effort":12.184550175993731},
        //         {"id":"5b09bb6fd6a3cc44187ce943aea5dc188ef479596b3264a3e5eaad0bc975b4b7","effort":44.679903858440106},
        //         {"id":"9ca740a88773e591814e0a9d2b79bbf5738e358e90854234497987d29b4054da","effort":194.47870230126523},
        //         {"id":"0d432bc30d1826f5ffe85d55e7d7a1db1ec3164e6c6945340caccb4fe63f7c58","effort":312.6931693274123},
        //         {"id":"4a8446a5918bbc8a6897a849a9babd093320d7100b6dfcf08bf668ee6b5ccc21","effort":167.94327006957383},
        //         {"id":"b8d0ac93a197bfa90536493ba23004a28daec7e8284fb81a4d7192cd20841b55","effort":201.349737711108},
        //         {"id":"6b6800cf70e5c870c3117765000571fd39cb3b1d314ab816ba4109dde5f27434","effort":55.339603346622184},
        //         {"id":"0736693e92efa4d57b33b0392aaee4c4377b7fd576b6a361d346257defe00f38","effort":80.3323402454703},
        //         {"id":"146c2b02a0b8fde247dca1bb3a7b9b1d3cf09738068023c62198cbd798e5cf8f","effort":94.21357230993299},
        //         {"id":"45ed4f438abde9995366d7451570f3dfd901c5e3f5db7bdf2d87a02e143395f6","effort":84.87587906755182},
        //         {"id":"93b13b3e18633b7b778a539802c1c4cce386d2b506186d55d4c75c97f2a40377","effort":118.16747516485125},
        //         {"id":"e14c0d78f385e4a51811b73affd3294a8fc848b72f5b0d8faff861fd122f906f","effort":85.44649112847245},
        //         {"id":"7206c0d59e268b4b41f440b232f3854300cd918e3fa67336a58cdfac57fc5bd0","effort":14.36452961521712},
        //         {"id":"92a45b1fded19c2c7cafb66ab89340840a0039293483f5262a8c517bfe5e8fd1","effort":19.239255399520925},
        //         {"id":"5ec7db15cefbaee3263c8f7c4c55f1b001dbecbeec7a65e5dd29a49523303532","effort":124.39809473413975},
        //         {"id":"8659bca1d212a93ed9ac0739af3ce958b0bc616905ac62493480e66862b36d01","effort":173.90767393166334},
        //         {"id":"ac70ba5a55915e7c2212f05c7690e17ff20367307b8c6da877b88b513b791f92","effort":25.97399493328451},
        //         {"id":"87eb48060d38f2df423f85478c00565363ad511ce1e600edb3eeb9701e8e448e","effort":143.1573543740596},
        //         {"id":"4cab84cd84dd2ba6aa772e63d9478692e92a2936f90c0364bc699e5fce28fee6","effort":145.3864256573549},
        //         {"id":"bdea18e998a5dae053945dbb284e64d7f2869a2f18142b2f76a4f32ff7264309","effort":69.36571966687028},
        //         {"id":"b204914d3703da834b732c0a523b74f2aea7be2ee8bab7e8236716b1071b080b","effort":83.09912261168306},
        //         {"id":"eb9f8548efbe73d79e7b11912cd161377b38d3b1a09aba2fabe892303e8eff06","effort":105.48468216971322},
        //         {"id":"ceba4f24a8ab7289c3fdc78021d639299236e43a8b444e7a55c53d000fae3063","effort":35.3345143957912},
        //         {"id":"637a8c5f84e93c9d7414fc9e42b79df33f58d547ca3907e12b35f607dbf1e5eb","effort":86.49824941876909},
        //         {"id":"2c8958edc2eb38b3f616a3eefb6c83a2caa90d2b1b3fa6e653543a05c2eb58a4","effort":11.62071411523966},
        //         {"id":"f0ac9f2265e4a280de483c01754b8909979ee545872b358d9ef3af14e68f9c21","effort":104.57480425435779},
        //         {"id":"03d31412a08ca5b7dc8eedf8e136148a8048799ab146855de8bf851e2354b146","effort":71.3952173110275},
        //         {"id":"a6c8f56efebcbc847c14a6afa90fdc4d8da4a3331ad62a9c1aa41e9beac286eb","effort":16.20045050470863},
        //         {"id":"e318f1e8a49c2928892ad4cbba112fd176cd29e98014d55098bc4bc43afcad06","effort":104.22838337348382},
        //         {"id":"d3a5135ee64d9df677182ad444b428cde7f88b003fbc4be554129c1b8bc35f53","effort":237.33973548949834},
        //         {"id":"f8a1646368a412a9045a95d9c0ce3bb33b36c4df97e6caddbaba970ef2ae9083","effort":180.12723473953542},
        //         {"id":"69d53c4ebbae8f0fd11c241fb56ecaeea04ef5a08a475d6ea89f50eec0ca0af5","effort":32.80223833613439},
        //         {"id":"3dbeafc315d4c109a89a3a0e82dcd85735b9d5469e189cc8d58d3d9866b105c4","effort":52.25460653733637},
        //         {"id":"4e7cad2757c6cd909d9a994e20aa7d231aab75aa90d3bfd9bb83a9f45476e83b","effort":10.412123816405437},
        //         {"id":"48aa68df88260be25e08b6465578111c039174ebfda146725421370ab65dd274","effort":10.24223656391687},
        //         {"id":"28088b4819a6450fb1038d94c48d18d4d6f1bb4d7ca4db4906eed6ede00f6079","effort":36.41737745602247},
        //         {"id":"62dce6fa1d9faf129771edc4775d11c2ca711a612481338598a5fb897780c670","effort":314.5210279100206},
        //         {"id":"82027d56f7369fe561b2c9ff15e7fb187b550642ab46367c249fb083ede5d154","effort":31.0697101618657},
        //         {"id":"74018fd9c9f343cfccf1f7cbb2ab680dcb9d2de14a79b013a49a5b151f409adf","effort":288.61310220084084},
        //         {"id":"3573755374f6346aba869308b547740a8c7c561aedff171e3329c3b4163611dc","effort":310.87270922011237},
        //         {"id":"18df046c00ecde699ccc36be2bbda11b944edf7c2fc5215c2ec6dd96caedcf57","effort":508.89149020673193},
        //         {"id":"2398ea0a8394141efa5d7f64d1a79babda54f5b661c5dc43433b4817d751565b","effort":60.79259406894359},
        //         {"id":"4343d20eb03c4913b804eef951bb426b8e7a75da3844b0af5bcff82b91c0d017","effort":51.47777102236525},
        //         {"id":"f9071e04d2f596f78a020a27bdb155e4a4cbda84c6c84d044e54c36d57e057d6","effort":0.4194766696409994},
        //         {"id":"6460578706085fa3da6fc6dc19759ba0ca083970fe284c3bf97d1f7e4c269972","effort":23.613892271111272},
        //         {"id":"1697defbc6f5e1690f5d0c7c96eb7c2ee2099f997e80f2af725bc7706c6aeb81","effort":130.69177349154512},
        //         {"id":"5bf8a8db3b0919f8e39a51d26a2d9119d83da1203ba95e662cb5d4a20c397bef","effort":23.227665259484365},
        //         {"id":"86b871ecf38552731f883e1516c451a3537279814c8e9f3254a577f96190c0fb","effort":79.27077610419516},
        //         {"id":"0476032f4af6636b089a4d3bb252ae4f38d357b24f34dc9e35aa4001ea618815","effort":6.6636846428095575},
        //         {"id":"ed393aabc4d6e18ede5d4b03b8c41034661d75929eb13b721b741b483c6915bf","effort":200.04629835974438},
        //         {"id":"e033953e2e59ff58512167570fa057e8add4bafaec2a0fe87d98cf9afe1b95e7","effort":138.8139613393962},
        //         {"id":"93ce7fe380003a8836c5641fb54e43358bc54f30af17f3bf766217b389c00aac","effort":98.67712398702263},
        //         {"id":"aa5843c09447893e658d6957e85503aac2a3e2be8b84a46368485ae1a19869f6","effort":95.29885493480498},
        //         {"id":"847d5d5b11b2246f49b03b650fdfe82317a903cfd721204a932ddca736d1e4dd","effort":8.030712246828859},
        //         {"id":"317ebec70d8b60267ab5f25e3127c68849097463fc7040c01deeaeaced49d59e","effort":103.34526103173364},
        //         {"id":"5bf79817607f4f5a7df9e62121f6a0f2280b7396250f14c7ba9c5806bc369f12","effort":10.171031725987254},
        //         {"id":"5b8fe3d0c331f55bba4a5e2686ac12a3311cbed1dbbb5946d76396404f81a416","effort":46.70562576509842},
        //         {"id":"033ec3f5dd33b394d9e96e442bca52451e58bdac0e6c2a72613e1f6aeebc4c6f","effort":142.68932974937889},
        //         {"id":"aff382e34569fa8c629426f5fd78ac993847cc2d3d89d41965a1e325c52cc8a6","effort":680.1586501992562},
        //         {"id":"3a36aa560a7980c1e87d8f704068100f2b0f9b82dbe00138ecbcab0bcef1528d","effort":34.91712257595562},
        //         {"id":"6ea3f578e8c690eb261b7c71e2a9842095bfc619b57df08d43c336cae5b733eb","effort":31.175766530197908},
        //         {"id":"1c9d8600283b94410a1a58251340d12bed6793d6a200146ec21db0ef91c8dcd9","effort":102.15375409826339},
        //         {"id":"11bb054b9e07fdc52c0e46f8dce00a34f1c734f8e8bf40bcf32b9c0741bb88e4","effort":149.51936176631492},
        //         {"id":"edd0a055bfd7f42454a1d338208f931aff5e01bd7f3fcae05967d4ffd54bf777","effort":35.757341340574435},
        //         {"id":"70ebf94ac2f96a81b0417e5cd39a4627d0a917e280460645f873e97b39f9d662","effort":122.47822966313989},
        //         {"id":"1e4446882aafaa7b138b4006fa9593ec21b867a7562dca472cd37c99b4549006","effort":14.552069854623326},
        //         {"id":"54b8fe650c314f502c9bf079fe1a56f0df8d52afeb34a57cf26db2b255bbfa26","effort":282.33371841395353},
        //         {"id":"a18f3ba102157b04c64dc83b5f43799a98272357c35399e3acf2c28ff1bb6817","effort":208.64887377524667},
        //         {"id":"aed5b97501338774149e887f072f128ad33c93a3d208db14f3e92f5b1e005852","effort":111.12265832418846},
        //         {"id":"9e599f3a085ee247626999baf5418299c07ab42308355645a2f30c6ab62908a9","effort":55.802517026381885},
        //         {"id":"a1e39434a44a469a33419e8a0d89208918fdb02356cc2b1d3efe7962afe8330d","effort":149.86504632269776},
        //         {"id":"6e3482a64199de8f5e44cf8ac37432220e703be11bfc5ec84649dfcf16f34396","effort":16.833736155037364},
        //         {"id":"eaa3f3ebe2046857b818b819e412a7b8e3681d122b7769d149b9e51c7d1e4102","effort":441.1062637453999},
        //         {"id":"7604a6ef8077b7c36c2a320129877ec44fb756a5fc0bba03f7102dd9ce572f3f","effort":17.341195908985156},
        //         {"id":"47361281b04119a004878415417819745520bf0f97f0e0d371a0c116a7fb582f","effort":47.555492756078344},
        //         {"id":"177671dcb875cd78e93501be73874481b485ee3b3db62b22421b3910d644d522","effort":115.31340133814476},
        //         {"id":"75488075d2d7c3150a1d8f4f541a5ddf228596d0248748ca4982b2b89d80a999","effort":129.76542855145755},
        //         {"id":"baa0ab9d4a09eecfffc283255ce53b7f877c0f04d9d23172a5711ade4b19c431","effort":44.72219196029789},
        //         {"id":"0ee78b4715552cb53ab9e90240f0d86e6fcdad43914fe884e83526667f1efceb","effort":124.44582277004103},
        //         {"id":"644f4f04324c4236ef28f7e69cc85272d5c3cc02cf1ed479dc8277f1a309e7c8","effort":47.44165000784735},
        //         {"id":"468b2eaf6423a65b91910b14ca1b197e55f8e3ea2f36ae2cdc6be4f9d5496140","effort":24.654779066865363},
        //         {"id":"8a1b45aedb04f6222ad8a9bdec4ea18ec3aa798f5856b5f0e8cca2dbbf1d8cad","effort":337.8868004774216},
        //         {"id":"53ad7fe2b60e9f4a118f6b6e1a4ef6a8577b5121bd413c9a91a7d54019ac7b1c","effort":48.65297375141682},
        //         {"id":"de072bcd2745088bdec16a79a210887deacd107dff86f74c4a7c30daeccc0772","effort":149.39247538227397},
        //         {"id":"07c3f4c1ed6b14ed62e4b26ce28d4ff62fa0b2a851bb0b7c3cabaede57d7c252","effort":215.15354487167622},
        //         {"id":"af1cacbbebeb9d76bed913d90d6438560aa022a68588c52a45538743a7e7d3af","effort":42.411671468762705},{"id":"d48b6beadc7e4e2168470ca35d990e3b05fcb3dee8990d083251504d9ab2e84e","effort":23.80830068845076},{"id":"b54a6b03525faf24772501b0d4eecad916cacd5c33519829031c101732c101c8","effort":53.82666925698243},{"id":"d51151c38e73dc4a3f401b38032b256755e93039177292554bf9dd8e668b38ba","effort":16.156812343621922},{"id":"f0d644e52610045d56e10c4e6cc3eac299a1d75c826efc079f6774704361132b","effort":457.4893697825403},{"id":"702292f1e6a1fc512d3fd6d39af68e18a668243949e675c38131af5dc1e976a7","effort":69.43659473395104},{"id":"50050e7b3e7f8cf64a3be3888277102373f7bb29e85190f4a49f802acee7cf91","effort":52.15680041515292},{"id":"b7dcc5a66fd997e365db7b25174d8af3a707c00716d24e1fbf093ddba13d2fef","effort":68.08937501811934},
        //         {"id":"7bbcc66340d0826ff8c8c619a6861538910f1e606cbcd51c9f6715fb3302692d","effort":89.9266886498939},{"id":"9d684ea498594c7242d973c763b13ca12c0ce5466540a5749bfa3c8f047f1b22","effort":79.56316514181363},{"id":"1b8f021539bc25e4489f3d8604e0e5fcee0949aaffa2204a0bbd8c12ff996bc7","effort":7.6754519721502},{"id":"efb3aa7fccef90c90a4a05ee6628980431bc076868f24dd1d1ba0fe6674192a3","effort":90.26022502923416},{"id":"9e90b228b7a54efb20298c2edc792c219d2db74fff4bd7024931692612d44bb3","effort":10.401316463973888},{"id":"8ba268b6e8c35c617997c42720566a6582e19c74c847c6ba38da4a76a2d54709","effort":91.95826753738947},{"id":"178e69d4bbb390fbb00624ec7a0762ebfb103cbf766d0af94c37a966ce79d41c","effort":13.126117572993234},{"id":"7f703aa0ea2ec323fc33d2e7c9e05a8c82110bea14f3a4aa9c246d82d7fea052","effort":110.29046510930414},{"id":"1a0b85eb397e6aeb5dae674fb96a4b686cabf35f05429dc85ad891025541789a","effort":203.36632031038374},{"id":"0b56d7c9d0eb8091b2e523d0effd55f25c928644c9ef62671ec2653a61cea959","effort":6.3675561076287215},{"id":"68ff9efbc2c899139e8d17de0e5e0e2c9faf9fa92613a4aabd6b5d778a12da30","effort":114.10195708183417},{"id":"45fb592e5758143582bf09c0d8cc01f6be259a1a69b5177944ebf04e5ae51a0a","effort":83.15403999231646},
        //         {"id":"73200c3dc30b1646a997569b64ed70f864256e264fc6904e6845442d6ddbabbb","effort":1.3959510828224904},{"id":"cadfa674ae5119e49ed5a4d71f93156524a17f3e4a828e55b052190499bcedd2","effort":68.89242625321039},{"id":"f605054eed4226a22f1cf5d53db9c2f3777131c1120f630dd97046e4404f7e7f","effort":238.83943993503345},{"id":"6144df7bb4052e5b57964be01fb6893628698e7efe069eab409c01d7259a7b96","effort":96.05942162337087},{"id":"e2e5f27ee628faf6e66171c783c5a589bd2dc91615e1ce708507e8c6694ff37a","effort":29.615476780160826},{"id":"612fdd3a37624025ef98471d6ef269af6436ecc27909865231bd0465d6d593e1","effort":9.147579980503863},{"id":"920b3d8faec3155598dda77dbefd7930b395435f504988dc36fd076ebf802597","effort":141.825581717476},{"id":"62650af8f266c5145e4b5f36bca23f686301687738275101513a68efce068187","effort":50.75267860524808},{"id":"3335f6f359b993a56db7518df6f85a4818012bb9c97c86a030f7ca18c4e2db93","effort":241.19961728475224},{"id":"288f5b17b5d8f626eca96df7c6685f4aa23d58001df153ce6de29ff366cce989","effort":306.1954017530181},{"id":"0f8a34b457d003c016c7e0e0952993e533237dae6acafd284be288aaf4062576","effort":2.1713784467105826},{"id":"d3bd47faaf3b2d9828647353cf0abe8c62262c552bba9330c4488176902e1685","effort":40.25456109065231},
        //         {"id":"87a1056190a518f2a2970cea1fa406cb4be9baab45c0533508a59cf0fe546d90","effort":86.43730117221142},{"id":"4ba4eef74158505e848b42593c6aec93d8fdf4bd95f0827ce9ef2a5ed4793f42","effort":7.335243767319016},{"id":"55ad88bc6928780d6344feb77eadd1292a832f5b1fdaa8f822d559f795d9860f","effort":40.78156531668689},{"id":"f2dc7b75519af1491d3d4a8441ab786886baede5366eb0b09ef90c2e6aade162","effort":28.032378773792924},{"id":"29ee1c9ebb32250726e345302b40aa92c5e8c5f92dd538a5d133238e6c67f4c9","effort":13.067882332999671},{"id":"baf3d2017bd1d51c3e31de3f14aeef1702037e661e38d46880d32d0f6a7dff16","effort":89.36212457008729},{"id":"2b2c6e8096756e4d5ab64b436d4169050123b2edd4b629461d83c4945782e686","effort":91.49430920313726},{"id":"172b8399f9ea04cbd10007d90ec3d424cd12cc0128d8b096e3a77b46c1828788","effort":97.3374827172778},{"id":"4b47b1b53f0140473260d710f3b726d8b41c6e8cab187272a7289e3163a5a5d8","effort":83.69230490228844},{"id":"d5bed0207e42ef34a4de85363bccb8ef12c18bed2b1bf857f412c4ac3373440d","effort":15.973171861813267},{"id":"b047bcf94415fb6cbefaa1aede99758b49000a35deea285ea1af75de2d2cbffe","effort":67.06127246915791},{"id":"0c7b3fb1a191aa0ea8c9734268c85684a12caef5bb3d9ede27368477ddf81773","effort":79.48549723224858},
        //         {"id":"2b221401961cbfdb5b537c17107b5f7a130f6aac4a65e4406427422ef78ace76","effort":30.142740670890923},{"id":"ca0b11cfc2237522e4e1a355c54a40c2df2952d4b55f91054597770f2a79543f","effort":29.826733096588153},{"id":"95f93299c2e157a30875e6ea314591e5c47e817ce5648cd0e51746b3dd4f4aa7","effort":199.81585714735255},{"id":"ded3c87c41fa004edbadd0921b618f856201b8394912a3acb80f5d619df4c3ef","effort":33.03888419569333},{"id":"2a6a6e1ffe06d6ad003bbcaebb4152afd7a7b1ab6d19aee0517ec475f4d434d3","effort":33.13353502591499},{"id":"f7ef64ba0d61865bb0bcdcfef2c218a2540e3b5a5d413f9469b313dadde30623","effort":18.507540797306124},{"id":"2b050861d715c4e1901d205317657a01066ebcb3e9dc4e08c9d9a6cd0c979e33","effort":60.252918907107265},{"id":"2696a3391b121875427ccfd7cbac05363f4a353f8f16557e73cf87c3cabb234e","effort":29.522581781929837},{"id":"8f814f8cc01ff1ee21415474c4759575b4e0633937bd895b85fd461e67e7e62d","effort":60.716170813299364},{"id":"857b82c69f47651848512987dcfc656f0286a84dc7a81cb0bccfb0344546c89f","effort":89.86252881830046},{"id":"7e520a773e39838017e2d90b2f6a4abe81626f3d53f181a6e05ae2b84f542494","effort":63.840945919664115},{"id":"e4453e06f65bcf2f08d246fbfdc6e727ca6cca9674f4150e80c382800705a6e4","effort":23.586616266301327},
        //         {"id":"a1d50bac4b407fa330279991591218574ac585a5de71b73a7d155f3961b9c285","effort":27.8281356761669},{"id":"2a885c42fcb38abd6c2458ed62ee8ab2489bd755828d0def7811ca53e5fc517b","effort":5.644100590153402},
        //         {"id":"fc75dc3c783f147f6b9e5e0c2123fb252d3210f6f7f46746f31b2c076b8732f6","effort":52.664936262073276}
        //       ]
        //     },
        //     "window":
        //     {
        //       "miners":669,
        //       "blocks":2160,
        //       "uncles":60,
        //       "top":"f126d99776ad57faa36682eb867a5fd44f82dd06e66e55180b4519f6772e93f0",
        //       "bottom":"c51f8c02c9670bafe7693b58530ce4123a68f41b5714fce3fe0442239a051fdb",
        //       "weight":305772667013,
        //       "versions":
        //       [
        //         {
        //           "weight":110207300031,
        //           "share":36.04223396014481,
        //           "count":799,
        //           "software_id":0,
        //           "software_version":264448,
        //           "software_string":"P2Pool v4.9"
        //         },
        //         {"weight":67722014773,"share":22.147831405127125,"count":493,"software_id":0,"software_version":264193,"software_string":"P2Pool v4.8.1"},
        //         {"weight":39599960750,"share":12.950785018438681,"count":286,"software_id":0,"software_version":263168,"software_string":"P2Pool v4.4"},
        //         {"weight":24493669492,"share":8.010418240214598,"count":179,"software_id":0,"software_version":263680,"software_string":"P2Pool v4.6"},
        //         {"weight":18964479841,"share":6.202150122265088,"count":138,"software_id":0,"software_version":263936,"software_string":"P2Pool v4.7"},
        //         {"weight":15257450716,"share":4.989802020254258,"count":111,"software_id":0,"software_version":263424,"software_string":"P2Pool v4.5"},
        //         {"weight":9289993039,"share":3.038202573745754,"count":68,"software_id":0,"software_version":262912,"software_string":"P2Pool v4.3"},
        //         {"weight":8052028920,"share":2.6333383551439757,"count":58,"software_id":0,"software_version":262400,"software_string":"P2Pool v4.1"},
        //         {"weight":7702528936,"share":2.5190377580977588,"count":56,"software_id":0,"software_version":264192,"software_string":"P2Pool v4.8"},
        //         {"weight":2066002271,"share":0.6756661055359025,"count":15,"software_id":0,"software_version":262401,"software_string":"P2Pool v4.1.1"},
        //         {"weight":1728494390,"share":0.5652874100504583,"count":12,"software_id":0,"software_version":262656,"software_string":"P2Pool v4.2"},
        //         {"weight":688743854,"share":0.225247030981588,"count":5,"software_id":0,"software_version":262144,"software_string":"P2Pool v4.0"
        //         }
        //       ]
        //     },
        //     "found":4354,
        //     "miners":25344,
        //     "id":"f126d99776ad57faa36682eb867a5fd44f82dd06e66e55180b4519f6772e93f0",
        //     "height":11374092,
        //     "version":3,
        //     "difficulty":137557872,
        //     "cumulative_difficulty":1661029751467386,
        //     "timestamp":1754310728,
        //     "window_size":2160,
        //     "max_window_size":2160,
        //     "block_time":10,
        //     "uncle_penalty":20
        //   },
        //   "mainchain":
        //   {
        //     "consensus":
        //     {
        //       "block_time":120,
        //       "transaction_unlock_time":10,
        //       "miner_reward_unlock_time":60,
        //       "hard_fork_supported_version":16,
        //       "hard_forks":
        //       [
        //         {"version":1,"height":1,"threshold":0,"time":1341378000},
        //         {"version":2,"height":1009827,"threshold":0,"time":1442763710},
        //         {"version":3,"height":1141317,"threshold":0,"time":1458558528},
        //         {"version":4,"height":1220516,"threshold":0,"time":1483574400},
        //         {"version":5,"height":1288616,"threshold":0,"time":1489520158},
        //         {"version":6,"height":1400000,"threshold":0,"time":1503046577},
        //         {"version":7,"height":1546000,"threshold":0,"time":1521303150},
        //         {"version":8,"height":1685555,"threshold":0,"time":1535889547},
        //         {"version":9,"height":1686275,"threshold":0,"time":1535889548},
        //         {"version":10,"height":1788000,"threshold":0,"time":1549792439},
        //         {"version":11,"height":1788720,"threshold":0,"time":1550225678},{"version":12,"height":1978433,"threshold":0,"time":1571419280},
        //         {"version":13,"height":2210000,"threshold":0,"time":1598180817},{"version":14,"height":2210720,"threshold":0,"time":1598180818},
        //         {"version":15,"height":2688888,"threshold":0,"time":1656629117},{"version":16,"height":2689608,"threshold":0,"time":1656629118}
        //       ]
        //     },
        //     "id":"44ab753401b5db4a5bdefbdc069e0575487af75c3c944a3750d34789366ce111",
        //     "coinbase_id":"5847af1e3b98be58e94e2bbf136b5f5984f8ab58a777e4a1f59b7abf6eb5f24e",
        //     "height":3470471,
        //     "difficulty":677741405709,
        //     "reward":619780720000,
        //     "base_reward":600000000000,
        //     "next_difficulty":674313740311,
        //     "block_time":120
        //   },
        //   "versions":
        //   {
        //     "p2pool":
        //     {
        //       "version":"v4.9",
        //       "timestamp":1753043076,
        //       "link":"https://github.com/SChernykh/p2pool/releases/tag/v4.9"
        //     },
        //     "monero":
        //     {
        //       "version":"v0.18.4.1",
        //       "timestamp":1753468549,
        //       "link":"https://github.com/monero-project/monero/releases/tag/v0.18.4.1"
        //     }
        //   }
        // }
        void this.setObjectNotExists('details.pool_info', {
            type: 'folder',
            common: {
                name: 'Pool Info',
                role: 'folder',
            },
            native: {},
        });
        void this.setObjectNotExists('details.pool_info.last_block', {
            type: 'folder',
            common: {
                name: 'Last Block',
                role: 'folder',
            },
            native: {},
        });
        void this.setObjectNotExists('details.pool_info.last_block.software_version', {
            type: 'state',
            common: {
                name: 'Last Block Software Version',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setObjectNotExists('details.pool_info.last_block.software_version_name', {
            type: 'state',
            common: {
                name: 'Last Block Software Version Name',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            },
            native: {},
        });
        void this.setForeignObjectNotExists('details.calculated', {
            type: 'folder',
            common: {
                name: 'Calculated Data',
                role: 'folder',
            },
            native: {},
        });
        void this.setObjectNotExists('details.calculated.version_missmatch', {
            type: 'state',
            common: {
                name: 'Version Missmatch',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: false,
            },
            native: {},
        });
        await this.updateP2pool(); // Initial call to fetch data immediately
        this.refreshInterval = this.setInterval(this.updateP2pool, 120000); // 120 seconds
        await this.setState('info.connection', true, true);
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
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new P2pool(options);
} else {
    // otherwise start the instance directly
    (() => new P2pool())();
}
