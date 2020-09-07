/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import * as perf from 'vs/base/common/performance';
import { IAction, WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification } from 'vs/base/common/actions';
import { memoize } from 'vs/base/common/decorators';
import { IFilesConfiguration, ExplorerFolderContext, FilesExplorerFocusedContext, ExplorerFocusedContext, ExplorerRootContext, ExplorerResourceReadonlyContext, IExplorerService, ExplorerResourceCut, ExplorerResourceMoveableToTrash, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext, ExplorerCompressedLastFocusContext, ExplorerResourceAvailableEditorIdsContext } from 'vs/workbench/contrib/files/common/files';
import { NewFolderAction, NewFileAction, FileCopiedContext, RefreshExplorerView, CollapseExplorerView } from 'vs/workbench/contrib/files/browser/fileActions';
import { toResource, SideBySideEditor } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import * as DOM from 'vs/base/browser/dom';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ExplorerDecorationsProvider } from 'vs/workbench/contrib/files/browser/views/explorerDecorationsProvider';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService, createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ResourceContextKey } from 'vs/workbench/common/resources';
import { IDecorationsService } from 'vs/workbench/services/decorations/browser/decorations';
import { WorkbenchCompressibleAsyncDataTree, WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { DelayedDragHandler } from 'vs/base/browser/dnd';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ILabelService } from 'vs/platform/label/common/label';
import { ExplorerDelegate, ExplorerDataSource, FilesRenderer, ICompressedNavigationController, FilesFilter, FileSorter, FileDragAndDrop, ExplorerCompressionDelegate, isCompressedFolderName } from 'vs/workbench/contrib/scopeTree/browser/explorerViewer';
import { IThemeService, IFileIconTheme } from 'vs/platform/theme/common/themeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IMenuService, MenuId, IMenu } from 'vs/platform/actions/common/actions';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ExplorerItem, NewExplorerItem } from 'vs/workbench/contrib/files/common/explorerModel';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IAsyncDataTreeViewState } from 'vs/base/browser/ui/tree/asyncDataTree';
import { FuzzyScore } from 'vs/base/common/filters';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { withNullAsUndefined } from 'vs/base/common/types';
import { IFileService, FileSystemProviderCapabilities } from 'vs/platform/files/common/files';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { attachStyler, IColorMapping } from 'vs/platform/theme/common/styler';
import { ColorValue, listDropBackground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ITreeRenderer, ITreeNode, ITreeElement, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';

interface IExplorerViewColors extends IColorMapping {
	listDropBackground?: ColorValue | undefined;
}

interface IExplorerViewStyles {
	listDropBackground?: Color;
}

export interface IBlueprintsObserver {
	readonly _serviceBrand: undefined;
	blueprints: ExplorerItem[];

	addBlueprint(resources: URI): void;

	onDidAddBlueprint: Event<void>;
}

export const IBlueprintsObserver = createDecorator<IBlueprintsObserver>('bogdanBlueprintsObserver');

export class Blueprints implements IBlueprintsObserver {
	declare readonly _serviceBrand: undefined;
	public blueprints: ExplorerItem[] = [];

	static readonly WORKSPACE_BLUEPRINT_STORAGE_KEY: string = 'workbench.explorer.blueprintsStorageKey';

	constructor(@IFileService private readonly fileService: IFileService,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IStorageService private readonly storageService: IStorageService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		// this.initializeBlueprint();
	}

	public addBlueprint(resources: URI): void {
		this.convertToObject(resources).then(element => {
			this.blueprints.push(element);
			this._onDidAddBlueprint.fire();
			// this.saveWorkspaceBlueprint();
		});
	}

	private _onDidAddBlueprint = new Emitter<void>();
	public onDidAddBlueprint = this._onDidAddBlueprint.event;

	private async convertToObject(resource: URI) {
		const root = new ExplorerItem(resource, this.fileService, undefined);
		const children = await root.fetchChildren(this.explorerService.sortOrder);
		children.forEach(child => {
			root.addChild(child);
		});
		return root;
	}

	// private initializeBlueprint(): void {
	// 	const rawWorkspaceBlueprint = this.storageService.get(Blueprints.WORKSPACE_BLUEPRINT_STORAGE_KEY, StorageScope.GLOBAL);
	// 	this.blueprints = [];
	// 	if (rawWorkspaceBlueprint) {
	// 		const currentWorkspace = this.contextService.getWorkspace().id;
	// 		const directories = new Map<string, Set<ExplorerItem>>(JSON.parse(rawWorkspaceBlueprint));

	// 		if (directories && (directories instanceof Map) &&  directories.has(currentWorkspace)) {
	// 			const dirs = directories.get(currentWorkspace);
	// 			if (dirs) {
	// 				this.blueprints = Array.from(dirs);
	// 			}
	// 		}
	// 	}
	// }

	// private saveWorkspaceBlueprint(): void {
	// 	const rawWorkspaceBlueprint = this.storageService.get(Blueprints.WORKSPACE_BLUEPRINT_STORAGE_KEY, StorageScope.GLOBAL);
	// 	const currentWorkspace = this.contextService.getWorkspace().id;

	// 	let map = new Map<string, Set<ExplorerItem>>();

	// 	if (rawWorkspaceBlueprint && (JSON.parse(rawWorkspaceBlueprint) instanceof Map)) {
	// 		map = JSON.parse(rawWorkspaceBlueprint) as Map<string, Set<ExplorerItem>>;
	// 	}

	// 	map.set(currentWorkspace, new Set(this.blueprints));

	// 	this.storageService.store(Blueprints.WORKSPACE_BLUEPRINT_STORAGE_KEY, JSON.stringify(Array.from(map.entries())), StorageScope.GLOBAL);
	// }
}

export class BlueprintsView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.blueprintDirectories';
	static readonly NAME = 'Blueprints';

	private tree!: WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>;
	private filter!: FilesFilter;

	private resourceContext: ResourceContextKey;
	private folderContext: IContextKey<boolean>;
	private readonlyContext: IContextKey<boolean>;
	private availableEditorIdsContext: IContextKey<string>;

	private rootContext: IContextKey<boolean>;
	private resourceMoveableToTrash: IContextKey<boolean>;

	private renderer!: FilesRenderer;

	private styleElement!: HTMLStyleElement;
	private treeContainer!: HTMLElement;
	private compressedFocusContext: IContextKey<boolean>;
	private compressedFocusFirstContext: IContextKey<boolean>;
	private compressedFocusLastContext: IContextKey<boolean>;

	private horizontalScrolling: boolean | undefined;

	// Refresh is needed on the initial explorer open
	private shouldRefresh = true;
	private dragHandler!: DelayedDragHandler;
	private autoReveal: boolean | 'focusNoScroll' = false;
	private actions: IAction[] | undefined;
	private decorationsProvider: ExplorerDecorationsProvider | undefined;

	private blueprints: ExplorerItem[] = [];

	constructor(
		options: IViewPaneOptions,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IProgressService private readonly progressService: IProgressService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IDecorationsService private readonly decorationService: IDecorationsService,
		@ILabelService private readonly labelService: ILabelService,
		@IThemeService protected themeService: IWorkbenchThemeService,
		@IMenuService private readonly menuService: IMenuService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IStorageService private readonly storageService: IStorageService,
		@IClipboardService private clipboardService: IClipboardService,
		@IFileService private readonly fileService: IFileService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IOpenerService openerService: IOpenerService,
		@IBlueprintsObserver private readonly blueprintsObserver: IBlueprintsObserver
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.resourceContext = instantiationService.createInstance(ResourceContextKey);
		this._register(this.resourceContext);

		this.folderContext = ExplorerFolderContext.bindTo(contextKeyService);
		this.readonlyContext = ExplorerResourceReadonlyContext.bindTo(contextKeyService);
		this.availableEditorIdsContext = ExplorerResourceAvailableEditorIdsContext.bindTo(contextKeyService);
		this.rootContext = ExplorerRootContext.bindTo(contextKeyService);
		this.resourceMoveableToTrash = ExplorerResourceMoveableToTrash.bindTo(contextKeyService);
		this.compressedFocusContext = ExplorerCompressedFocusContext.bindTo(contextKeyService);
		this.compressedFocusFirstContext = ExplorerCompressedFirstFocusContext.bindTo(contextKeyService);
		this.compressedFocusLastContext = ExplorerCompressedLastFocusContext.bindTo(contextKeyService);

		this.blueprintsObserver.onDidAddBlueprint(async () => {
			this.tree.setInput(this.blueprintsObserver.blueprints);

			if (!this.decorationsProvider) {
				this.decorationsProvider = new ExplorerDecorationsProvider(this.explorerService, this.contextService);
				this._register(this.decorationService.registerDecorationsProvider(this.decorationsProvider));
			}
		});
	}

	renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.treeContainer = DOM.append(container, DOM.$('.explorer-folders-view'));

		this.styleElement = DOM.createStyleSheet(this.treeContainer);
		attachStyler<IExplorerViewColors>(this.themeService, { listDropBackground }, this.styleListDropBackground.bind(this));

		this.createTree(this.treeContainer);
		this.tree.setInput(this.blueprintsObserver.blueprints);
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	private createTree(container: HTMLElement): void {
		const explorerLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		const updateWidth = (stat: ExplorerItem) => this.tree.updateWidth(stat);
		this.renderer = this.instantiationService.createInstance(FilesRenderer, explorerLabels, updateWidth);

		this._register(createFileIconThemableTreeContainerScope(container, this.themeService));

		this.tree = <WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>>this.instantiationService.createInstance(
			WorkbenchCompressibleAsyncDataTree,
			'BlueprintsPane',
			container,
			new ExplorerDelegate(),
			new ExplorerCompressionDelegate(),
			[this.renderer],
			this.instantiationService.createInstance(ExplorerDataSource),
			{
				accessibilityProvider: this.renderer,
				verticalScrollMode: ScrollbarVisibility.Auto
			});
	}

	styleListDropBackground(styles: IExplorerViewStyles): void {
		const content: string[] = [];

		if (styles.listDropBackground) {
			content.push(`.explorer-viewlet .explorer-item .monaco-icon-name-container.multiple > .label-name.drop-target > .monaco-highlighted-label { background-color: ${styles.listDropBackground}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}
}

function createFileIconThemableTreeContainerScope(container: HTMLElement, themeService: IThemeService): IDisposable {
	DOM.addClass(container, 'file-icon-themable-tree');
	DOM.addClass(container, 'show-file-icons');

	const onDidChangeFileIconTheme = (theme: IFileIconTheme) => {
		DOM.toggleClass(container, 'align-icons-and-twisties', theme.hasFileIcons && !theme.hasFolderIcons);
		DOM.toggleClass(container, 'hide-arrows', theme.hidesExplorerArrows === true);
	};

	onDidChangeFileIconTheme(themeService.getFileIconTheme());
	return themeService.onDidFileIconThemeChange(onDidChangeFileIconTheme);
}
