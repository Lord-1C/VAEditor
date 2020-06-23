import { VanessaEditor, VanessaEditorEvent } from "./vanessa-editor";
import { IRange } from "monaco-editor";

import * as monaco from "monaco-editor"
import { renderMarkdown } from "monaco-editor/esm/vs/base/browser/htmlContentRenderer.js"

const markdownToHTML = (value) => {
  const result = renderMarkdown({
    value
  }, {
    inline: false,
    codeBlockRenderer: async function (languageAlias, value) {
      return await monaco.editor.colorize(value, "markdown", {});
    }

  })
  return result
}

interface IBreakpoint {
  lineNumber: number;
  enable: boolean;
}

interface IBreakpointDecoration {
  id: string;
  range: IRange;
  enable: boolean;
  verified: boolean;
}

export class BreakpointManager {

  private VanessaEditor: VanessaEditor;

  private breakpointDecorations: IBreakpointDecoration[] = [];
  private breakpointDecorationIds: string[] = [];
  private breakpointHintDecorationIds: string[] = [];
  private breakpointUnverifiedDecorationIds: string[] = [];
  private checkBreakpointChangeDecorations: boolean = true;

  constructor(
    VanessaEditor: VanessaEditor
  ) {
    this.VanessaEditor = VanessaEditor;
  }

  public DecorateBreakpoints(breakpoints: IBreakpoint[]): void {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    breakpoints.forEach(breakpoint => {
      decorations.push({
        range: new monaco.Range(breakpoint.lineNumber, 1, breakpoint.lineNumber, 1),
        options: {
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          glyphMarginClassName: breakpoint.enable ? "debug-breakpoint-glyph" : "debug-breakpoint-disabled-glyph"
        }
      });
    });

    this.checkBreakpointChangeDecorations = false;
    this.breakpointDecorationIds = this.VanessaEditor.editor.deltaDecorations(this.breakpointDecorationIds, decorations);
    this.breakpointUnverifiedDecorationIds = this.VanessaEditor.editor.deltaDecorations(this.breakpointUnverifiedDecorationIds, []);
    this.checkBreakpointChangeDecorations = true;

    this.breakpointDecorations = this.breakpointDecorationIds.map((id, index) => ({
      id: id,
      range: decorations[index].range,
      enable: breakpoints[index].enable,
      verified: true
    }));
  }

  public breakpointsOnMouseMove(e: monaco.editor.IEditorMouseEvent): void {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const lineNumber: number = e.target.position.lineNumber;
      if (this.breakpointIndexByLineNumber(lineNumber) === -1) {
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            glyphMarginClassName: "debug-breakpoint-hint-glyph"
          }
        });
      }
    }
    this.breakpointHintDecorationIds = this.VanessaEditor.editor.deltaDecorations(this.breakpointHintDecorationIds, decorations);
  }

  public breakpointOnDidChangeDecorations(): void {
    if (!this.checkBreakpointChangeDecorations) {
      return;
    }
    let somethingChanged: boolean = false;
    this.breakpointDecorations.forEach(breakpoint => {
      if (somethingChanged) {
        return;
      }
      if (!breakpoint.verified) {
        return;
      }
      const newBreakpointRange: monaco.Range = this.VanessaEditor.editor.getModel().getDecorationRange(breakpoint.id);
      if (newBreakpointRange && (!(breakpoint.range as monaco.Range).equalsRange(newBreakpointRange))) {
        somethingChanged = true;
      }
    });
    if (somethingChanged) {
      this.updateBreakpoints();
    }
  }

  public breakpointOnMouseDown(e: monaco.editor.IEditorMouseEvent): void {
    if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      this.toggleBreakpoint(e.target.position.lineNumber);
    }
  }

  public toggleBreakpoint(lineNumber: number): void {
    const breakpointIndex: number = this.breakpointIndexByLineNumber(lineNumber);
    if (breakpointIndex === -1) {
      this.checkBreakpointChangeDecorations = false;
      this.breakpointHintDecorationIds = this.VanessaEditor.editor.deltaDecorations(this.breakpointHintDecorationIds, []);
      this.breakpointUnverifiedDecorationIds = this.VanessaEditor.editor.deltaDecorations(this.breakpointUnverifiedDecorationIds, [{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          glyphMarginClassName: "debug-breakpoint-unverified-glyph"
        }
      }]);
      this.checkBreakpointChangeDecorations = true;
      this.breakpointDecorations.push({
        id: this.breakpointUnverifiedDecorationIds[0],
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        enable: true,
        verified: false
      });
    } else {
      this.breakpointDecorations.splice(breakpointIndex, 1);
    }
    setTimeout(() => this.updateBreakpoints(), 100);
  }

  private updateBreakpoints(): void {
    const breakpointPacket: IBreakpoint[] = [];
    this.breakpointDecorations.forEach(breakpoint => {
      const range: monaco.Range = this.VanessaEditor.editor.getModel().getDecorationRange(breakpoint.id);
      if (range !== null) {
        const breakpointFound: Boolean = breakpointPacket.find(breakpointChunk =>
          (breakpointChunk.lineNumber === range.startLineNumber)) !== undefined;
        if (!breakpointFound) {
          breakpointPacket.push({
            lineNumber: range.startLineNumber,
            enable: breakpoint.enable
          });
        }
      }
    });
    this.VanessaEditor.fireEvent(VanessaEditorEvent.UPDATE_BREAKPOINTS, JSON.stringify(breakpointPacket));
  }

  private breakpointIndexByLineNumber(lineNumber: any): number {
    return this.breakpointDecorations.findIndex(breakpoint => (breakpoint.range.startLineNumber === lineNumber));
  }
}

export class RuntimeProcessManager {

