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
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ResourceContextKey } from 'vs/workbench/common/resources';
import { IDecorationsService } from 'vs/workbench/services/decorations/browser/decorations';
import { WorkbenchCompressibleAsyncDataTree } from 'vs/platform/list/browser/listService';
import { DelayedDragHandler } from 'vs/base/browser/dnd';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ILabelService } from 'vs/platform/label/common/label';
import { ExplorerDelegate, ExplorerDataSource, FilesRenderer, ICompressedNavigationController, FilesFilter, FileSorter, FileDragAndDrop, ExplorerCompressionDelegate, isCompressedFolderName } from 'vs/workbench/contrib/scopeTree/browser/explorerViewer';
import { IThemeService, IFileIconTheme } from 'vs/platform/theme/common/themeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
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
import { Event } from 'vs/base/common/event';
import { attachStyler, IColorMapping } from 'vs/platform/theme/common/styler';
import { ColorValue, listDropBackground } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';

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
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.treeContainer = DOM.append(container, DOM.$('.explorer-folders-view'));

		// this.styleElement = DOM.createStyleSheet(this.treeContainer);
		// attachStyler<IExplorerViewColors>(this.themeService, { listDropBackground }, this.styleListDropBackground.bind(this));

		this.createTree(this.treeContainer);

		this._register(this.labelService.onDidChangeFormatters(() => {
			this._onDidChangeTitleArea.fire();
		}));

		this.onDidChangeExpansionState(e => {
			if (e) {
				DOM.show(breadcrumbBackground);
			} else {
				DOM.hide(breadcrumbBackground);
			}
		});

		this._register(this.tree.onMouseOver(e => {
			const icon = document.getElementById('iconContainer_' + e.element?.resource.toString());

			if (icon !== null) {
				icon.style.visibility = 'visible';
			}
		}));

		this._register(this.tree.onMouseOut(e => {
			const icon = document.getElementById('iconContainer_' + e.element?.resource.toString());

			if (icon !== null) {
				icon.style.visibility = 'hidden';
			}
		}));
	}

	private createTree(container: HTMLElement): void {
		this.filter = this.instantiationService.createInstance(FilesFilter);
		this._register(this.filter);
		const explorerLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this._register(explorerLabels);

		const updateWidth = (stat: ExplorerItem) => this.tree.updateWidth(stat);
		this.renderer = this.instantiationService.createInstance(FilesRenderer, explorerLabels, updateWidth);
		this._register(this.renderer);

		const isCompressionEnabled = () => this.configurationService.getValue<boolean>('explorer.compactFolders');

		this.tree = <WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>>this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'FileExplorer', container, new ExplorerDelegate(), new ExplorerCompressionDelegate(), [this.renderer],
			this.instantiationService.createInstance(ExplorerDataSource), {
			compressionEnabled: isCompressionEnabled(),
			accessibilityProvider: this.renderer,
			identityProvider: {
				getId: (stat: ExplorerItem) => {
					if (stat instanceof NewExplorerItem) {
						return `new:${stat.resource}`;
					}

					return stat.resource;
				}
			},
			keyboardNavigationLabelProvider: {
				getKeyboardNavigationLabel: (stat: ExplorerItem) => {
					if (this.explorerService.isEditable(stat)) {
						return undefined;
					}

					return stat.name;
				},
				getCompressedNodeKeyboardNavigationLabel: (stats: ExplorerItem[]) => {
					if (stats.some(stat => this.explorerService.isEditable(stat))) {
						return undefined;
					}

					return stats.map(stat => stat.name).join('/');
				}
			},
			multipleSelectionSupport: true,
			filter: this.filter,
			sorter: this.instantiationService.createInstance(FileSorter),
			dnd: this.instantiationService.createInstance(FileDragAndDrop),
			autoExpandSingleChildren: true,
			additionalScrollHeight: ExplorerDelegate.ITEM_HEIGHT,
			overrideStyles: {
				listBackground: SIDE_BAR_BACKGROUND
			}
		});
		this._register(this.tree);

		// Bind configuration
		const onDidChangeCompressionConfiguration = Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('explorer.compactFolders'));
		this._register(onDidChangeCompressionConfiguration(_ => this.tree.updateOptions({ compressionEnabled: isCompressionEnabled() })));

		// Bind context keys
		FilesExplorerFocusedContext.bindTo(this.tree.contextKeyService);
		ExplorerFocusedContext.bindTo(this.tree.contextKeyService);

		// Open when selecting via keyboard
		this._register(this.tree.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}
			// Do not react if the user is expanding selection via keyboard.
			// Check if the item was previously also selected, if yes the user is simply expanding / collapsing current selection #66589.
			const shiftDown = e.browserEvent instanceof KeyboardEvent && e.browserEvent.shiftKey;
			if (!shiftDown) {
				if (element.isDirectory || this.explorerService.isEditable(undefined)) {
					// Do not react if user is clicking on explorer items while some are being edited #70276
					// Do not react if clicking on directories
					return;
				}
				this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: 'workbench.files.openFile', from: 'explorer' });
				await this.editorService.openEditor({ resource: element.resource, options: { preserveFocus: e.editorOptions.preserveFocus, pinned: e.editorOptions.pinned } }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
			}
		}));

		this._register(this.tree.onDidScroll(async e => {
			let editable = this.explorerService.getEditable();
			if (e.scrollTopChanged && editable && this.tree.getRelativeTop(editable.stat) === null) {
				await editable.data.onFinish('', false);
			}
		}));

		this._register(this.tree.onDidChangeCollapseState(e => {
			const element = e.node.element?.element;
			if (element) {
				const navigationController = this.renderer.getCompressedNavigationController(element instanceof Array ? element[0] : element);
				if (navigationController) {
					navigationController.updateCollapsed(e.node.collapsed);
				}
			}
		}));
	}
}
