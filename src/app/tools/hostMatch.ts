import Host from 'app/inteliProtocol/webServerEvent/Host';
import { number } from 'yargs';

export function ruleMatch(rule: string, path: string): boolean {
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

export function getBestMatchRule(path: string, hosts: Host[]): string {
  return hosts
    .map((host) => host.rule)
    .filter((rule) => ruleMatch(rule, path))
    .sort((rule1, rule2) => -compareint(rule1.length, rule2.length))[0];
}
