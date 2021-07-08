/** Resolver signature */
export type Resolver<Tresult>= (parent: any, args: any, context?: any, info?: any)=> Tresult extends undefined ? Tresult|void : Tresult;

/** Convert Model to optional resolvers signature */
export type ResolversOf<T>= {[P in keyof T]?: T[P] | Resolver<any>};

/** Add input controller to a model */
export type InputResolversOf<T>= {[P in keyof T]?: T[P] | InputResolver<T[P]>};

/** Input resolver */
export type InputResolver<T>= (parent: any, value: T, context?: any, info?: any)=> T;