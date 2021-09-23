import { Rule } from '@angular-devkit/schematics';

import { ruleFactory, Options } from '../utils';

export function pipe(options: Options): Rule {
 return ruleFactory(options, 'pipe');
}
