interface InteliEvent<
  Type extends string,
  Action extends string,
  Auth,
  Payload
> {
  header: {
    type: Type;
    action: Action;
  };
  authentification: Auth;
  payload: Payload;
}

export default InteliEvent;

export const INTELI_PROTOCOL = 'inteli-protocol-v1.00';
