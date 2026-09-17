# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, copy_metadata, collect_submodules
from pathlib import Path

block_cipher = None

datas = [
    ('web/dist', 'web/dist'),
    ('.env.example', '.'),
    ('private_knowledge', 'private_knowledge'),
]

datas += collect_data_files('jieba')
datas += collect_data_files('chromadb')
datas += collect_data_files('webview')
datas += collect_data_files('clr_loader')
datas += copy_metadata('tiktoken')
datas += copy_metadata('tqdm')
datas += copy_metadata('regex')
datas += copy_metadata('requests')
datas += copy_metadata('packaging')
datas += copy_metadata('pywebview')

hiddenimports = [
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'starlette.staticfiles',
    'starlette.routing',
    'fastapi',
    'pydantic',
    'pydantic_settings',
    'tiktoken',
    'tiktoken_ext',
    'tiktoken_ext.openai_public',
    'jieba',
    'rank_bm25',
    'openai',
    'httpx',
    'docx',
    'chromadb',
    'numpy',
    'loguru',
    'webview',
    'webview.platforms.winforms',
    'webview.platforms.edgechromium',
    'clr',
    'clr_loader',
    'pythonnet',
]

hiddenimports += collect_submodules('chromadb')
hiddenimports += collect_submodules('tiktoken_ext')
hiddenimports += collect_submodules('webview')
hiddenimports += collect_submodules('pythonnet')

a = Analysis(
    ['desktop_launcher.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'tests'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='RAG-GK',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='RAG-GK',
)
