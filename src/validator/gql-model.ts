import type { InputResolverFx } from '@src/parser/interfaces';
import type { ModelKind } from '@src/parser/model';

export type GqlNode = GqlObjectNode | GqlListNode;
/** Graphql validation plain object */
export interface GqlObjectNode {
	kind: ModelKind.PLAIN_OBJECT;
	fields: GqlField[];
	before: InputResolverFx<unknown, unknown> | undefined;
	after: InputResolverFx<unknown, unknown> | undefined;
}

/** Graphql validation field */
export interface GqlField {
	name: string;
	/** TargetName: equals "alias ?? name" */
	targetName: string;
	kind: ModelKind.INPUT_FIELD;
	type?: GqlNode;
	/** Input validator */
	input?: InputResolverFx<unknown, unknown>;
	/** Asserts */
	assert?: (value: unknown) => unknown;
}

/** List */
export interface GqlListNode {
	kind: ModelKind.LIST;
	/** items type */
	type: GqlNode;
	/** Input validator */
	input?: InputResolverFx<unknown, unknown>;
	/** Asserts */
	assert?: (value: unknown) => unknown;
}
