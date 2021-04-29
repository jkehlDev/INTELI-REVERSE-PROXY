// <== Imports externals modules
import WebServerEvent from './webServerEvent/WebServerEvent';
import ActionsEnum from './enums/ActionsEnum';
import TypesEnum from './enums/TypesEnum';
import InteliAgentSHA256 from './Authentification/InteliAgentSHA256';
import SysAdminEvent from './sysAdminEvent/SysAdminEvent';
import InteliEvent from './InteliEvent';
import TargetCert from './sysAdminEvent/TargetCert';
// ==>
class EventFactory {
  static makeInteliEvent(
    type: string,
    action: string,
    inteliAgentSHA256: InteliAgentSHA256,
    payload: any
  ): Readonly<InteliEvent<string, string, InteliAgentSHA256, any>> {
    return {
      header: { type, action },
      authentification: inteliAgentSHA256,
      payload,
    };
  }
  static makeWebServerEvent(
    action: ActionsEnum.open | ActionsEnum.close,
    inteliAgentSHA256: InteliAgentSHA256,
    version: string,
    host: string,
    port: number,
    rule: string = '/'
  ): Readonly<WebServerEvent> {
    return {
      header: { type: TypesEnum.webServer, action },
      authentification: inteliAgentSHA256,
      payload: {
        hostId: inteliAgentSHA256.agentId,
        version,
        rule,
        target: {
          host,
          port,
        },
      },
    };
  }
  static makeSysAdminEvent(
    action: ActionsEnum.add | ActionsEnum.remove,
    inteliAgentSHA256: InteliAgentSHA256,
    payload: TargetCert
  ): Readonly<SysAdminEvent> {
    return {
      header: { type: TypesEnum.sysadmin, action },
      authentification: inteliAgentSHA256,
      payload,
    };
  }
}

export default EventFactory;
