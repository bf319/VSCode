/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/bookmarkIcon';
import * as DOM from 'vs/base/browser/dom';
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
import { IMenuService, IMenu } from 'vs/platform/actions/common/actions';
import { URI } from 'vs/base/common/uri';
import { dirname, basename } from 'vs/base/common/resources';
import { IListVirtualDelegate, IKeyboardNavigationLabelProvider } from 'vs/base/browser/ui/list/list';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { ResourceLabels, IResourceLabel } from 'vs/workbench/browser/labels';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IExplorerService } from 'vs/workbench/contrib/files/common/files';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { createMatches, FuzzyScore } from 'vs/base/common/filters';
import { ITreeRenderer, ITreeNode, ITreeElement } from 'vs/base/browser/ui/tree/tree';
import { bookmarkClass, IBookmarksManager, BookmarkType } from 'vs/workbench/contrib/scopeTree/common/bookmarks';

class RecentDirectory {
	public resource: URI;

	constructor(path: string) {
		this.resource = URI.parse(path);
	}

	public getName(): string {
		return basename(this.resource);
	}

	public getParent(): string {
		return dirname(this.resource).toString();
	}
}

export class DirectoryDelegate implements IListVirtualDelegate<RecentDirectory> {
	static readonly ITEM_HEIGHT = 22;

	getHeight(element: RecentDirectory): number {
		return DirectoryDelegate.ITEM_HEIGHT;
	}

	getTemplateId(element: RecentDirectory): string {
		return 'RecentDirectoriesRenderer';
	}
}

interface IDirectoryTemplateData {
	dirContainer: HTMLElement;
	label: IResourceLabel;
	elementDisposable: IDisposable;
}

class DirectoryElementIconRenderer implements IDisposable {
	private _focusIcon!: HTMLElement;
	private _bookmarkIcon!: HTMLElement;

	constructor(private readonly container: HTMLElement,
		private readonly stat: URI,
		private readonly explorerService: IExplorerService,
		private readonly bookmarksManager: IBookmarksManager) {
		this.renderBookmarkIcon();
		this.renderFocusIcon();
		this.addListeners();
	}

	get focusIcon(): HTMLElement {
		return this._focusIcon;
	}

	get bookmarkIcon(): HTMLElement {
		return this._bookmarkIcon;
	}

	private showIcon = () => {
		this._focusIcon.style.visibility = 'visible';
	};

	private hideIcon = () => {
		this._focusIcon.style.visibility = 'hidden';
	};

	private select = async () => {
		await this.explorerService.select(this.stat, true);	// Should also expand directory
	};

	private setRoot = () => {
		this.explorerService.setRoot(this.stat);
	};

	private addListeners(): void {
		this.container.addEventListener('mouseover', this.showIcon);
		this.container.addEventListener('mouseout', this.hideIcon);
		this.container.addEventListener('dblclick', this.select);
		this._focusIcon.addEventListener('click', this.setRoot);
	}

	private renderFocusIcon(): void {
		this._focusIcon = document.createElement('img');
		this._focusIcon.className = 'scope-tree-focus-icon-near-bookmark';
		this._focusIcon.style.paddingLeft = '5px';
		this.container.insertBefore(this._focusIcon, this.container.firstChild);
	}

	private renderBookmarkIcon(): void {
		const bookmarkType = this.bookmarksManager.getBookmarkType(this.stat);
		this._bookmarkIcon = document.createElement('img');
		this._bookmarkIcon.id = 'bookmarkIconRecentDirectoryContainer_' + this.stat.toString();
		this._bookmarkIcon.className = bookmarkClass(bookmarkType);
		this._bookmarkIcon.onclick = () => {
			const newType = this.bookmarksManager.toggleBookmarkType(this.stat);
			this._bookmarkIcon.className = bookmarkClass(newType);
		};

		if (bookmarkType === BookmarkType.NONE) {
			this._bookmarkIcon.style.opacity = '0';
		}

		this.container.insertBefore(this._bookmarkIcon, this.container.firstChild);
	}

	dispose(): void {
		this._focusIcon.remove();
		this._bookmarkIcon.remove();
		// Listeners need to be removed because container (templateData.label.element) is not removed from the DOM.
		this.container.removeEventListener('mouseover', this.showIcon);
		this.container.removeEventListener('mouseout', this.hideIcon);
		this.container.removeEventListener('dblclick', this.select);
		this._focusIcon.removeEventListener('click', this.setRoot);
	}
}

class DirectoryRenderer implements ITreeRenderer<RecentDirectory, FuzzyScore, IDirectoryTemplateData> {
	static readonly ID = 'RecentDirectoriesRenderer';

	constructor(
		private labels: ResourceLabels,
		private readonly explorerService: IExplorerService,
		private readonly bookmarksManager: IBookmarksManager
	) { }

	get templateId() {
		return DirectoryRenderer.ID;
	}

