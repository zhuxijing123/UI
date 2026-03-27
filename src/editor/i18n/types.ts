export type Locale = 'zh-CN' | 'en-US';

export type TranslationKey =
  // === Menu Bar ===
  | 'menu.file' | 'menu.edit' | 'menu.node' | 'menu.project'
  | 'menu.panel' | 'menu.extension' | 'menu.developer' | 'menu.help'

  // === File Menu ===
  | 'file.openProject' | 'file.importFolder' | 'file.openLatest'
  | 'file.newUiLayout' | 'file.save' | 'file.saveAll'
  | 'file.closeTab' | 'file.closeAllTabs' | 'file.closeProject'

  // === Edit Menu ===
  | 'edit.zoomFit' | 'edit.zoom100' | 'edit.zoom200' | 'edit.zoom50'
  | 'edit.switchPreview' | 'edit.switchScene'
  | 'edit.maximizeScene' | 'edit.restoreScene'
  | 'edit.switchToPreview' | 'edit.switchToScene'
  | 'edit.maximizeScenePanel' | 'edit.restoreScenePanel'

  // === Node Menu ===
  | 'node.addChild' | 'node.duplicate' | 'node.delete'
  | 'node.moveUp' | 'node.moveDown'
  | 'node.duplicateSelected' | 'node.deleteSelected'

  // === Project Menu ===
  | 'project.rescan' | 'project.restoreCached' | 'project.forgetCached'
  | 'project.clearRecentProjects'

  // === Panel Menu ===
  | 'panel.showLeft' | 'panel.hideLeft'
  | 'panel.showRight' | 'panel.hideRight'
  | 'panel.showBottom' | 'panel.hideBottom'
  | 'panel.sceneStage' | 'panel.previewStage'
  | 'panel.focusConsole' | 'panel.focusSelection'
  | 'panel.focusProject' | 'panel.focusProperties'
  | 'panel.focusDocument' | 'panel.resetLayout'
  | 'panel.showLeftDock' | 'panel.hideLeftDock'
  | 'panel.showBottomDock' | 'panel.hideBottomDock'
  | 'panel.showInspectorDock' | 'panel.hideInspectorDock'
  | 'panel.focusConsoleTab' | 'panel.focusSelectionTab' | 'panel.focusProjectTab'
  | 'panel.focusPropertiesInspector' | 'panel.focusDocumentInspector'
  | 'panel.focusProjectPanel'

  // === Extension Menu ===
  | 'extension.avatarLab' | 'extension.effectLab'

  // === Developer Menu ===
  | 'dev.inspectElement' | 'dev.toggleDevTools' | 'dev.reload'

  // === Help Menu ===
  | 'help.shortcuts' | 'help.about' | 'help.settings'
  | 'help.showShortcuts'

  // === Panel Labels ===
  | 'label.hierarchy' | 'label.assets' | 'label.scene' | 'label.inspector'
  | 'label.console' | 'label.preview' | 'label.properties'
  | 'label.noSelection' | 'label.noDocument'
  | 'label.selection' | 'label.project' | 'label.document'

  // === Hierarchy Panel ===
  | 'hierarchy.title' | 'hierarchy.nodeTree' | 'hierarchy.nodes'
  | 'hierarchy.expandAll' | 'hierarchy.collapseAll'
  | 'hierarchy.searchPlaceholder'
  | 'hierarchy.all' | 'hierarchy.name' | 'hierarchy.type' | 'hierarchy.text' | 'hierarchy.resource'
  | 'hierarchy.unavailable.title' | 'hierarchy.unavailable.body'
  | 'hierarchy.expand' | 'hierarchy.collapse'
  | 'hierarchy.toggleSearch' | 'hierarchy.toggleVisibility'
  | 'hierarchy.deleteNode' | 'hierarchy.lockNode' | 'hierarchy.unlockNode'
  | 'hierarchy.nodeType'

  // === Asset Browser ===
  | 'asset.title' | 'asset.browser' | 'asset.import' | 'asset.refresh'
  | 'asset.expandAll' | 'asset.collapseAll'
  | 'asset.searchPlaceholder'
  | 'asset.all' | 'asset.ui' | 'asset.avatar' | 'asset.map' | 'asset.data'
  | 'asset.notLoaded.title' | 'asset.notLoaded.body'
  | 'asset.sortName' | 'asset.sortType'
  | 'asset.expand' | 'asset.collapse'
  | 'asset.notLoaded.workspaceNotLoaded' | 'asset.notLoaded.workspaceHint'

  // === Scene Panel ===
  | 'scene.title' | 'scene.hand' | 'scene.move' | 'scene.rotate'
  | 'scene.scale' | 'scene.rect' | 'scene.sceneMode' | 'scene.previewMode'
  | 'scene.fit' | 'scene.zoom100' | 'scene.maximize' | 'scene.restore'
  | 'scene.noDocument'
  | 'scene.scene' | 'scene.preview' | 'scene.mode2d'
  | 'scene.editMode' | 'scene.previewModeLabel'

  // === Inspector ===
  | 'inspector.noSelection.title' | 'inspector.noSelection.body'
  | 'inspector.document' | 'inspector.node' | 'inspector.transform'
  | 'inspector.content' | 'inspector.name' | 'inspector.type'
  | 'inspector.parent' | 'inspector.kind'
  | 'inspector.x' | 'inspector.y' | 'inspector.w' | 'inspector.h'
  | 'inspector.anchorX' | 'inspector.anchorY'
  | 'inspector.rotation' | 'inspector.scaleX' | 'inspector.scaleY'
  | 'inspector.resource' | 'inspector.text' | 'inspector.fontSize'
  | 'inspector.color' | 'inspector.visible'
  | 'inspector.format' | 'inspector.path' | 'inspector.unsaved'
  | 'inspector.frames' | 'inspector.image' | 'inspector.source'
  | 'inspector.lock' | 'inspector.back' | 'inspector.forward'
  // Inspector extended labels
  | 'inspector.atlas' | 'inspector.missing'
  | 'inspector.frame' | 'inspector.sourceSize' | 'inspector.spriteOffset'
  | 'inspector.rotated' | 'inspector.trimmed'
  | 'inspector.bitmapFont' | 'inspector.face' | 'inspector.unnamed'
  | 'inspector.glyphs' | 'inspector.lineHeight' | 'inspector.scale'
  | 'inspector.pageFile'
  | 'inspector.avatarLab' | 'inspector.cloth' | 'inspector.weapon'
  | 'inspector.state' | 'inspector.dir' | 'inspector.meta'
  | 'inspector.bizBank' | 'inspector.files' | 'inspector.canvas'
  | 'inspector.dirs' | 'inspector.rect' | 'inspector.origin'
  | 'inspector.effectLab' | 'inspector.fileId' | 'inspector.delay'
  | 'inspector.loop'
  | 'inspector.map' | 'inspector.version' | 'inspector.ground'
  | 'inspector.logic' | 'inspector.groundDir' | 'inspector.mapId'
  | 'inspector.unmatched' | 'inspector.file' | 'inspector.brush'
  | 'inspector.paintValue' | 'inspector.walkable' | 'inspector.block'
  | 'inspector.marker' | 'inspector.water' | 'inspector.selectedCell'
  | 'inspector.overlays' | 'inspector.npc' | 'inspector.teleport'
  | 'inspector.monster'
  | 'inspector.imageSection'
  | 'inspector.textDocument' | 'inspector.length' | 'inspector.edit'
  | 'inspector.trueLabel' | 'inspector.falseLabel'

  // === Console ===
  | 'console.title' | 'console.clear'
  | 'console.noLogs.title' | 'console.noLogs.body'

  // === Welcome/Dashboard ===
  | 'welcome.title' | 'welcome.subtitle' | 'welcome.description'
  | 'welcome.openProject' | 'welcome.importFolder' | 'welcome.newUiLayout'
  | 'welcome.recent' | 'welcome.projects' | 'welcome.noCachedProjects'
  | 'welcome.openLatest' | 'welcome.clear' | 'welcome.open' | 'welcome.remove'
  | 'welcome.workspace' | 'welcome.status' | 'welcome.sceneReady'
  | 'welcome.noDocument'
  // Dashboard sections
  | 'dashboard.home' | 'dashboard.projects' | 'dashboard.editors'
  | 'dashboard.project' | 'dashboard.chooseProject'
  | 'dashboard.searchProjects' | 'dashboard.sortRecent' | 'dashboard.sortName'
  | 'dashboard.projectList' | 'dashboard.noProjects' | 'dashboard.noProjectsHint'
  | 'dashboard.latestProject' | 'dashboard.noCachedProject'
  | 'dashboard.scene' | 'dashboard.noDocumentHint'
  | 'dashboard.editorsTitle' | 'dashboard.editorDesc'
  | 'dashboard.dashboard' | 'dashboard.creatorCenter'
  | 'dashboard.latest' | 'dashboard.none'
  | 'dashboard.noCachedProjectsTitle' | 'dashboard.noCachedProjectsHint'
  | 'dashboard.workspaceTools'
  | 'dashboard.installedEditorModules'
  | 'dashboard.brmUiStudioDesc' | 'dashboard.legacyLabsDesc'
  // Tool cards
  | 'tool.uiLayoutEditor' | 'tool.uiLayoutEditorDesc'
  | 'tool.avatarEffectLabs' | 'tool.avatarEffectLabsDesc'
  | 'tool.atlasBmfontMap' | 'tool.atlasBmfontMapDesc'
  // Brand
  | 'brand.name' | 'brand.tagline' | 'brand.legacyLabs' | 'brand.legacyLabsDesc'

  // === Status Messages ===
  | 'status.workspace' | 'status.noWorkspace' | 'status.writable'
  | 'status.readonly' | 'status.assets' | 'status.dirty' | 'status.ready'
  | 'status.detached' | 'status.idle' | 'status.running'
  | 'status.focus'

  // === Context Menu ===
  | 'context.copy' | 'context.paste' | 'context.delete' | 'context.duplicate'
  | 'context.selectAll' | 'context.copyPath' | 'context.copyName' | 'context.openInExplorer'
  | 'context.refresh' | 'context.properties' | 'context.rename'
  | 'context.newFolder' | 'context.newFile'
  | 'context.open' | 'context.addChild'
  | 'context.addChildPanel' | 'context.addChildButton' | 'context.addChildText'
  | 'context.addChildImage' | 'context.addChildList'
  | 'context.closeOthers' | 'context.closeAll' | 'context.closeRight' | 'context.closeSaved'
  | 'context.expandAll' | 'context.collapseAll'
  | 'context.clearConsole' | 'context.copyAllLogs'
  | 'context.zoomToFit' | 'context.zoom100'
  | 'context.resetTransform' | 'context.toggleGrid'
  | 'context.lockInspector' | 'context.unlockInspector'
  | 'context.moveUp' | 'context.moveDown'
  | 'context.toggleVisibility' | 'context.lockNode' | 'context.unlockNode'

  // === Settings ===
  | 'settings.title' | 'settings.language' | 'settings.theme'
  | 'settings.resetLayout' | 'settings.general'

  // === Common ===
  | 'common.ok' | 'common.cancel' | 'common.save' | 'common.discard'
  | 'common.close' | 'common.yes' | 'common.no'
  | 'common.expand' | 'common.collapse'

  // === Toolbar ===
  | 'toolbar.openProject' | 'toolbar.importFolder' | 'toolbar.rescan'
  | 'toolbar.newUiLayout' | 'toolbar.avatarLab' | 'toolbar.effectLab'
  | 'toolbar.save' | 'toolbar.saveAll'
  | 'toolbar.collapseLeftDock' | 'toolbar.collapseBottomDock' | 'toolbar.collapseInspectorDock'

  // === Tabs ===
  | 'tabs.noDocument' | 'tabs.close'

  // === Bottom Dock ===
  | 'dock.console' | 'dock.selection' | 'dock.project'

  // === Metrics ===
  | 'metrics.document' | 'metrics.selectedAsset' | 'metrics.selectedNode' | 'metrics.mapCell'
  | 'metrics.workspace' | 'metrics.profile' | 'metrics.recentProjects' | 'metrics.progress'
  | 'metrics.activeDocument' | 'metrics.noAssetSelected' | 'metrics.noWorkspaceMounted'
  | 'metrics.noNodeSelected' | 'metrics.noMapCellSelected'

  // === Dirty Action Modal ===
  | 'dirty.closeDocument' | 'dirty.workspaceTransition'
  | 'dirty.unsavedChanges' | 'dirty.unsavedChangesWorkspace'
  | 'dirty.savable' | 'dirty.previewOnly' | 'dirty.saveLabel' | 'dirty.discardLabel' | 'dirty.cancelLabel'
  | 'dirty.closeWithoutSaving'

  // === Window Title ===
  | 'window.noProject'

  // === Preview Pane ===
  | 'preview.sceneLabel' | 'preview.legacyLayoutPreview'
  | 'preview.handModeDesc' | 'preview.rectModeDesc' | 'preview.scaleModeDesc'
  | 'preview.rotateModeDesc' | 'preview.moveModeDesc' | 'preview.previewModeDesc'
  | 'preview.atlasPlistPreview' | 'preview.atlasPlistDesc'
  | 'preview.noTexture' | 'preview.noTextureBody'
  | 'preview.framesLabel' | 'preview.entriesCount'
  | 'preview.bitmapFontPreview' | 'preview.bitmapFontDesc'
  | 'preview.sample' | 'preview.noBitmapSheet' | 'preview.noBitmapSheetBody'
  | 'preview.glyphsLabel' | 'preview.noPrintableGlyphs'
  | 'preview.avatarPreviewLab' | 'preview.avatarLabDesc'
  | 'preview.linkedSource' | 'preview.resources'
  | 'preview.clothCount' | 'preview.fileNA'
  | 'preview.bizAnimationBank' | 'preview.bizBankDesc'
  | 'preview.noSheetTexture' | 'preview.noSheetTextureBody'
  | 'preview.filesLabel' | 'preview.fileGroups' | 'preview.dirFrames'
  | 'preview.effectPreviewLab' | 'preview.effectLabDesc'
  | 'preview.mapoBlockEditor'
  | 'preview.mapHandModeDesc' | 'preview.mapPaintDesc' | 'preview.mapPreviewDesc'
  | 'preview.imageViewer' | 'preview.imageViewerDesc'
  | 'preview.textMetaDocument' | 'preview.textMetaDesc'
  | 'preview.dir' | 'preview.loopOn' | 'preview.loopOff'
  | 'preview.stateIdle' | 'preview.stateWalk' | 'preview.stateRun'
  | 'preview.stateAtk' | 'preview.stateMagic'

  // === App Status ===
  | 'app.readyMessage' | 'app.noDocumentSelected' | 'app.noNodeSelected'
  | 'app.noMapCellSelected' | 'app.itemsIndexed'
  | 'app.preparingWorkspace';

export type Translations = Record<TranslationKey, string>;
