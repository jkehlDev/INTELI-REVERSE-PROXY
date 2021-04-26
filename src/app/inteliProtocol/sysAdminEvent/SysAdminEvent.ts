import InteliEvent from 'app/inteliProtocol/InteliEvent';
import TypeEnum from 'app/inteliProtocol/enums/EventTypes';
import ActionEnum from 'app/inteliProtocol/enums/EventActions';
import InteliAgentSHA256 from 'app/inteliProtocol/Authentification/InteliAgentSHA256';
import TargetCert from 'app/inteliProtocol/sysAdminEvent/TargetCert';

interface SysAdminEvent
  extends InteliEvent<
    TypeEnum.sysadmin,
    ActionEnum.add | ActionEnum.remove,
    InteliAgentSHA256,
    TargetCert
  > {}

export default SysAdminEvent;