	renderTwistie(element: RecentDirectory, twistieElement: HTMLElement): void {
		// Even though the twistie is not visible, it causes some extra padding so it should be removed
		twistieElement.remove();
	}

	renderTemplate(container: HTMLElement): IDirectoryTemplateData {
		const label = this.labels.create(container, { supportHighlights: true });
		const dirContainer = DOM.append(container, document.createElement('div'));
		return { dirContainer: dirContainer, label: label, elementDisposable: Disposable.None };
	}

	renderElement(element: ITreeNode<RecentDirectory, FuzzyScore>, index: number, templateData: IDirectoryTemplateData, height: number | undefined): void {
		templateData.elementDisposable.dispose();
		templateData.elementDisposable = this.renderRecentDirectory(element.element, templateData, element.filterData);
	}

	disposeTemplate(templateData: IDirectoryTemplateData): void {
		templateData.elementDisposable.dispose();
		templateData.label.dispose();
	}

	private renderRecentDirectory(dir: RecentDirectory, templateData: IDirectoryTemplateData, filterData: FuzzyScore | undefined): IDisposable {
		templateData.label.setResource({
			resource: dir.resource,
			name: dir.getName(),
			description: dir.getParent().toString()
		}, {
			matches: createMatches(filterData)
		});

		return new DirectoryElementIconRenderer(templateData.label.element, dir.resource, this.explorerService, this.bookmarksManager);
	}
}

export class RecentDirectoriesView extends ViewPane {
	static readonly ID: string = 'workbench.explorer.displayRecentDirectories';
	static readonly NAME = 'Recent directories';

	private labels!: ResourceLabels;
	private tree!: WorkbenchObjectTree<RecentDirectory>;

	private dirs: ITreeElement<RecentDirectory>[] = [];

	private contributedContextMenu!: IMenu;

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
		@IMenuService private readonly menuService: IMenuService,
		@IRecentDirectoriesManager private readonly recentDirectoriesManager: IRecentDirectoriesManager,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IBookmarksManager private readonly bookmarksManager: IBookmarksManager
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this._register(this.recentDirectoriesManager.onOpenedDirectory(e => {
			const openedDir = e.openedDir;
			const replacedDir = e.replacedDir;
			if (replacedDir) {
				this.removeDirectory(replacedDir);
			}
			this.renderNewDir(openedDir);
		}));

		this._register(this.bookmarksManager.onAddedBookmark(e => {
			if (this.dirs.find(dir => dir.element.resource.toString() === e.uri.toString())) {
				const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.uri.toString());
				if (bookmarkIcon) {
					bookmarkIcon.className = bookmarkClass(e.bookmarkType);
					if (e.bookmarkType === BookmarkType.NONE) {
						bookmarkIcon.style.opacity = '0';
					} else {
						bookmarkIcon.style.opacity = '1';
					}
				}
			}
		}));
	}

	renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.labels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this.tree = <WorkbenchObjectTree<RecentDirectory>>this.instantiationService.createInstance(WorkbenchObjectTree, 'RecentDirectories', container,
			new DirectoryDelegate(), [new DirectoryRenderer(this.labels, this.explorerService, this.bookmarksManager)],
			{
				accessibilityProvider: {
					getAriaLabel(element: RecentDirectory) {
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

		this.getDirectoriesTreeElement(this.recentDirectoriesManager.recentDirectories);
		this.tree.setChildren(null, this.dirs);

		this._register(this.tree.onMouseOver(e => {
			const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.element?.resource.toString());
			if (bookmarkIcon && e.element && this.bookmarksManager.getBookmarkType(e.element.resource) === BookmarkType.NONE) {
				bookmarkIcon.style.opacity = '1';
			}
		}));

		this._register(this.tree.onMouseOut(e => {
			const bookmarkIcon = document.getElementById('bookmarkIconRecentDirectoryContainer_' + e.element?.resource.toString());
			if (bookmarkIcon && e.element && this.bookmarksManager.getBookmarkType(e.element.resource) === BookmarkType.NONE) {
				bookmarkIcon.style.opacity = '0';
			}
		}));
	}

	protected layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	private getDirectoriesTreeElement(rawDirs: Set<string>) {
		rawDirs.forEach(path => this.dirs.push({
			element: new RecentDirectory(path)
		}));
	}

	private renderNewDir(resource: string): void {
		this.dirs.splice(0, 0, { element: new RecentDirectory(resource) });
		this.tree.setChildren(null, this.dirs);
	}

	private removeDirectory(resource: string) {
		this.dirs = this.dirs.filter(e => e.element.resource.toString() !== resource);
		this.tree.setChildren(null, this.dirs);
	}
}

class RecentDirectoriesKeyboardNavigationLabelProvider implements IKeyboardNavigationLabelProvider<RecentDirectory> {
	getKeyboardNavigationLabel(element: RecentDirectory): string {
		return element.getName();
	}
}
