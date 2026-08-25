import os
from typing import Dict, Any, Tuple
import docx
from docx.table import Table
from docx.text.paragraph import Paragraph
from loguru import logger


class DocumentLoader:
    """
    统一文档加载器：
    支持 .docx, .txt, .md 格式，将其无损/语义化转换为标准的 Markdown 格式。
    """

    SUPPORTED_EXTENSIONS = {".docx", ".doc", ".txt", ".md"}

    @classmethod
    def load(cls, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """
        加载文件并返回 (markdown_content, metadata)
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_name = os.path.basename(file_path)
        ext = os.path.splitext(file_name)[-1].lower()

        if ext not in cls.SUPPORTED_EXTENSIONS:
            raise ValueError(f"暂不支持的文件格式 '{ext}'。当前仅支持: {cls.SUPPORTED_EXTENSIONS}")

        metadata = {
            "file_name": file_name,
            "file_path": os.path.abspath(file_path),
            "file_size": os.path.getsize(file_path),
            "extension": ext
        }

        if ext == ".docx":
            content = cls._load_docx(file_path)
        elif ext == ".doc":
            # 对于旧版 .doc 给出明确提示或兼容
            raise ValueError("暂不支持老旧二进制 .doc 格式，请在 Word 中另存为 .docx 格式后再上传。")
        elif ext in [".txt", ".md"]:
            content = cls._load_text_file(file_path)
        else:
            content = ""

        return content, metadata

    @classmethod
    def load_bytes(cls, file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
        """
        直接从二进制字节流加载文件（便于 FastAPI UploadFile 直接解析）
        """
        import io
        ext = os.path.splitext(file_name)[-1].lower()

        if ext not in cls.SUPPORTED_EXTENSIONS:
            raise ValueError(f"暂不支持的文件格式 '{ext}'。当前仅支持: {cls.SUPPORTED_EXTENSIONS}")

        metadata = {
            "file_name": file_name,
            "file_size": len(file_bytes),
            "extension": ext
        }

        if ext == ".docx":
            doc = docx.Document(io.BytesIO(file_bytes))
            content = cls._parse_docx_document(doc)
        elif ext in [".txt", ".md"]:
            content = cls._decode_bytes(file_bytes)
        else:
            content = ""

        return content, metadata

    @classmethod
    def _load_docx(cls, file_path: str) -> str:
        doc = docx.Document(file_path)
        return cls._parse_docx_document(doc)

    @classmethod
    def _parse_docx_document(cls, doc: docx.Document) -> str:
        """
        将 python-docx Document 实例转换为包含标题与表格的 Markdown 字符串
        """
        md_lines = []
        for element in doc.element.body:
            if element.tag.endswith('p'):
                p = Paragraph(element, doc)
                text = p.text.strip()
                if not text:
                    continue

                style_name = p.style.name.lower()
                # 识别常见的 Heading 样式
                if "heading 1" in style_name:
                    md_lines.append(f"\n# {text}\n")
                elif "heading 2" in style_name:
                    md_lines.append(f"\n## {text}\n")
                elif "heading 3" in style_name:
                    md_lines.append(f"\n### {text}\n")
                elif "heading 4" in style_name:
                    md_lines.append(f"\n#### {text}\n")
                elif "title" in style_name:
                    md_lines.append(f"\n# {text}\n")
                else:
                    md_lines.append(f"{text}\n")

            elif element.tag.endswith('tbl'):
                t = Table(element, doc)
                table_md = []
                col_count = len(t.columns)
                for row_idx, row in enumerate(t.rows):
                    row_cells = [cell.text.strip().replace("\n", " ").replace("|", "\\|") for cell in row.cells]
                    # 避免空行
                    if not any(row_cells):
                        continue
                    table_md.append("| " + " | ".join(row_cells) + " |")
                    if row_idx == 0:
                        table_md.append("| " + " | ".join(["---"] * len(row_cells)) + " |")
                
                if table_md:
                    md_lines.append("\n" + "\n".join(table_md) + "\n")

        return "\n".join(md_lines).strip()

    @classmethod
    def _load_text_file(cls, file_path: str) -> str:
        encodings = ["utf-8", "gbk", "gb2312", "utf-16", "latin-1"]
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    return f.read().strip()
            except UnicodeDecodeError:
                continue
        raise ValueError(f"无法自动识别文件编码: {file_path}")

    @classmethod
    def _decode_bytes(cls, b: bytes) -> str:
        encodings = ["utf-8", "gbk", "gb2312", "utf-16", "latin-1"]
        for enc in encodings:
            try:
                return b.decode(enc).strip()
            except UnicodeDecodeError:
                continue
        raise ValueError("无法自动识别二进制文本编码")
