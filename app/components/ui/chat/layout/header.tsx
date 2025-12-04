"use client";

import { Sparkles, Star } from "lucide-react";
import Image from "next/image";
import { LLAMA_LOGO_URL } from "../../../../constants";

export function DefaultHeader() {
	return (
		<div className="flex items-center justify-between p-2 px-4">
			<div className="flex items-center gap-2">
				<Sparkles className="size-4" />
				<h1 className="font-semibold">LlamaIndex Workflow Chat</h1>
			</div>
			<div className="flex items-center justify-end gap-4">
				<div className="flex items-center gap-2">
					<a
						href="https://www.llamaindex.ai/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
					>
						Built using LlamaIndex
					</a>
					<Image
						width={24}
						height={24}
						className="rounded-sm"
						src={LLAMA_LOGO_URL}
						alt="Llama Logo"
					/>
				</div>
				<a
					href="https://github.com/marcusschiesser/llamaindex-workflow-starter"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:bg-accent flex items-center gap-2 rounded-md border border-gray-300 px-2 py-1 text-sm"
				>
					<Star className="size-4" />
					Star on GitHub
				</a>
			</div>
		</div>
	);
}
