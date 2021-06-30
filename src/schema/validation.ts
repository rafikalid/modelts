/** Wrapper and input validation signature */
export type JsDocDirectiveCb<Tcontext, Tinfo>= (parent: any, value:any, ctx?: Tcontext, info?: Tinfo) => any

/** Validation using jsDoc annotations */
export interface JsDocDirective<Tcontext, Tinfo>{
	/** Resolver methods */
	resolver: (txt: string, fieldType:string) => {
		/** Input pipeline */
		input?: JsDocDirectiveCb<Tcontext, Tinfo>
		/** Output wrapper */
		output?: (resolver: Function) => JsDocDirectiveCb<Tcontext, Tinfo>
	}
}