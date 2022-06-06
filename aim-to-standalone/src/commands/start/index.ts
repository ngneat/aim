import { Command } from '@oclif/core'
import inquirer = require('inquirer');
import { resolve } from 'path';
import { Project } from 'ts-morph';
import * as ora from 'ora';

import { resolveDepsAndAims, refactorToAim, save } from '../../to-standalone';

export default class Start extends Command {
  async run(): Promise<void> {

    const answers = await inquirer
      .prompt([
        {
          type: 'input',
          name: 'path',
          default: 'tsconfig.json',
          message: 'Path to tsconfig file'
        }
      ])

    const project = new Project({
      tsConfigFilePath: resolve(process.cwd(), answers.path)
    });

    try {
      const resolveDepsAndAimsSpinner = ora('Resolving dependencies and AIMs...').start();

      const { aimModules, moduleRefs } = resolveDepsAndAims(project);

      resolveDepsAndAimsSpinner.succeed('Resolved dependencies and AIMs.');

      const refactorToAimSpinner = ora('Refactoring to AIM...').start();

      refactorToAim(aimModules, moduleRefs);

      refactorToAimSpinner.succeed('Refactored to AIM.');

      const saveSpinner = ora('Saving...').start();

      save(project);

      saveSpinner.succeed('Saved.');

    } catch (e) {
      console.error(e);
    }

  }
}