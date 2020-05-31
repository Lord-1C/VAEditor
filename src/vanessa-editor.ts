import * as monaco from "monaco-editor";

import "./languages/turbo-gherkin.contribution";

import { BreakpointManager, RuntimeProcessManager } from "./debug";
import { ProblemManager } from "./problems";

export enum VanessaEditorEvent {
  START_DEBUGGING = "START_DEBUGGING",
  START_DEBUGGING_AT_STEP = "START_DEBUGGING_AT_STEP",
  START_DEBUGGING_AT_STEP_AND_CONTINUE = "START_DEBUGGING_AT_STEP_AND_CONTINUE",
  START_DEBUGGING_AT_ENTRY = "START_DEBUGGING_AT_ENTRY",
  UPDATE_BREAKPOINTS = "UPDATE_BREAKPOINTS",
  STEP_OVER = "STEP_OVER",
  CONTENT_DID_CHANGE = "CONTENT_DID_CHANGE"
}

export class VanessaEditor {

  // 1C:Enterprise interaction call.
  public getContent: Function;
  public setContent: Function;
  public setReadOnly: Function;
  public setTheme: Function;
  public revealLine: Function;
  public decorateBreakpoints: Function;
  public decorateCompleteSteps: Function;
  public decorateCurrentStep: Function;
  public decorateErrorSteps: Function;
  public decorateProblems: Function;
  public cleanRuntimeProcess: Function;

  public editor: monaco.editor.IStandaloneCodeEditor;
  private breakpointManager: BreakpointManager;
  private runtimeProcessManager: RuntimeProcessManager;
  private problemManager: ProblemManager;

  constructor(content: string, language: string) {
    this.editor = monaco.editor.create(document.getElementById("VanessaEditor"), {
      language: language,
      scrollBeyondLastLine: false,
      glyphMargin: true,
      automaticLayout: true
    });

    this.editor.setValue(content);

    this.breakpointManager = new BreakpointManager(this);
    this.runtimeProcessManager = new RuntimeProcessManager(this);
    this.problemManager = new ProblemManager(this);
    this.subscribeEditorEvents();

    this.getContent = () => this.editor.getValue();
    this.setContent = (arg: string) => this.editor.setValue(arg);
    this.setReadOnly = (arg: boolean) => this.editor.updateOptions({ readOnly: arg });
    this.setTheme = (arg: string) => monaco.editor.setTheme(arg);
    this.revealLine = (arg: number) => this.editor.revealLine(arg);
    this.decorateBreakpoints = (arg: string) => this.breakpointManager.DecorateBreakpoints(JSON.parse(arg));
    this.decorateCurrentStep = (arg: number) => this.runtimeProcessManager.DecorateCurrentStep(arg);
    this.decorateCompleteSteps = (arg: string) => this.runtimeProcessManager.DecorateCompleteSteps(JSON.parse(arg));
    this.decorateErrorSteps = (arg: string) => this.runtimeProcessManager.DecorateErrorSteps(JSON.parse(arg));
    this.decorateProblems = (arg: string) => this.problemManager.DecorateProblems(JSON.parse(arg));
    this.cleanRuntimeProcess = () => this.runtimeProcessManager.CleanDecorates();
  }

  public dispose(): void {
    this.editor.dispose();
  }

  public fireEvent(event: string, arg: any = undefined): void {
    // tslint:disable-next-line: no-console
    console.debug("fireEvent: " + event + " : " + arg);

    let fakeButtonFireClickEvent: HTMLButtonElement = document.getElementById("VanessaEditorEventForwarder") as HTMLButtonElement;
    fakeButtonFireClickEvent.title = event;
    fakeButtonFireClickEvent.value = arg;
    fakeButtonFireClickEvent.click();
  }

  private subscribeEditorEvents(): void {
    this.editor.addCommand(monaco.KeyCode.F5,
      () => this.fireEvent(VanessaEditorEvent.START_DEBUGGING)
    );

    // tslint:disable-next-line: no-bitwise
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F5,
      () => this.fireEvent(VanessaEditorEvent.START_DEBUGGING_AT_STEP, this.editor.getPosition().lineNumber)
    );

    // tslint:disable-next-line: no-bitwise
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.F5,
      () => this.fireEvent(VanessaEditorEvent.START_DEBUGGING_AT_STEP_AND_CONTINUE, this.editor.getPosition().lineNumber));

    // tslint:disable-next-line: no-bitwise
    this.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F5,
      () => this.fireEvent(VanessaEditorEvent.START_DEBUGGING_AT_ENTRY)
    );

    this.editor.addCommand(monaco.KeyCode.F11,
      () => this.fireEvent(VanessaEditorEvent.STEP_OVER, this.editor.getPosition().lineNumber)
    );

    this.editor.onDidChangeModelContent(
      () => this.fireEvent(VanessaEditorEvent.CONTENT_DID_CHANGE)
    );

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Z,
      () => this.editor.trigger('undo…', 'undo', undefined)
    );

    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_Y,
      () => this.editor.trigger('redo…', 'redo', undefined)
    );

    this.editor.addCommand(monaco.KeyCode.F9,
      () => this.breakpointManager.toggleBreakpoint(this.editor.getPosition().lineNumber)
    );

    this.editor.onMouseDown(e => this.breakpointManager.breakpointOnMouseDown(e));

    this.editor.onMouseMove(e => this.breakpointManager.breakpointsOnMouseMove(e));

    const model: monaco.editor.ITextModel = this.editor.getModel();

    model.onDidChangeDecorations(() => this.breakpointManager.breakpointOnDidChangeDecorations());
  }
}
