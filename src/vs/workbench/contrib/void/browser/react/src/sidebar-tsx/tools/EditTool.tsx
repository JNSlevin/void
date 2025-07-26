/*--------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { URI } from '../../../../../../../base/common/uri.js';
import { BuiltinToolCallParams } from '../../../../common/toolsServiceTypes.js';
import { ToolMessage } from '../../../../common/chatThreadServiceTypes.js';
import { useAccessor } from '../../util/services.js';
import { ChatMarkdownRender } from '../../markdown/ChatMarkdownRender.js';
import { VoidDiffEditor } from '../../util/inputs.js';
import { getApplyBoxId } from '../../markdown/ChatMarkdownRender.js';
import { CopyButton, EditToolAcceptRejectButtonsHTML, useEditToolStreamState } from '../../markdown/ApplyBlockHoverButtons.js';
import { SmallProseWrapper } from '../ui/ProseWrappers.js';
import { ToolHeaderWrapper, ToolChildrenWrapper, BottomChildren, CodeChildren, ToolHeaderParams } from './ToolHeader.js';
import { getTitle, toolNameToDesc, titleOfBuiltinToolName } from './toolUtils.js';
import { voidOpenFileFn } from '../utils/openFile.js';
import { getBasename } from '../utils/fileUtils.js';
import { RawToolCallObj } from '../../../../common/sendLLMMessageTypes.js';
import { isABuiltinToolName } from '../../../../common/prompt/prompts.js';
import { IconLoading } from '../icons/index.js';

type EditToolProps = {
	toolMessage: Exclude<ToolMessage<'edit_file' | 'rewrite_file'>, { type: 'invalid_params' }>;
	messageIdx: number;
	threadId: string;
	content: string;
};

export const EditTool = ({ toolMessage, threadId, messageIdx, content }: EditToolProps) => {
	const accessor = useAccessor()
	const isError = false
	const isRejected = toolMessage.type === 'rejected'

	const title = getTitle(toolMessage)

	const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
	const icon = null

	const { rawParams, params, name } = toolMessage
	const desc1OnClick = () => voidOpenFileFn(params.uri, accessor)
	const componentParams: ToolHeaderParams = { title, desc1, desc1OnClick, desc1Info, isError, icon, isRejected, }

	const editToolType = toolMessage.name === 'edit_file' ? 'diff' : 'rewrite'
	if (toolMessage.type === 'running_now' || toolMessage.type === 'tool_request') {
		componentParams.children = <ToolChildrenWrapper className='bg-void-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>
		// JumpToFileButton removed in favor of FileLinkText
	}
	else if (toolMessage.type === 'success' || toolMessage.type === 'rejected' || toolMessage.type === 'tool_error') {
		// add apply box
		const applyBoxId = getApplyBoxId({
			threadId: threadId,
			messageIdx: messageIdx,
			tokenIdx: 'N/A',
		})
		componentParams.desc2 = <EditToolHeaderButtons
			applyBoxId={applyBoxId}
			uri={params.uri}
			codeStr={content}
			toolName={name}
			threadId={threadId}
		/>

		// add children
		componentParams.children = <ToolChildrenWrapper className='bg-void-bg-3'>
			<EditToolChildren
				uri={params.uri}
				code={content}
				type={editToolType}
			/>
		</ToolChildrenWrapper>

		if (toolMessage.type === 'success' || toolMessage.type === 'rejected') {
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Lint errors'>
				{result?.lintErrors?.map((error, i) => (
					<div key={i} className='whitespace-nowrap'>Lines {error.startLineNumber}-{error.endLineNumber}: {error.message}</div>
				))}
			</BottomChildren>
		}
		else if (toolMessage.type === 'tool_error') {
			// error
			const { result } = toolMessage
			componentParams.bottomChildren = <BottomChildren title='Error'>
				<CodeChildren>
					{result}
				</CodeChildren>
			</BottomChildren>
		}
	}

	return <ToolHeaderWrapper {...componentParams} />
}

export const EditToolChildren = ({ uri, code, type }: { uri: URI | undefined, code: string, type: 'diff' | 'rewrite' }) => {
	const content = type === 'diff' ?
		<VoidDiffEditor uri={uri} searchReplaceBlocks={code} />
		: <ChatMarkdownRender string={`\`\`\`\n${code}\n\`\`\``} codeURI={uri} chatMessageLocation={undefined} />

	return <div className='!select-text cursor-auto'>
		<SmallProseWrapper>
			{content}
		</SmallProseWrapper>
	</div>
}

export const EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, toolName, threadId }: { threadId: string, applyBoxId: string, uri: URI, codeStr: string, toolName: 'edit_file' | 'rewrite_file' }) => {
	const { streamState } = useEditToolStreamState({ applyBoxId, uri })
	return <div className='flex items-center gap-1'>
		{/* <StatusIndicatorForApplyButton applyBoxId={applyBoxId} uri={uri} /> */}
		{/* <JumpToFileButton uri={uri} /> */}
		{streamState === 'idle-no-changes' && <CopyButton codeStr={codeStr} toolTipName='Copy' />}
		<EditToolAcceptRejectButtonsHTML type={toolName} codeStr={codeStr} applyBoxId={applyBoxId} uri={uri} threadId={threadId} />
	</div>
}

export const EditToolSoFar = ({ toolCallSoFar, }: { toolCallSoFar: RawToolCallObj }) => {

	if (!isABuiltinToolName(toolCallSoFar.name)) return null

	const accessor = useAccessor()

	const uri = toolCallSoFar.rawParams.uri ? URI.file(toolCallSoFar.rawParams.uri) : undefined

	const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed

	const uriDone = toolCallSoFar.doneParams.includes('uri')
	const desc1 = <span className='flex items-center'>
		{uriDone ?
			getBasename(toolCallSoFar.rawParams['uri'] ?? 'unknown')
			: `Generating`}
		<IconLoading />
	</span>

	const desc1OnClick = () => { uri && voidOpenFileFn(uri, accessor) }

	// If URI has not been specified
	return <ToolHeaderWrapper
		title={title}
		desc1={desc1}
		desc1OnClick={desc1OnClick}
	>
		<EditToolChildren
			uri={uri}
			code={toolCallSoFar.rawParams.search_replace_blocks ?? toolCallSoFar.rawParams.new_content ?? ''}
			type={'rewrite'} // as it streams, show in rewrite format, don't make a diff editor
		/>
		<IconLoading />
	</ToolHeaderWrapper>

}
