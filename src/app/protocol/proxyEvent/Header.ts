import ActionEnum from "../enums/ActionEnum";
import TypeEnum from "../enums/TypeEnum";

interface Header {
  type: TypeEnum;
  action: ActionEnum;
}

export default Header;
