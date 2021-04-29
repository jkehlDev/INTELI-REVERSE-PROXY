// <== Imports externals modules
import InteliEvent from '../InteliEvent';
import TypesEnum from '../enums/TypesEnum';
import ActionsEnum from '../enums/ActionsEnum';
import InteliAgentSHA256 from '../Authentification/InteliAgentSHA256';
import TargetCert from './TargetCert';
// ==>
interface SysAdminEvent
  extends InteliEvent<
    TypesEnum.sysadmin,
    ActionsEnum.add | ActionsEnum.remove,
    InteliAgentSHA256,
    TargetCert
  > {}

export default SysAdminEvent;
