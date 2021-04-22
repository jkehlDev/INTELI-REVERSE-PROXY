interface InteliEvent<Type, Action, Auth, Payload> {
  header: {
    type: Type;
    action: Action;
  };
  authentification: Auth;
  payload: Payload;
}

export default InteliEvent;
