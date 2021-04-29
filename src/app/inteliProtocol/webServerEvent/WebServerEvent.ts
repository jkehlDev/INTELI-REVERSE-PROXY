// <== Imports externals modules
import InteliEvent from '../InteliEvent';
import TypesEnum from '../enums/TypesEnum';
import ActionsEnum from '../enums/ActionsEnum';
import InteliAgentSHA256 from '../Authentification/InteliAgentSHA256';
import Host from './Host';
// ==>
interface WebServerEvent
  extends InteliEvent<
    TypesEnum.webServer,
    ActionsEnum.open | ActionsEnum.close,
    InteliAgentSHA256,
    Host
  > {}

export default WebServerEvent;
