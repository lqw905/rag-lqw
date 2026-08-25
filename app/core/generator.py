import json
from typing import List, Dict, Any, AsyncGenerator, Tuple
from openai import OpenAI, AsyncOpenAI
from loguru import logger
from app.config import settings
from app.core.splitter import count_tokens

RAG_SYSTEM_PROMPT = """你是一个严谨、专业的企业级知识库问答助手。
请依据下面提供的【参考资料】来回答用户的问题。

【回答规范要求】：
1. **严格基于参考资料**：只能根据提供的参考资料回答问题，严禁凭空捏造事实或产生幻觉。
2. **精准引用标注**：在回答过程中，凡是引用了参考资料中的数据、观点、事实或结论的句子，必须在句末标注对应的引用角标，如 `[1]`、`[2]`。如果一个句子参考了多个文档，标注如 `[1][2]`。
3. **资料不足明确说明**：如果参考资料中没有包含回答问题所需的信息，请明确告知用户“根据现有参考资料，无法回答此问题”，不要编造答案。
4. **结构清晰**：回答语言精炼、重点突出，使用 Markdown 格式（粗体、列表、代码块等）使阅读更舒适。

【参考资料】：
{context}
"""

CHITCHAT_SYSTEM_PROMPT = """你是一个严谨、亲和的企业级知识库问答助手。
当前用户正在进行日常问候、功能咨询或未命中知识库内容。
【规范要求】：
1. 请用礼貌、亲和、专业的语气回应用户，并引导用户针对已上传的文档提出具体业务或技术问题；
2. 若用户提出的是通用问题但当前知识库未收录，请委婉说明当前知识库暂未收录相关资料；
3. 本次回答无需标注任何引用角标（如 [1] 等）。
"""


class RAGGenerator:
    """RAG 问答与流式生成引擎"""

    def __init__(
        self,
        base_url: str = settings.OPENAI_BASE_URL,
        api_key: str = settings.OPENAI_API_KEY,
        model: str = settings.LLM_MODEL,
        temperature: float = settings.LLM_TEMPERATURE,
        max_tokens: int = settings.LLM_MAX_TOKENS
    ):
        self.sync_client = OpenAI(base_url=base_url, api_key=api_key)
        self.async_client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    def format_context(self, retrieved_chunks: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
        """
        将召回的切片格式化为规范的 Context 字符串并生成前端引用元数据
        """
        if not retrieved_chunks:
            return "", []

        context_parts = []
        references = []

        for idx, chunk in enumerate(retrieved_chunks, start=1):
            doc_name = chunk.get("doc_name", "未知文档")
            header_path = chunk.get("header_path", "")
            content = chunk.get("content", "").strip()

            header_str = f" > {header_path}" if header_path else ""
            context_parts.append(
                f"[文档{idx}] (来源: {doc_name}{header_str})\n{content}"
            )

            references.append({
                "ref_id": idx,
                "chunk_id": chunk.get("chunk_id"),
                "doc_name": doc_name,
                "header_path": header_path,
                "score": chunk.get("score", 0.0),
                "snippet": content[:300] + ("..." if len(content) > 300 else ""),
                "full_content": content
            })

        return "\n\n".join(context_parts), references

    def build_messages(
        self,
        query: str,
        context_str: str,
        chat_history: List[Dict[str, str]] = None,
        has_context: bool = True
    ) -> List[Dict[str, str]]:
        """组装完整的多轮对话消息与 Token 预算控制"""
        if has_context and context_str.strip():
            system_content = RAG_SYSTEM_PROMPT.format(context=context_str)
        else:
            system_content = CHITCHAT_SYSTEM_PROMPT

        messages = [{"role": "system", "content": system_content}]

        # 拼接历史对话（若有）
        if chat_history:
            for msg in chat_history[-6:]:  # 最多保留最近 3 轮
                if msg.get("role") in ["user", "assistant"] and msg.get("content"):
                    messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": query})
        return messages

    async def generate_stream(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        chat_history: List[Dict[str, str]] = None
    ) -> AsyncGenerator[str, None]:
        """
        SSE 流式生成生成器：
        1. 首先推送 references 元数据
        2. 逐步推送 delta 内容
        3. 最后推送完成标记
        """
        has_context = bool(retrieved_chunks)
        context_str, references = self.format_context(retrieved_chunks)
        messages = self.build_messages(query, context_str, chat_history, has_context=has_context)

        # 1. 发送参考资料引用列表（若无命中切片，则推送空数组）
        ref_event = {
            "type": "references",
            "references": references
        }
        yield f"data: {json.dumps(ref_event, ensure_ascii=False)}\n\n"

        # 2. 调用模型流式输出
        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True
            )

            async for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        delta_event = {
                            "type": "delta",
                            "delta": delta.content
                        }
                        yield f"data: {json.dumps(delta_event, ensure_ascii=False)}\n\n"

            # 3. 完成标记
            done_event = {"type": "done"}
            yield f"data: {json.dumps(done_event, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"LLM streaming generation failed: {e}")
            err_event = {
                "type": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(err_event, ensure_ascii=False)}\n\n"

    def generate_sync(
        self,
        query: str,
        retrieved_chunks: List[Dict[str, Any]],
        chat_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """非流式直接生成"""
        has_context = bool(retrieved_chunks)
        context_str, references = self.format_context(retrieved_chunks)
        messages = self.build_messages(query, context_str, chat_history, has_context=has_context)

        try:
            response = self.sync_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=False
            )
            answer = response.choices[0].message.content or ""
            return {
                "answer": answer,
                "references": references,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0
                }
            }
        except Exception as e:
            logger.error(f"LLM synchronous generation failed: {e}")
            raise e


# 全局单例
generator = RAGGenerator()
