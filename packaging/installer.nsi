; RAG-GK NSIS 安装包构建脚本
Unicode true
!include "MUI2.nsh"

; 应用信息
!define PRODUCT_NAME "RAG-GK 知识库问答系统"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "RAG-GK Team"
!define PRODUCT_EXE "RAG-GK.exe"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_EXE}"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"

; 安装包设置
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist\RAG-GK_v1.0.0_Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\RAG-GK"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel user
SetCompressor /SOLID lzma

; MUI 现代化向导配置
!define MUI_ABORTWARNING

; 安装向导页面
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; 安装完成页面（支持勾选立即运行）
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即运行 ${PRODUCT_NAME}"
!insertmacro MUI_PAGE_FINISH

; 卸载向导页面
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; 语言配置：简体中文
!insertmacro MUI_LANGUAGE "SimpChinese"

; 主安装段
Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; 复制 PyInstaller 生成的全部文件
    File /r "..\dist\RAG-GK\*.*"

    ; 创建开始菜单项与桌面快捷方式
    CreateDirectory "$SMPROGRAMS\RAG-GK"
    CreateShortcut "$SMPROGRAMS\RAG-GK\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
    CreateShortcut "$SMPROGRAMS\RAG-GK\卸载 ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0

    ; 生成卸载程序
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; 写入 Windows 注册表（使控制面板“应用与功能”能正确识别与卸载）
    WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_EXE}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

; 卸载段
Section Uninstall
    ; 清理快捷方式
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
    Delete "$SMPROGRAMS\RAG-GK\${PRODUCT_NAME}.lnk"
    Delete "$SMPROGRAMS\RAG-GK\卸载 ${PRODUCT_NAME}.lnk"
    RMDir "$SMPROGRAMS\RAG-GK"

    ; 清理注册表
    DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"

    ; 清理程序安装目录
    RMDir /r "$INSTDIR"

    SetAutoClose true
SectionEnd
