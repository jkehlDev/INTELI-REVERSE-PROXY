import http from 'http';
import Host from 'app/inteliProtocol/webServerEvent/Host';
import getLogger from 'app/tools/logger';
import { connection as Connection } from 'websocket';

// ==>
// LOGGER INSTANCE
const logger = getLogger('ProxySelector');

function ruleMatch(rule: string, path: string): boolean {
  let pathPrefixRe: RegExp;
  if (rule[rule.length - 1] === '/') {
    pathPrefixRe = new RegExp(rule);
  } else {
    // match '/test' or '/test/' or './test?' but not '/testing'
    pathPrefixRe = new RegExp('(' + rule + ')' + '(?:\\W|$)');
  }
  const testPrefixMatch: RegExpExecArray = pathPrefixRe.exec(path);
  return testPrefixMatch && testPrefixMatch.index === 0;
}

function compareint(num1: number, num2: number): number {
  return num1 > num2 ? 1 : num1 < num2 ? -1 : 0;
}

function getBestMatchRule(path: string, hosts: Host[]): string {
  const sorted = hosts
    .map((host) => host.rule)
    .filter((rule) => ruleMatch(rule, path))
    .sort((rule1, rule2) => -compareint(rule1.length, rule2.length));
  if (sorted.length > 0) {
    return sorted[0];
  } else {
    return undefined;
  }
}

export default abstract class ProxySelector {
  public abstract getTargetHost(req: http.IncomingMessage): Promise<Host>;
  public abstract addHost(key: any, host: Host): Promise<void>;
  public abstract removeHost(key: any): Promise<void>;
  public abstract cleanHost(): Promise<void>;
}

export class DefaultProxySelector extends ProxySelector {
  private hostsMap: WeakMap<Connection, Host> = new WeakMap<Connection, Host>(); // Indexed host collection on connection object (connection obj as index key)
  private hostsQueue: Array<Connection> = new Array<Connection>(); // Load balancer hosts connection queue

  public getTargetHost(req: http.IncomingMessage): Promise<Host> {
    return new Promise((resolve, reject) => {
      try {
        let connection: Connection = undefined;
        let counter = this.hostsQueue.length;
        let isMatch = false;
        const hosts: Host[] = this.hostsQueue
          .filter((con) => this.hostsMap.has(con))
          .map((con) => this.hostsMap.get(con));
        const bestRule = getBestMatchRule(req.url, hosts);
        if (bestRule) {
          let host: Host;
          do {
            while (!this.hostsMap.has(connection) && counter > 0) {
              connection = this.hostsQueue.shift();
              counter--;
            }
            if (this.hostsMap.has(connection)) {
              this.hostsQueue.push(connection);
              host = this.hostsMap.get(connection);
              isMatch = bestRule === host.rule;
            }
          } while (counter > 0 && !isMatch);

          if (this.hostsMap.has(connection) && isMatch) {
            resolve(host);
          } else {
            logger.warn(
              `Can't resolve target web server for web client request, no host registred match`
            );
            resolve(null);
          }
        } else {
          logger.warn(
            `Can't resolve target web server for web client request, no host registred match`
          );
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  public addHost(key: any, host: Host): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.hostsMap.set(key as Connection, host);
        this.hostsQueue.push(key as Connection);
      } catch (err) {
        reject(err);
      }
      resolve();
    });
  }
  public removeHost(key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.hostsMap.delete(key as Connection);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  public cleanHost(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.hostsMap = new WeakMap<Connection, Host>();
        this.hostsQueue = new Array<Connection>();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
