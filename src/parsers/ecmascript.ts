import child_process from 'child_process'
import path from 'path'
import fs from 'fs'
import vm from 'vm'
import SortedStringify from 'json-stable-stringify'
import { Parser } from './base'
import i18n from '~/i18n'
import { File, Log } from '~/utils'
import { Config, Global, ParserOptions } from '~/core'

const CustomEcmascriptSerializableParser = './.vscode/i18n-ally-custom-ecmascript-parser.js'

function getDefaultExport<T>(module: T): T {
  if (module && typeof module === 'object' && 'default' in module)
    return (module as any).default as T

  return module
}

const LanguageIds = {
  js: 'javascript',
  ts: 'typescript',
} as const

const LanguageExts = {
  js: 'm?js',
  ts: 'ts',
} as const

const fileExist = (filepath: string) => {
  Log.info(`${Global.rootpath}, ${filepath}`)
  // console.log('Global.rootpath', Global.rootpath, filepath)
  try {
    const filename = path.resolve(Global.rootpath, filepath)
    return !!fs.existsSync(filename)
  }
  catch (e) {
    return false
  }
}

function importFile(filePath: string) {
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const script = new vm.Script(fileContent, {
    filename: filePath,
    displayErrors: true,
  })
  const module = {}
  const context = vm.createContext({
    module,
    exports: (module as any).exports,
  })
  script.runInContext(context)

  return (module as any).exports
}

export class EcmascriptParser extends Parser {
  readonly readonly = !fileExist(CustomEcmascriptSerializableParser)
  private customEcmascriptSerializableParser?: (obj: object, indent: ParserOptions['indent'] | ParserOptions['tab'], sort: boolean) => string = undefined

  constructor(public readonly id: 'js'|'ts' = 'js') {
    super([LanguageIds[id]], LanguageExts[id])
  }

  async loadCustom() {
    if (this.customEcmascriptSerializableParser) return
    try {
      const filename = path.resolve(Global.rootpath, CustomEcmascriptSerializableParser)
      const fileModule = importFile(filename)
      const defaultExport = getDefaultExport(fileModule)
      if (typeof defaultExport !== 'function') {
        Log.error(i18n.t('prompt.invalid_ecmascript_parser'))
        return
      }
      this.customEcmascriptSerializableParser = defaultExport
    }
    catch (e) {
      Log.error(e)
    }
  }

  async parse() {
    return {}
  }

  async dump(object: object, sort: boolean) {
    await this.loadCustom()
    if (this.customEcmascriptSerializableParser) {
      const indent = this.options.tab === '\t' ? this.options.tab : this.options.indent

      const content = sort ? JSON.parse(SortedStringify(object, { space: indent })) : object
      return this.customEcmascriptSerializableParser(content, indent, sort)
    }

    return ''
  }

  async load(filepath: string) {
    const loader = path.resolve(Config.extensionPath!, 'assets/loader.js')
    const tsNode = Config.parsersTypescriptTsNodePath
    const dir = Global.rootpath
    const compilerOptions = {
      importHelpers: false,
      allowJs: true,
      module: 'commonjs',
      ...Config.parsersTypescriptCompilerOption,
    }
    const options = JSON.stringify(compilerOptions).replace(/"/g, '\\"')

    return new Promise<any>((resolve, reject) => {
      const cmd = `${tsNode} --dir "${dir}" --transpile-only --compiler-options "${options}" "${loader}" "${filepath}"`
      // eslint-disable-next-line no-console
      console.log(`[i18n-ally] spawn: ${cmd}`)
      child_process.exec(cmd, (err, stdout) => {
        if (err)
          return reject(err)
        try {
          resolve(JSON.parse(stdout.trim()))
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }

  async save(filepath: string, object: object, sort: boolean) {
    await this.loadCustom()
    if (this.customEcmascriptSerializableParser) {
      const text = await this.dump(object, sort)
      await File.write(filepath, text)
      return
    }
    Log.error(i18n.t('prompt.writing_js'))
  }
}
