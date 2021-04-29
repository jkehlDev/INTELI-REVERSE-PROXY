// <== Imports externals modules
import http from 'http';
import { connection as Connection } from 'websocket';
import Host from '../inteliProtocol/webServerEvent/Host';
import getLogger from './logger';
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
  const sortedHosts = hosts
    .filter((host) => ruleMatch(host.rule, path))
    .sort((host1, host2) => compareint(host2.rule.length, host1.rule.length));
  return sortedHosts.length > 0 ? sortedHosts[0].rule : undefined;
}

export default abstract class ProxySelector {
  public abstract getTargetHost(req: http.IncomingMessage): Promise<Host>;
  public abstract addHost(key: any, host: Host): Promise<void>;
  public abstract removeHost(key: any): Promise<void>;
  public abstract cleanHost(): Promise<void>;
}

export class DefaultProxySelector extends ProxySelector {
  private hostsMap: WeakMap<Connection, Host> = new WeakMap<Connection, Host>(); // Indexed host collection on connection object (connection obj as index key)
  private conTbl: Array<Connection> = new Array<Connection>(); // Load balancer hosts connection queue

  public getTargetHost(req: http.IncomingMessage): Promise<Host> {
    return new Promise((resolve, reject) => {
      try {
        let host: Host = undefined;
        if (this.conTbl.length > 0) {
          const hosts: Host[] = this.conTbl
            .filter((con) => this.hostsMap.has(con))
            .map((con) => this.hostsMap.get(con));
          if (hosts.length > 0) {
            const bestRule = getBestMatchRule(req.url, hosts);
            host = hosts
              .filter((host) => host.rule === bestRule)
              .sort((host1, host2) => compareint(host1.use, host2.use))
              .shift();
          }
        }
        if (host) {
          host.use = (host.use + 1) % 100;
        }
        resolve(host);
      } catch (err) {
        reject(err);
      }
    });
  }
  public addHost(key: any, host: Host): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.hostsMap.has(key)) {
          host.use = 0;
          this.hostsMap.set(key, host);
          this.conTbl.push(key);
        }
      } catch (err) {
        reject(err);
      }
      resolve();
    });
  }
  public removeHost(key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.hostsMap.has(key)) {
          this.hostsMap.delete(key);
          this.conTbl = this.conTbl.filter((con) => this.hostsMap.has(con));
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  public cleanHost(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        let connection: any;
        while (this.conTbl.length > 0) {
          connection = this.conTbl.shift();
          if (this.hostsMap.has(connection)) {
            this.hostsMap.delete(connection);
          }
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
