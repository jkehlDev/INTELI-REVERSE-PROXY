// <== Imports externals modules
import InteliEvent from '../InteliEvent';
import TypesEnum from '../enums/TypesEnum';
import ActionsEnum from '../enums/ActionsEnum';
import Host from './Host';
// ==>
interface WebServerEvent
  extends InteliEvent<
    TypesEnum.webServer,
    ActionsEnum.open | ActionsEnum.close,
    Host
  > {}

export default WebServerEvent;
