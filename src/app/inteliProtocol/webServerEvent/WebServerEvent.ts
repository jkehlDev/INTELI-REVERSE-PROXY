import InteliEvent from 'app/inteliProtocol/InteliEvent';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import InteliSHA256 from 'app/inteliProtocol/Authentification/InteliSHA256';
import Host from 'app/inteliProtocol/webServerEvent/Host';

interface WebServerEvent
  extends InteliEvent<
    TypeEnum.webServer,
    ActionEnum.open | ActionEnum.close,
    InteliSHA256,
    Host
  > {}

export default WebServerEvent;
