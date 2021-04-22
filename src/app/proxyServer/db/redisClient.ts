import redis from 'redis';

class RedisCli {
  client: redis.RedisClient = null;
  DEFAULT_PREFIX: string = 'GENDATA';

  /**
   * @constructor Provide instance of redis client
   */
  constructor() {
    this.client = redis.createClient({
      retry_strategy: (options: redis.RetryStrategyOptions) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with
          // a individual error
          return new Error(
            'REDIS CLIENT ERROR - The server refused the connection'
          );
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnecting after a specific timeout and flush all commands
          // with a individual error
          return new Error('REDIS CLIENT ERROR - Retry time exhausted');
        }
        if (options.attempt > 10) {
          // End reconnecting with built in error
          return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
      },
    });
  }
  /**
   * @method RedisCli#set Set a new pair (key, value) in redis store with expiration time
   * @param seconds expiration timer duration in seconds
   * @param value Target value
   * @param key Target key, Key must be unique
   * @param prefix Prefix key (default 'DATA')
   * @returns True if new pair is stored, false otherwise
   */
  set(
    seconds: number,
    value: string,
    key: string,
    prefix: string = this.DEFAULT_PREFIX
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.has(key, prefix)
        .then((has: boolean) => {
          has
            ? resolve(false)
            : this.client.setex(
                `${prefix}#${key}`,
                seconds,
                value,
                (error, _) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(true);
                  }
                }
              );
        })
        .catch((error: Error) => {
          reject(error);
        });
    });
  }

  /**
   * @method RedisCli#has  Testing if a pair (key, value) exist in redis store by target Key
   * @param key Target key in store
   * @param prefix Prefix key (default 'DATA')
   * @returns True if pair exist in store, false otherwise
   */
  has(key: string, prefix: string = this.DEFAULT_PREFIX): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.exists(`${prefix}#${key}`, (error: Error, state: number) => {
        if (error) {
          reject(error);
        }
        resolve(state === 1); // If exist then state === 1
      });
    });
  }

  /**
   * @method RedisCli#get Get a value from pair (key, value) in redis store by target key
   * @param key Target key in store
   * @param prefix Prefix key (default 'DATA')
   * @returns Target value if key exist in store, undefine otherwise
   */
  get(key: string, prefix: string = this.DEFAULT_PREFIX): Promise<string> {
    return new Promise((resolve, reject) => {
      this.has(key, prefix)
        .then((has: boolean) => {
          has
            ? this.client.get(
                `${prefix}#${key}`,
                (error: Error, value: string) => {
                  if (error) {
                    reject(error);
                  }
                  resolve(value); // Return value
                }
              )
            : resolve(undefined);
        })
        .catch((error: Error) => {
          reject(error);
        });
    });
  }

  /**
   * @method RedisCli#delete Delete a pair (key, value) in redis store by key
   * @param key Target key in store
   * @param prefix Prefix key (default 'DATA')
   * @returns True if pair deleted in store, false otherwise
   */
  delete(key: string, prefix: string = this.DEFAULT_PREFIX): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.has(key, prefix)
        .then((has: boolean) => {
          has
            ? this.client.del(`${prefix}#${key}`, (error, state) => {
                if (error) {
                  reject(error);
                }
                resolve(state === 1); // If selete resolve then state === 1
              })
            : resolve(false);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   *  @method RedisCli#close Close client connection  to redis database
   */
  close() {
    this.client.end(true);
  }
}

export default RedisCli;
