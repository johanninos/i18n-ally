import { TreeItemCollapsibleState } from 'vscode'
import { CurrentFileLocalesTreeProvider } from '../providers'
import { BaseTreeItem } from './Base'
import { HardStringDetectResultItem } from './HardStringDetectResultItem'
import i18n from '~/i18n'
import { CurrentFile } from '~/core'

export class CurrentFileExtractionItem extends BaseTreeItem {
  collapsibleState = TreeItemCollapsibleState.Collapsed

  constructor(readonly provider: CurrentFileLocalesTreeProvider) {
    super(provider.ctx)
  }

  // @ts-expect-error
  get iconPath() {
    return this.getIcon('symbol-string')
  }

  getLabel() {
    const length = CurrentFile.hardStrings?.length
    if (length == null)
      return i18n.t('view.current_file_hard_strings_unknown', '?')
    else
      return i18n.t('view.current_file_hard_strings', length)
  }

  async getChildren() {
    const strings = await CurrentFile.detectHardStrings()

    if (strings == null)
      return []

    return strings.map(i => new HardStringDetectResultItem(this.ctx, i))
  }
}