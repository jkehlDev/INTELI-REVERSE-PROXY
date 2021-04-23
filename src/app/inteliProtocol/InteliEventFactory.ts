import ClientEvent from 'app/inteliProtocol/clientEvent/ClientEvent';
import ActionEnum from 'app/inteliProtocol/EventActions';
import TypeEnum from 'app/inteliProtocol/EventTypes';
import InteliSHA256 from './Authentification/InteliSHA256';

class EventFactory {
  static makeProxyEvent(
    action: ActionEnum.open | ActionEnum.close,
    inteliSHA256: InteliSHA256,
    host: string,
    port: number
  ): Readonly<ClientEvent> {
    return {
      header: { type: TypeEnum.proxy, action },
      authentification: inteliSHA256,
      payload: { host, port },
    };
  }
}

export default EventFactory;
