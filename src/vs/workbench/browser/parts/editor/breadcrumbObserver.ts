/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { FileKind } from 'vs/platform/files/common/files';
import { IResourceLabel } from 'vs/workbench/browser/labels';
import { Tree } from 'vs/workbench/browser/parts/editor/breadcrumbsPicker';

export interface IBreadcrumbObserver {
	readonly _serviceBrand: undefined;
	renderFocusIcon(resource: URI, fileKind: FileKind, templateData: IResourceLabel): void;
	registerTreeListeners(tree: Tree<any, any>): void;
}

export const IBreadcrumbObserver = createDecorator<IBreadcrumbObserver>('breadcrumbObserver');
