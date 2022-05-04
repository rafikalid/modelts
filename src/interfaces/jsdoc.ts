import type ts from "typescript";
import { Annotation, AnnotationArg } from "./annotation";


/** Jsdoc format */
export type JsDocAnnotations<T> = {
	[k in keyof T]: JsDocAnnotationMethod
}
/** Annotation method */
export type JsDocAnnotationMethod =
	(utils: JsDocUtils, AnnotationName: string) => JsDocAnnotationMethodResult

/** Method return value */
export interface JsDocAnnotationMethodResult {
	/** Init root statement, added only once */
	root?: string | ts.Statement | ts.Statement[]
	/** Parse jsDoc string */
	jsDocArgParser?: (value: string) => AnnotationArg[]
	/** Specific statements for each argument */
	exec: (arg: Annotation[], utils: JsDocUtils) => {
		/** Insert code before execution */
		before?: string | ts.Statement | ts.Statement[]
		/** Insert code after execution */
		after?: string | ts.Statement | ts.Statement[]
	}
}

/** utils */
export interface JsDocUtils {
	/** Create unique identifier */
	uniqueName: (name: string) => ts.Identifier
	/** Concat code with identifiers */
	code: (str: TemplateStringsArray, ...args: any[]) => ts.Statement[]
}