import { Rule } from '@angular-devkit/schematics';
import { ruleFactory, Options } from '../utils';

export function directive(options: Options): Rule {
  return ruleFactory(options, 'directive');
}