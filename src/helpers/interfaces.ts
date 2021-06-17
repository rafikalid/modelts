/** Resolver signature */
export type Resolver<Tresult>= (parent: any, args: any, context?: any, info?: any)=> Tresult extends undefined ? Tresult|void : Tresult;

/** Convert Model to optional resolvers signature */
export type ResolversOf<T>= {[P in keyof T]?: Resolver<T[P]>};
