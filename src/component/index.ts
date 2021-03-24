import { Rule } from '@angular-devkit/schematics';

import { ruleFactory, Options } from '../utils';

export function component(options: Options): Rule {
 return ruleFactory(options, 'component');
}