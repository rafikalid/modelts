import { ModelError, ModelErrorCode, JsDocAnnotations, GqlSchema } from '@src';


export class Model {
	/** Create graphql schema */
	scanGraphQL<Schema extends GqlSchema, A extends JsDocAnnotations<A> | void = void, ContextEntities = any>(glob: string) {
		throw new ModelError(ModelErrorCode.NOT_COMPILED);
	}
}
