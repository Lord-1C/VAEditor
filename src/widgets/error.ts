import { VanessaEditor } from "../vanessa-editor";
import { WidgetBase } from "./base";

export class ErrorWidget  extends WidgetBase {

  public id: string;

  constructor(editor: VanessaEditor, data: string, text: string) {
    super(editor);
    this.domNode = this.div('vanessa-error-widget');
    this.error(data, text, this.domNode);
  }

  public show(editor: monaco.editor.IStandaloneCodeEditor, lineNumber: number): string {
    this.afterColumn = 1;
    this.heightInLines = 2;
    this.afterLineNumber = lineNumber;
    editor.changeViewZones(changeAccessor => {
      this.id = changeAccessor.addZone(this)
    });
    return this.id;
  }
}
