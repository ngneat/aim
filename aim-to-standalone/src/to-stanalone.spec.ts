import { Project, ScriptTarget } from "ts-morph";
import { isAIM, refactorToAim, resolveDepsAndAims } from "./to-standalone";

describe('resolveDepsAndAims & refactorToAim', () => {

  it('should resolve import deps and aims & refactor to aim', () => {

    const project = createProject();

    project.add('root.module.ts', `
    import { NgModule } from '@angular/core';
    import { FooModule } from './foo.component';
    
    @NgModule({
      imports: [FooModule]
    })
    export class RootModule { }
  `).add('foo.component.ts', `
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BarModule } from './bar.component';
    
    @Component({
      template: '',
      selector: ''
    })
    class FooComponent { }
    
    // RootModule consumes FooModule thus we can't use FooModule as a standalone module
    @NgModule({
      imports: [CommonModule, BarModule],
      declarations: [FooComponent],
      exports: [FooComponent]
    })
    export class FooModule { }
    `).add('bar.component.ts', `
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class BarComponent { }

    // FooModule consumes BarModule and RootModule consumes FooModule
    // Therefore we can't use BarModule as a standalone module
    @NgModule({
      imports: [CommonModule],
      declarations: [BarComponent],
      exports: [BarComponent]
    })
    export class BarModule { }
    `).add('baz.component.ts', `
    
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class BazComponent { }

    // BazModule is allowed to be used as a standalone module
    @NgModule({
      imports: [CommonModule],
      declarations: [BazComponent],
      exports: [BazComponent]
    })
    export class BazModule { }
    `).add('net.component.ts', `
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BazModule } from './baz.component';

    @Component({
      template: '',
      selector: ''
    })
    class NetComponent { }

    // NetModule is allowed to be used as a standalone module
    @NgModule({
      imports: [CommonModule, BazModule],
      declarations: [NetComponent],
      exports: [NetComponent]
    })
    export class NetModule { }
    `).add(`component-not-aim.ts`, `
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class NopeComponent { }

    @NgModule({
      imports: [CommonModule],
      declarations: [NopeComponent, BlaComponent],
      exports: [NopeComponent, BlaComponent]
    })
    class NopeComponent { }
    `)

    const { aimModules, moduleRefs } = resolveDepsAndAims(project.ref)
    expect(moduleRefs).toMatchInlineSnapshot(`
Object {
  "BarModule": Array [
    "FooModule",
  ],
  "BazModule": Array [
    "NetModule",
  ],
  "FooModule": Array [
    "RootModule",
  ],
  "NetModule": Array [],
  "NopeComponent": Array [],
  "RootModule": Array [],
}
`);
    expect(Object.keys(aimModules)).toMatchInlineSnapshot(`
Array [
  "BarModule",
  "BazModule",
  "FooModule",
  "NetModule",
]
`);

    refactorToAim(aimModules, moduleRefs);

    expect(project.ref.getSourceFile('root.module.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { NgModule } from '@angular/core';
    import { FooModule } from './foo.component';
    
    @NgModule({
      imports: [FooModule]
    })
    export class RootModule { }
  "
`)

    expect(project.ref.getSourceFile('foo.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BarModule } from './bar.component';
    
    @Component({
      template: '',
      selector: ''
    })
    class FooComponent { }
    
    // RootModule consumes FooModule thus we can't use FooModule as a standalone module
    @NgModule({
      imports: [CommonModule, BarModule],
      declarations: [FooComponent],
      exports: [FooComponent]
    })
    export class FooModule { }
    "
`)
    expect(project.ref.getSourceFile('bar.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class BarComponent { }

    // FooModule consumes BarModule and RootModule consumes FooModule
    // Therefore we can't use BarModule as a standalone module
    @NgModule({
      imports: [CommonModule],
      declarations: [BarComponent],
      exports: [BarComponent]
    })
    export class BarModule { }
    "
`)
    expect(project.ref.getSourceFile('baz.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    
    import { Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: '',
        standalone: true,
        imports: [CommonModule]
    })
    class BazComponent { }

    // BazModule is allowed to be used as a standalone module
    "
`)
    expect(project.ref.getSourceFile('net.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BazComponent } from './baz.component';

    @Component({
      template: '',
      selector: '',
        standalone: true,
        imports: [CommonModule, BazComponent]
    })
    class NetComponent { }

    // NetModule is allowed to be used as a standalone module
    "
`)
    expect(project.ref.getSourceFile('component-not-aim.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class NopeComponent { }

    @NgModule({
      imports: [CommonModule],
      declarations: [NopeComponent, BlaComponent],
      exports: [NopeComponent, BlaComponent]
    })
    class NopeComponent { }
    "
`)
  })
})

describe('isAim', () => {

  describe('notAim', () => {

    it('should not be aim', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
        import { NgModule } from '@angular/core';
        import { FooModule } from './foo.component';
        
        @NgModule({
          imports: [FooModule]
        })
        export class TestModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('TestModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeFalsy();
    })

    it('should not be aim', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
      import { NgModule, Component } from '@angular/core';
      import { CommonModule } from '@angular/common';
      
      @Component({
        template: '',
        selector: ''
      })
      class BazComponent { }
      
      @NgModule({
        imports: [CommonModule],
        declarations: [BazComponent, FooComponent],
        exports: [BazComponent]
      })
      export class BazModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('BazModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeFalsy();
    })


    it('should not be aim', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
      import { NgModule, Component } from '@angular/core';
      import { CommonModule } from '@angular/common';
      
      @Component({
        template: '',
        selector: ''
      })
      class BazComponent { }
      
      const components = [BazComponent, FooComponent];
      @NgModule({
        imports: [CommonModule],
        declarations: [components],
        exports: [BazComponent]
      })
      export class BazModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('BazModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeFalsy();
    })
  })


  describe('should be aim', () => {
    it('should work with components', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
      import { NgModule, Component } from '@angular/core';
      import { CommonModule } from '@angular/common';
      
      @Component({
        template: '',
        selector: ''
      })
      class BazComponent { }
      
      @NgModule({
        imports: [CommonModule],
        declarations: [BazComponent],
        exports: [BazComponent]
      })
      export class BazModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('BazModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeTruthy();
    })

    it('should work with directives', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
      import { NgModule, Directive } from '@angular/core';
      import { CommonModule } from '@angular/common';
      
      @Directive({
        selector: ''
      })
      class BazDirective{ }
      
      @NgModule({
        imports: [],
        declarations: [BazDirective],
        exports: [BazDirective]
      })
      export class BazModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('BazModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeTruthy();
    })

    it('should work with pipes', () => {
      const project = createProject();

      project.add(`aim-test.ts`, `
      import { NgModule, Pipe } from '@angular/core';
      import { CommonModule } from '@angular/common';
      
      @Pipe({
        selector: ''
      })
      class BazPipe{ }
      
      @NgModule({
        imports: [],
        declarations: [BazPipe],
        exports: [BazPipe]
      })
      export class BazModule { }
      `)

      const dec = project.ref.getSourceFile('aim-test.ts')?.getClass('BazModule')?.getDecorator('NgModule')!
      expect(isAIM(dec)).toBeTruthy();
    })
  })


})


describe('duplicate refs', () => {
  it('should not have duplicates ref', () => {
    const project = createProject();

    project.add('baz.component.ts', `
    
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: ''
    })
    class BazComponent { }

    @NgModule({
      imports: [CommonModule],
      declarations: [BazComponent],
      exports: [BazComponent]
    })
    export class BazModule { }
    `).add('net.component.ts', `
    import { NgModule, Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BazModule, BazComponent } from './baz.component';

    @Component({
      template: '',
      selector: ''
    })
    class NetComponent {
        boo(comp: BazComponent) {}
     }

    @NgModule({
      imports: [CommonModule, BazModule],
      declarations: [NetComponent],
      exports: [NetComponent]
    })
    export class NetModule { }
    `)

    const { aimModules, moduleRefs } = resolveDepsAndAims(project.ref)

    refactorToAim(aimModules, moduleRefs);

    expect(project.ref.getSourceFile('net.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    import { Component } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { BazComponent } from './baz.component';

    @Component({
      template: '',
      selector: '',
        standalone: true,
        imports: [CommonModule, BazComponent]
    })
    class NetComponent {
        boo(comp: BazComponent) {}
     }
    "
`);
    expect(project.ref.getSourceFile('baz.component.ts')!.getFullText()).toMatchInlineSnapshot(`
"
    
    import { Component } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @Component({
      template: '',
      selector: '',
        standalone: true,
        imports: [CommonModule]
    })
    class BazComponent { }
    "
`);

  })
})


export function createProject() {
  const project = new Project({
    compilerOptions: {
      types: [],
      typeRoots: [],
      target: ScriptTarget.ES2020
    }
  });

  return {
    ref: project,
    add(path: string, content: string) {
      project.createSourceFile(path, content);

      return this;
    }
  }
}