import { ProviderBase } from "./provider.base";
import { VanessaEditor } from "../../vanessa-editor";

interface IVanessaStep {
  filterText: string;
  insertText: string;
  sortText: string;
  documentation: string;
  kind: number;
  section: string;
}

export class VanessaGherkinProvider extends ProviderBase {

  public static standaloneInstance: VanessaGherkinProvider = new VanessaGherkinProvider();
  public get elements(): any { return ProviderBase.elements; }
  public get keywords(): any { return ProviderBase.keywords; }
  public get variables(): any { return ProviderBase.variables; }
  public get steps(): any { return ProviderBase.steps; }

  public static getStandalone() { return this.standaloneInstance; }

  public setKeywords = (arg: string): void => {
    this.clearArray(ProviderBase.keywords);
    let list = JSON.parse(arg).map((w: string) => w.toLowerCase());
    list.forEach((w: string) => ProviderBase.keywords.push(w.split(" ")));
    ProviderBase.keywords = ProviderBase.keywords.sort((a: any, b: any) => b.length - a.length);
  }

  public setElements = (values: string, clear: boolean = false): void => {
    if (clear) this.clearObject(ProviderBase.elements);
    let obj = JSON.parse(values);
    for (let key in obj) {
      ProviderBase.elements[key.toLowerCase()] = obj[key];
    }
    VanessaGherkinProvider.updateStepLabels();
  }

  public setVariables = (values: string, clear: boolean = false): void => {
    if (clear) this.clearObject(ProviderBase.variables);
    let obj = JSON.parse(values);
    for (let key in obj) {
      ProviderBase.variables[key.toLowerCase()] = { name: key, value: String(obj[key]) };
    }
    VanessaGherkinProvider.updateStepLabels();
  }

  public setStepList = (list: string, clear: boolean = false): void => {
    if (clear) this.clearObject(VanessaGherkinProvider.steps);
    JSON.parse(list).forEach((e: IVanessaStep) => {
      let body = e.insertText.split('\n');
      let text = body.shift();
      let head = VanessaGherkinProvider.splitWords(text);
      let words = VanessaGherkinProvider.filterWords(head);
      let key = VanessaGherkinProvider.key(words);
      VanessaGherkinProvider.steps[key] = {
        head: head,
        body: body,
        documentation: e.documentation,
        insertText: e.insertText,
        sortText: e.sortText,
        section: e.section,
        kind: e.kind,
      };
    });
    VanessaGherkinProvider.updateStepLabels();
    VanessaEditor.checkAllSyntax();
  }

  public setSyntaxMsg = (message: string): void => {
    ProviderBase.syntaxMsg = message;
  }

  public getSyntaxMsg = (): string => {
    return ProviderBase.syntaxMsg;
  }

  private static updateStepLabels() {
    for (let key in this.steps) {
      let e = this.steps[key];
      let words = e.head.map((word: string) => {
        let regexp = /^"[^"]*"$|^'[^']*'$|^<[^<]*>$/g;
        if (!regexp.test(word)) return word;
        let name = word.substring(1, word.length - 1).toLowerCase();
        let elem = this.elements[name];
        if (!elem) return word;
        let Q1 = word.charAt(0);
        let Q2 = word.charAt(word.length - 1);
        return `${Q1}${elem}${Q2}`;
      });
      let keyword = this.findKeyword(words);
      e.label = words.filter((w, i) => !(keyword && i < keyword.length)).join(' ');
      e.keyword = words.filter((w, i) => (keyword && i < keyword.length)).join(' ');
      e.insertText = e.label + (e.body.length ? '\n' + e.body.join('\n') : '');
    }
  }

  private constructor() {
    super();
    this.createTheme1C();
  }

  private clearObject(target: Object) {
    Object.keys(target).forEach(key => delete target[key]);
  }

  private clearArray(target: Array<any>) {
    target.splice(0, target.length);
  }

  private createTheme1C() {
    monaco.editor.defineTheme('1c', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '000000' },
        { token: 'invalid', foreground: 'ff3333' },
        { token: 'variable', foreground: '5c6773' },
        { token: 'constant', foreground: 'f08c36' },
        { token: 'comment', foreground: '007f00' },
        { token: 'number', foreground: '0000ff' },
        { token: 'tag', foreground: 'e7c547' },
        { token: 'string', foreground: '963200' },
        { token: 'keyword', foreground: 'ff0000' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#5c6773',
        'editorIndentGuide.background': '#ecebec',
        'editorIndentGuide.activeBackground': '#e0e0e0',
      },
    });
  }
}
