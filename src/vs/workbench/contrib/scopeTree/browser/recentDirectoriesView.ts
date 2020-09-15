/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/bookmarkIcon';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IRecentDirectoriesManager } from 'vs/workbench/contrib/scopeTree/common/recentDirectories';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { URI } from 'vs/base/common/uri';
import { IListVirtualDelegate, IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { createMatches, FuzzyScore } from 'vs/base/common/filters';
import { ITreeNode, ITreeElement } from 'vs/base/browser/ui/tree/tree';
import { bookmarkClass, IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';
import { Directory, IDirectoryTemplateData, DirectoryElementIconRenderer, DirectoryRenderer } from 'vs/workbench/contrib/scopeTree/browser/directoryViewer';
import { IFileService } from 'vs/platform/files/common/files';

export class DirectoryDelegate implements IListVirtualDelegate<Directory> {
	static readonly ITEM_HEIGHT = 22;

	getHeight(element: Directory): number {
		return DirectoryDelegate.ITEM_HEIGHT;
	}

	getTemplateId(element: Directory): string {
		return 'RecentDirectoriesRenderer';
	}
}

class RecentDirectoryElementIconRenderer extends DirectoryElementIconRenderer {
	private _bookmarkIcon!: HTMLElement;

	constructor(container: HTMLElement,
		stat: URI,
		explorerService: IExplorerService,
		private readonly bookmarksManager: IBookmarksManager) {
		super(container, stat, explorerService);
		this._focusIcon.style.paddingLeft = '5px';

		this.renderBookmarkIcon();
	}

	get bookmarkIcon(): HTMLElement {
		return this._bookmarkIcon;
	}

	private renderBookmarkIcon(): void {
		const bookmarkType = this.bookmarksManager.getBookmarkType(this.stat);
		this._bookmarkIcon = document.createElement('img');
		this._bookmarkIcon.id = 'bookmarkIconRecentDirectoryContainer_' + this.stat.toString();
		this._bookmarkIcon.className = bookmarkClass(bookmarkType);
		this._bookmarkIcon.onclick = () => this.bookmarksManager.toggleBookmarkType(this.stat);
		this._bookmarkIcon.style.paddingRight = '10px';

		if (bookmarkType === BookmarkType.NONE) {
			this._bookmarkIcon.style.visibility = 'hidden';
		}

		this.container.appendChild(this._bookmarkIcon);
	}

	dispose(): void {
		super.dispose();
		this._bookmarkIcon.remove();
	}
}

class RecentDirectoryRenderer extends DirectoryRenderer {
	static readonly ID = 'RecentDirectoriesRenderer';

	constructor(
		labels: ResourceLabels,
		explorerService: IExplorerService,
		private readonly bookmarksManager: IBookmarksManager
	) {
		super(labels, explorerService);
	}

	get templateId() {
		return RecentDirectoryRenderer.ID;
	}

	renderTwistie(element: Directory, twistieElement: HTMLElement): void {
		// Even though the twistie is not visible, it causes some extra padding so it should be removed
		twistieElement.remove();
	}

	renderElement(element: ITreeNode<Directory, FuzzyScore>, index: number, templateData: IDirectoryTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderRecentDirectory(element.element, templateData, element.filterData);
	}

	private renderRecentDirectory(dir: Directory, templateData: IDirectoryTemplateData, filterData: FuzzyScore | undefined): IDisposable {
		templateData.label.setResource({
			resource: dir.resource,
			name: dir.getName(),
			description: dir.getParent().toString()
		}, {
			matches: createMatches(filterData),
			strikethrough: !dir.exists,
			title: dir.exists ? undefined : 'Does not exist'
		});

		return new RecentDirectoryElementIconRenderer(templateData.label.element, dir.resource, this.explorerService, this.bookmarksManager);
	}
}

export class RecentDirectoriesView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayRecentDirectories';
	static readonly NAME = 'Recent directories';

	private labels!: ResourceLabels;
	private tree!: WorkbenchObjectTree<Directory>;

	private dirs: ITreeElement<Directory>[] = [];
	private dirty: boolean = false;

	constructor(
		options: IViewletViewOptions,
		@IThemeService themeService: IThemeService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IRecentDirectoriesManager private readonly recentDirectoriesManager: IRecentDirectoriesManager,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IBookmarksManager private readonly bookmarksManager: IBookmarksManager,
		@IFileService private readonly fileService: IFileService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this._register(this.recentDirectoriesManager.onRecentDirectoriesChanged(() => this.markDirty()));

		this._register(this.bookmarksManager.onBookmarksChanged(e => {
			if (this.dirs.find(dir => dir.element.resource.toString() === e.uri.toString())) {
				const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.uri.toString());
				if (bookmarkIcon) {
					bookmarkIcon.className = bookmarkClass(e.bookmarkType);
					if (e.bookmarkType === BookmarkType.NONE) {
						bookmarkIcon.style.visibility = 'hidden';
					} else {
						bookmarkIcon.style.visibility = 'visible';
					}
				}
			}
		}));

		this._register(this.fileService.onDidFilesChange(e => {
			const deleted = e.getDeleted().filter(file => this.dirs.find(recentDir => recentDir.element.resource.toString() === file.resource.toString()));
			const added = e.getAdded().filter(file => this.dirs.find(recentDir => recentDir.element.resource.toString() === file.resource.toString()));
			if (added.length > 0 || deleted.length > 0) {
				this.markDirty();
			}
		}));
	}

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.labels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this.tree = <WorkbenchObjectTree<Directory>>this.instantiationService.createInstance(WorkbenchObjectTree, 'RecentDirectories', container,
			new DirectoryDelegate(), [new RecentDirectoryRenderer(this.labels, this.explorerService, this.bookmarksManager)],
			{
				accessibilityProvider: {
					getAriaLabel(element: Directory) {
						return element.resource.toString();
					},

					getWidgetAriaLabel() {
						return 'Recent Directories';
					}
				},
				verticalScrollMode: ScrollbarVisibility.Auto,
				keyboardNavigationLabelProvider: new RecentDirectoriesKeyboardNavigationLabelProvider()
			});
		this._register(this.labels);
		this._register(this.tree);

		this.markDirty();

		this._register(this.tree.onMouseOver(e => {
			const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.element?.resource.toString());
			if (bookmarkIcon && e.element && this.bookmarksManager.getBookmarkType(e.element.resource) === BookmarkType.NONE) {
				bookmarkIcon.style.visibility = 'visible';
			}
		}));

		this._register(this.tree.onMouseOut(e => {
			const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.element?.resource.toString());
			if (bookmarkIcon && e.element && this.bookmarksManager.getBookmarkType(e.element.resource) === BookmarkType.NONE) {
				bookmarkIcon.style.visibility = 'hidden';
			}
		}));

		this._register(this.tree.onKeyDown(e => {
			if (e.key !== 'Enter') {
				return;
			}

			const selection = this.tree.getSelection();
			if (selection.length === 1) {
				const dir = selection[0];
				if (dir && dir.exists) {
					this.explorerService.selectOrSetRoot(dir.resource);
				}
			}
		}));

		this._register(this.tree.onMouseDblClick(e => {
			const dir = e.element;
			if (dir && dir.exists) {
				this.explorerService.selectOrSetRoot(dir.resource);
			}
		}));

		this._register(this.bookmarksManager.onBookmarksChanged(e => {
			if (!this.isVisible) {
				return;
			}

			this.bookmarksManager.changeTypeAndDisplay('bookmarkIconRecentDirectoryContainer_' + e.uri.toString(), e.bookmarkType);
		}));

		this._register(this.onDidChangeExpansionState(visible => {
			if (visible) {
				this.refreshView();
			}
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	private refreshView(): void {
		if (this.dirty) {
			this.dirty = false;
			this.getDirectoriesTreeElement(this.recentDirectoriesManager.recentDirectories).then(() => {
				this.tree.setChildren(null, this.dirs);
			});
		}
	}

	private async getDirectoriesTreeElement(rawDirs: Set<string>): Promise<void> {
		this.dirs = [];
		for (let path of rawDirs) {
			const scheme = URI.parse(path).scheme;
			if (scheme === 'file' || scheme === 'memfs') {
				const element = new Directory(path);
				element.exists = await this.fileService.exists(element.resource);

				this.dirs.push({
					element: element
				});
			}
		}
		this.dirs.reverse();
	}

	private markDirty() {
		if (!this.dirty) {
			this.dirty = true;
			setTimeout(() => this.refreshView(), 100);
		}
	}
}

class RecentDirectoriesKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<Directory> {
	getKeyboardNavigationLabel(element: Directory): string {
		return element.getName();
	}
}
