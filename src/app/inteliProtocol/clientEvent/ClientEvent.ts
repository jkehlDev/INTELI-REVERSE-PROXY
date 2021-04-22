import InteliEvent from 'app/inteliProtocol/InteliEvent';
import TypeEnum from 'app/inteliProtocol/EventTypes';
import ActionEnum from 'app/inteliProtocol/EventActions';
import InteliSHA256 from 'app/inteliProtocol/Authentification/InteliSHA256';
import Host from 'app/inteliProtocol/clientEvent/Host';

interface ClientEvent
  extends InteliEvent<
    TypeEnum.proxy,
    ActionEnum.open | ActionEnum.close,
    InteliSHA256,
    Host
  > {}

export default ClientEvent;
