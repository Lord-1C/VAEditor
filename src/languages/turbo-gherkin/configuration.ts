import { VanessaGherkinProvider } from "./provider";
import LanguageConfiguration = monaco.languages.LanguageConfiguration;
import IMonarchLanguage = monaco.languages.IMonarchLanguage;

export const conf: LanguageConfiguration = {
  comments: {
    lineComment: "//"
  },
  autoClosingPairs: [
    { open: "\"", close: "\"", notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string"] },
    { open: "<", close: ">", notIn: ["string"] },
    { open: "$", close: "$" },
  ],
  surroundingPairs: [
    { open: "\"", close: "\"" },
    { open: "'", close: "'" },
    { open: "<", close: ">" },
  ]
};

export const language: IMonarchLanguage = <IMonarchLanguage>{
  ignoreCase: true,

  keywords: VanessaGherkinProvider.instance.singleWords.concat(["if"]),

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      { include: "@section" },
      { include: "@keyword" },
      { include: "@common" },
      [/.*$/, "emphasis"],
    ],

    common: [
      [/@.*/, "annotation"],
      [/^\s*\*.*$/, "strong"],
      [/^\s*\|/, { token: "operator", next: "@params" }],
      { include: "@whitespace" },
      { include: "@numbers" },
      [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/'([^'\\]|\\.)*$/, "string.invalid"], // non-teminated string
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],
      [/</, "string", "@string_angle"],
    ],

    section: [
      [/^\s*([A-zА-я]+)(?:\s*\:)/, {
        cases: {
          "$1@keywords": { token: "metatag.php", switchTo: "@root" },
          "@default": { token: "identifier", switchTo: "@root" },
        },
      }],
    ],

    keyword: [
      [/^\s*([A-zА-я]+)/, {
        cases: {
          "$1@keywords": { token: "keyword", next: "@operator" },
          "@default": { token: "emphasis" },
        },
        log: "test $1"
      }],
    ],

    operator: [
      [/^/, { token: "white", next: "@pop" }],
      [/\s*([A-zА-я]+)/, "identifier"],
      { include: "@common" },
    ],

    params: [
      [/^/, { token: "white", next: "@pop" }],
      { include: "@common" },
    ],

    whitespace: [
      [/[ \t\r\n]+/, "white"],
      [/(^#.*$)/, "comment"],
      [/(^\/\/.*$)/, "comment"]
    ],

    numbers: [
      [/-?(\d*\.)?\d+([eE][+-]?\d+)?[jJ]?[lL]?/, "number"]
    ],

    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"]
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/'/, "string", "@pop"]
    ],

    string_angle: [
      [/[^\\>]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/>/, "string", "@pop"]
    ],
  }
};
