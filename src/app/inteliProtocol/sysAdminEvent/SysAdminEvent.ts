// <== Imports externals modules
import InteliEvent from '../InteliEvent';
import TypesEnum from '../enums/TypesEnum';
import ActionsEnum from '../enums/ActionsEnum';
import TargetCert from './TargetCert';
// ==>
interface SysAdminEvent
  extends InteliEvent<
    TypesEnum.sysadmin,
    ActionsEnum.add | ActionsEnum.remove | ActionsEnum.stopproxy,
    TargetCert
  > {}

export default SysAdminEvent;
