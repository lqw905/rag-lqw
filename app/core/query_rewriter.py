# -*- coding: utf-8 -*-
import re
from typing import Optional, List, Dict
from openai import OpenAI, AsyncOpenAI
from loguru import logger
from app.config import settings

CHITCHAT_PATTERNS = {
    "你好", "您好", "hi", "hello", "hey", "在吗", "在不在", "早上好", "下午好", "晚上好",
    "早安", "午安", "晚安", "谢谢", "多谢", "感谢", "thank you", "thanks", "再见", "拜拜", "bye",
    "你是谁", "你叫什么", "你能做什么", "介绍一下你自己", "帮助", "help", "hello there", "halo"
}


def is_chitchat(query: str) -> bool:
    """识别日常闲聊与礼貌问候，避免无效检索污染上下文"""
    q = query.strip().lower()
    q_clean = re.sub(r'[^\w\u4e00-\u9fff]', '', q).strip()
    if not q_clean:
        return True
    if q_clean in CHITCHAT_PATTERNS or q in CHITCHAT_PATTERNS:
        return True
    if len(q_clean) <= 4 and any(w in q_clean for w in ["你好", "您好", "hi", "hello", "在吗", "谢谢", "再见"]):
        return True
    return False


QUERY_REWRITE_SYSTEM_PROMPT = """你是一个智能知识库检索优化器。你的任务是将用户的口语化提问改写为最适合知识库精准匹配的核心检索查询。
【处理规则】：
1. 彻底去除口语化词汇和提问指令（如“讲讲”、“请问”、“我想了解”、“帮我查一下”、“介绍一下”、“说说”等）；
2. 提炼出核心主题、专有名词、核心实体（如历史事件、组织机构、人物、法令法规、专业术语等）；
3. 去除无实质检索价值的宽泛修饰词（如“的基本历程”、“的相关情况”、“详细内容”、“具体有哪些”等），提炼出最核心的检索目标；
4. 如果提供了历史对话上下文，结合上下文进行代词指代消解；
5. 如果用户问题本身已经足够精炼（如单纯的专有名词），直接保持原样；
6. 严格直接输出精简后的检索词或短语（多个关键词可用空格分隔），严禁输出任何解释、标点、前缀或多余文字。"""


class QueryRewriter:
    """轻量级 LLM 查询提纯与重写器"""

    def __init__(
        self,
        base_url: str = settings.OPENAI_BASE_URL,
        api_key: str = settings.OPENAI_API_KEY,
        model: str = settings.LLM_MODEL,
        timeout: float = settings.QUERY_REWRITE_TIMEOUT
    ):
        self.sync_client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        self.async_client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        self.model = model
        self.timeout = timeout

    def _clean_output(self, raw_output: str, original_query: str) -> str:
        """清洗 LLM 输出，剔除多余换行、引导语等"""
        if not raw_output:
            return original_query
        cleaned = raw_output.strip().strip('"\'`')
        # 移除常见的提示前缀如 "提炼结果："、"改写结果："、"检索词："
        cleaned = re.sub(r'^(提炼结果|改写结果|检索词|核心检索词|关键词)\s*[:：]\s*', '', cleaned).strip()
        # 移除可能的多行解释，仅取首行有效词
        first_line = cleaned.splitlines()[0].strip() if cleaned else ""
        if not first_line:
            return original_query
        return first_line

    def _build_messages(self, query: str, chat_history: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": QUERY_REWRITE_SYSTEM_PROMPT}]
        if chat_history:
            recent_turns = chat_history[-4:]
            hist_lines = [f"{m.get('role')}: {m.get('content')}" for m in recent_turns if m.get('content')]
            if hist_lines:
                hist_summary = "\n".join(hist_lines)
                user_content = f"【历史对话】：\n{hist_summary}\n\n【用户当前提问】：{query}\n【提炼检索词】："
            else:
                user_content = f"用户输入：{query}\n提炼检索词："
        else:
            user_content = f"用户输入：{query}\n提炼检索词："
        messages.append({"role": "user", "content": user_content})
        return messages

    def rewrite(self, query: str, chat_history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        同步查询改写：
        - 若字数极短（<=4字）或为纯问候，跳过 LLM 提纯直接返回；
        - 若请求异常或超时，自动平滑降级使用原始 query。
        """
        q = query.strip()
        if not q or is_chitchat(q) or len(q) <= 4:
            return q

        try:
            messages = self._build_messages(q, chat_history)
            resp = self.sync_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=60
            )
            rewritten = resp.choices[0].message.content or ""
            cleaned = self._clean_output(rewritten, q)
            if cleaned != q:
                logger.info(f"Query rewrite: '{q}' -> '{cleaned}'")
            return cleaned
        except Exception as e:
            logger.warning(f"Query rewrite failed ({e}), falling back to original query: '{q}'")
            return q

    async def arewrite(self, query: str, chat_history: Optional[List[Dict[str, str]]] = None) -> str:
        """
        异步查询改写：
        - 配合 FastAPI 异步路由与 SSE 流式接口使用
        """
        q = query.strip()
        if not q or is_chitchat(q) or len(q) <= 4:
            return q

        try:
            messages = self._build_messages(q, chat_history)
            resp = await self.async_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=60
            )
            rewritten = resp.choices[0].message.content or ""
            cleaned = self._clean_output(rewritten, q)
            if cleaned != q:
                logger.info(f"Query rewrite: '{q}' -> '{cleaned}'")
            return cleaned
        except Exception as e:
            logger.warning(f"Query rewrite failed ({e}), falling back to original query: '{q}'")
            return q


query_rewriter = QueryRewriter()
