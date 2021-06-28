import {createTransformer} from '../dist/transformer/index.js';

import Gulp from 'gulp';
import GulpTypescript from 'gulp-typescript';
import SrcMap from 'gulp-sourcemaps';
import ts from 'typescript';

const {src, dest, lastRun}= Gulp;

const isProd= process.argv.includes('--prod');

const transformer= createTransformer();

const TsProject = GulpTypescript.createProject('tsconfig.json', {
	removeComments: isProd,
	pretty: !isProd,
	getCustomTransformers: ()=>({
		before: [ transformer.before, transformer.after ],
		//after: [  ],
	})
});

export function compileTest(){
	return src('test/**/*.ts', {nodir: true, since: lastRun(compileTest)})
		.pipe(SrcMap.init())
		.pipe(TsProject())
		.pipe(SrcMap.write('.'))
		.pipe(dest('dist-test'));
}