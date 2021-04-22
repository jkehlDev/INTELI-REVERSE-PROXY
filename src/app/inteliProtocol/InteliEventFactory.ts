import ClientEvent from 'app/inteliProtocol/clientEvent/ClientEvent';
import ActionEnum from 'app/inteliProtocol/EventActions';
import TypeEnum from 'app/inteliProtocol/EventTypes';

class EventFactory {
  static makeProxyEvent(
    action: ActionEnum.open | ActionEnum.close,
    agentId: string,
    signature: string,
    host: string,
    port: number
  ): Readonly<ClientEvent> {
    return {
      header: { type: TypeEnum.proxy, action },
      authentification: { agentId, signature },
      payload: { host, port },
    };
  }
}

export default EventFactory;