  private VanessaEditor: VanessaEditor;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private stepDecorationIds: string[] = [];
  private currentStepDecorationIds: string[] = [];
  private errorViewZoneIds: Array<number> = [];
  private codeViewZoneIds: Array<number> = [];

  constructor(VanessaEditor: VanessaEditor) {
    this.VanessaEditor = VanessaEditor;
    this.editor = VanessaEditor.editor;
  }

  public set(status: string, lines: Array<number> | number): void {
    let position = this.editor.getPosition();
    this.editor.setSelection(new monaco.Range(1, 1, 1, 1));
    const model: monaco.editor.ITextModel = this.editor.getModel();
    const oldDecorations = status == "current" ? this.currentStepDecorationIds : [];
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    (typeof (lines) == "number" ? [lines] : lines).forEach(line => {
      model.getLinesDecorations(line, line).forEach(d => {
        if (d.options.className) oldDecorations.push(d.id);
      });
      if (status) decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          stickiness: monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
          glyphMarginClassName: status == "current" ? "debug-current-step-glyph" : undefined,
          className: `debug-${status}-step`,
          isWholeLine: true,
        }
      });
    });
    oldDecorations.forEach(s => {
      if (status != "current") {
        let i = this.currentStepDecorationIds.indexOf(s);
        if (i >= 0) this.stepDecorationIds.splice(i, 1);
      }
      let i = this.stepDecorationIds.indexOf(s);
      if (i >= 0) this.stepDecorationIds.splice(i, 1);
    });
    const newDecorations = this.editor.deltaDecorations(oldDecorations, decorations)
    if (status == "current") {
      this.currentStepDecorationIds = newDecorations;
    } else {
      newDecorations.forEach(s => this.stepDecorationIds.push(s));
    }
    this.editor.setPosition(position);
  }

  public get(status: string): string {
    const model: monaco.editor.ITextModel = this.editor.getModel();
    const lines = [];
    let lineCount = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      if (model.getLinesDecorations(lineNumber, lineNumber).some(d =>
        d.options.className == `debug-${status}-step`
      )) lines.push(lineNumber);
    };
    return JSON.stringify(lines);
  }

  public showError(lineNumber: number, data: string, text: string) {
    let ids = this.errorViewZoneIds;
    let style = (document.querySelector('div.view-lines') as HTMLElement).style;
    this.editor.changeViewZones(changeAccessor => {
      var domNode = document.createElement('div');
      domNode.classList.add('vanessa-error-widget');
      domNode.style.fontFamily = style.fontFamily;
      domNode.style.lineHeight = style.lineHeight;
      domNode.style.fontSize = style.fontSize;
      domNode.style.zIndex = "9999";
      var textNode = document.createElement('span');
      textNode.innerText = text;
      domNode.appendChild(textNode);
      var linkNode = document.createElement('div');
      linkNode.classList.add('vanessa-error-links');
      linkNode.dataset.value = data;
      this.VanessaEditor.errorLinks.forEach((e, i) => {
        if (i) {
          let sNode = document.createElement('span');
          sNode.innerHTML = '&nbsp;|&nbsp;';
          linkNode.appendChild(sNode);
        }
        let aNode = document.createElement('a');
        aNode.href = "#";
        aNode.dataset.id = e.id;
        aNode.innerText = e.title;
        aNode.setAttribute("onclick", "VanessaEditor.onErrorLink(this)");
        linkNode.appendChild(aNode);
      });
      domNode.appendChild(linkNode);
      ids.push(changeAccessor.addZone({
        afterLineNumber: lineNumber,
        afterColumn: 1,
        heightInLines: 2,
        domNode: domNode,
      }));
    });
  }

  public showCode(lineNumber: number, data: string, text: string) {
    let ids = this.codeViewZoneIds;
    let style = (document.querySelector('div.view-lines') as HTMLElement).style;
    var domNode = document.createElement('div');
    domNode.classList.add('vanessa-code-widget');
    domNode.style.fontFamily = style.fontFamily;
    domNode.style.lineHeight = style.lineHeight;
    domNode.style.fontSize = style.fontSize;
    domNode.style.zIndex = "9999";
    var leftNode = document.createElement('div');
    leftNode.classList.add('vanessa-code-border');
    leftNode.style.width = style.lineHeight;
    domNode.appendChild(leftNode);
    var textNode = document.createElement('div');
    textNode.classList.add('vanessa-code-lines');
    textNode.style.left = style.lineHeight;
    domNode.appendChild(textNode);
    monaco.editor.colorize(text, "turbo-gherkin", {}).then((html: string) => {
      textNode.innerHTML = html;
      let linesCount = textNode.querySelectorAll('div>span').length;
      for (let i = 0; i < linesCount; i++) {
        var glyphNode = document.createElement('div');
        leftNode.appendChild(glyphNode);
        glyphNode.style.height = style.lineHeight;
        if (i == 1) glyphNode.classList.add('debug-current-step-glyph');
      }
      this.editor.changeViewZones(changeAccessor => {
        ids.push(changeAccessor.addZone({
          heightInLines: linesCount,
          afterLineNumber: lineNumber,
          afterColumn: 1,
          domNode: domNode,
        }));
        document.querySelectorAll(".vanessa-code-lines > span")[1].classList.add("debug-current-step");
      });
    });
  }

  public clearErrors(): void {
    let owner = this;
    this.editor.changeViewZones(changeAccessor =>
      owner.errorViewZoneIds.forEach(id => changeAccessor.removeZone(id)
      ));
  }

  public clear(): void {
    this.currentStepDecorationIds = this.editor.deltaDecorations(this.currentStepDecorationIds, []);
    this.stepDecorationIds = this.editor.deltaDecorations(this.stepDecorationIds, []);
    this.clearErrors();
  }
}
