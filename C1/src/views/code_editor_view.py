# src/views/code_editor_view.py - 代码编辑器视图
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import os
import json
import re
from typing import Dict, List, Optional, Tuple
import threading
import time


class CodeTab:
    """代码标签页"""
    
    def __init__(self, parent, file_path: str, plugin_name: str):
        self.parent = parent
        self.file_path = file_path
        self.plugin_name = plugin_name
        self.filename = os.path.basename(file_path)
        self.content = ""
        self.modified = False
        self.original_content = ""
        self.tab_id = None
        
        # 加载文件内容
        self.load_content()
    
    def load_content(self):
        """加载文件内容"""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                self.content = f.read()
                self.original_content = self.content
                self.modified = False
        except Exception as e:
            self.content = f"# 无法加载文件: {self.file_path}\n# 错误: {e}"
            self.original_content = self.content
    
    def save_content(self) -> bool:
        """保存文件内容"""
        try:
            # 创建备份
            self.create_backup()
            
            # 保存文件
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.write(self.content)
            
            self.modified = False
            self.original_content = self.content
            return True
        except Exception as e:
            messagebox.showerror("保存失败", f"无法保存文件: {e}")
            return False
    
    def create_backup(self):
        """创建备份文件"""
        try:
            backup_dir = "backups"
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir)
            
            # 创建插件备份目录
            plugin_backup_dir = os.path.join(backup_dir, self.plugin_name)
            if not os.path.exists(plugin_backup_dir):
                os.makedirs(plugin_backup_dir)
            
            # 生成备份文件名
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{self.filename}.{timestamp}.bak"
            backup_path = os.path.join(plugin_backup_dir, backup_filename)
            
            # 保存备份
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(self.original_content)
                
        except Exception as e:
            print(f"创建备份失败: {e}")
    
    def is_modified(self) -> bool:
        """检查是否已修改"""
        return self.content != self.original_content
    
    def get_short_name(self) -> str:
        """获取短文件名"""
        return self.filename
    
    def get_display_name(self) -> str:
        """获取显示名称"""
        if self.modified:
            return f"{self.filename} *"
        return self.filename


class CodeEditorView:
    """代码编辑器视图"""
    
    def __init__(self, root, plugin_manager, config_manager):
        self.root = root
        self.plugin_manager = plugin_manager
        self.config_manager = config_manager
        
        self.window = None
        self.notebook = None
        self.tabs: Dict[str, CodeTab] = {}
        self.current_tab_id = None
        
        # 语法高亮配置
        self.syntax_colors = {
            'keyword': '#FF6B6B',      # 关键字 - 红色
            'string': '#4ECDC4',       # 字符串 - 青色
            'comment': '#95A5A6',      # 注释 - 灰色
            'function': '#F39C12',     # 函数 - 橙色
            'number': '#9B59B6',       # 数字 - 紫色
            'operator': '#E74C3C',     # 操作符 - 深红色
            'default': '#2C3E50'       # 默认 - 深色
        }
        
        # Python关键字
        self.python_keywords = {
            'False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class',
            'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
            'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
            'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
            'while', 'with', 'yield'
        }
        
        # 错误提示
        self.error_markers = []
        self.error_list = []
    
    def show_code_editor(self, plugin_id: str = None):
        """显示代码编辑器"""
        if self.window is None or not self.window.winfo_exists():
            self.create_code_editor_window()
        
        if plugin_id:
            self.open_plugin_code(plugin_id)
        
        self.window.deiconify()
        self.window.lift()
    
    def create_code_editor_window(self):
        """创建代码编辑器窗口"""
        self.window = tk.Toplevel(self.root)
        self.window.title("代码编辑器")
        self.window.geometry("1200x800")
        self.window.protocol("WM_DELETE_WINDOW", self.window.withdraw)
        
        # 创建菜单栏
        self.create_menu()
        
        # 创建主框架
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 创建工具栏
        self.create_toolbar(main_frame)
        
        # 创建代码编辑区域
        self.create_code_area(main_frame)
        
        # 创建状态栏
        self.create_status_bar(main_frame)
    
    def create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.window)
        self.window.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建", command=self.new_file)
        file_menu.add_command(label="打开", command=self.open_file)
        file_menu.add_separator()
        file_menu.add_command(label="保存", command=self.save_current_file)
        file_menu.add_command(label="另存为", command=self.save_as_file)
        file_menu.add_separator()
        file_menu.add_command(label="关闭当前标签", command=self.close_current_tab)
        file_menu.add_command(label="关闭所有标签", command=self.close_all_tabs)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.window.withdraw)
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        edit_menu.add_command(label="撤销", command=self.undo)
        edit_menu.add_command(label="重做", command=self.redo)
        edit_menu.add_separator()
        edit_menu.add_command(label="剪切", command=self.cut)
        edit_menu.add_command(label="复制", command=self.copy)
        edit_menu.add_command(label="粘贴", command=self.paste)
        edit_menu.add_separator()
        edit_menu.add_command(label="全选", command=self.select_all)
        
        # 插件菜单
        plugin_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="插件", menu=plugin_menu)
        plugin_menu.add_command(label="重新加载插件", command=self.reload_current_plugin)
        plugin_menu.add_command(label="备份插件", command=self.backup_current_plugin)
        plugin_menu.add_command(label="恢复插件", command=self.restore_plugin)
        
        # 工具菜单
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="语法检查", command=self.check_syntax)
        tools_menu.add_command(label="格式化代码", command=self.format_code)
        tools_menu.add_separator()
        tools_menu.add_command(label="查找", command=self.show_find_dialog)
        tools_menu.add_command(label="替换", command=self.show_replace_dialog)
    
    def create_toolbar(self, parent):
        """创建工具栏"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, padx=5, pady=2)
        
        # 文件操作按钮
        file_frame = ttk.LabelFrame(toolbar, text="文件操作")
        file_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(file_frame, text="保存", command=self.save_current_file).pack(side=tk.LEFT, padx=2)
        ttk.Button(file_frame, text="另存为", command=self.save_as_file).pack(side=tk.LEFT, padx=2)
        ttk.Button(file_frame, text="关闭", command=self.close_current_tab).pack(side=tk.LEFT, padx=2)
        
        # 编辑操作按钮
        edit_frame = ttk.LabelFrame(toolbar, text="编辑操作")
        edit_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(edit_frame, text="撤销", command=self.undo).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_frame, text="重做", command=self.redo).pack(side=tk.LEFT, padx=2)
        ttk.Button(edit_frame, text="查找", command=self.show_find_dialog).pack(side=tk.LEFT, padx=2)
        
        # 插件操作按钮
        plugin_frame = ttk.LabelFrame(toolbar, text="插件操作")
        plugin_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(plugin_frame, text="重载插件", command=self.reload_current_plugin).pack(side=tk.LEFT, padx=2)
        ttk.Button(plugin_frame, text="备份", command=self.backup_current_plugin).pack(side=tk.LEFT, padx=2)
        ttk.Button(plugin_frame, text="恢复", command=self.restore_plugin).pack(side=tk.LEFT, padx=2)
        
        # 工具按钮
        tools_frame = ttk.LabelFrame(toolbar, text="工具")
        tools_frame.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(tools_frame, text="语法检查", command=self.check_syntax).pack(side=tk.LEFT, padx=2)
        ttk.Button(tools_frame, text="格式化", command=self.format_code).pack(side=tk.LEFT, padx=2)
    
    def create_code_area(self, parent):
        """创建代码编辑区域"""
        # 创建左右分栏
        code_frame = ttk.Frame(parent)
        code_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 左侧：代码编辑区域
        left_frame = ttk.Frame(code_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 创建标签页控件
        self.notebook = ttk.Notebook(left_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # 绑定标签页事件
        self.notebook.bind("<<NotebookTabChanged>>", self.on_tab_changed)
        
        # 右侧：错误列表
        right_frame = ttk.Frame(code_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(5, 0))
        
        # 错误列表标题
        ttk.Label(right_frame, text="错误列表", font=("Arial", 10, "bold")).pack(pady=5)
        
        # 错误列表
        self.error_listbox = tk.Listbox(right_frame, width=40, height=20)
        error_scroll = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self.error_listbox.yview)
        self.error_listbox.configure(yscrollcommand=error_scroll.set)
        
        self.error_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        error_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定错误列表双击事件
        self.error_listbox.bind("<Double-1>", self.on_error_double_click)
    
    def create_status_bar(self, parent):
        """创建状态栏"""
        status_frame = ttk.Frame(parent)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(status_frame, text="就绪")
        self.status_label.pack(side=tk.LEFT, padx=5)
        
        self.position_label = ttk.Label(status_frame, text="行: 1, 列: 1")
        self.position_label.pack(side=tk.RIGHT, padx=5)
    
    def open_plugin_code(self, plugin_id: str):
        """打开插件代码"""
        plugin = self.plugin_manager.get_plugin(plugin_id)
        if not plugin:
            messagebox.showerror("错误", f"找不到插件: {plugin_id}")
            return
        
        # 查找插件文件
        plugin_file = None
        plugin_dir = self.plugin_manager.get_plugin_directory()
        
        for filename in os.listdir(plugin_dir):
            if filename.endswith('.py') and not filename.startswith('__'):
                if filename.startswith(plugin_id) or plugin_id in filename:
                    plugin_file = os.path.join(plugin_dir, filename)
                    break
        
        if plugin_file and os.path.exists(plugin_file):
            self.open_file_tab(plugin_file, plugin.name)
        else:
            messagebox.showwarning("警告", f"找不到插件文件: {plugin_id}")
    
    def open_file_tab(self, file_path: str, plugin_name: str = ""):
        """打开文件标签页"""
        # 检查是否已经打开
        if file_path in self.tabs:
            # 切换到已存在的标签页
            self.notebook.select(self.tabs[file_path].tab_id)
            return
        
        # 创建新的代码标签页
        code_tab = CodeTab(self, file_path, plugin_name)
        
        # 创建文本编辑器
        text_frame = ttk.Frame(self.notebook)
        text_widget = scrolledtext.ScrolledText(
            text_frame,
            wrap=tk.NONE,
            font=("Consolas", 10),
            bg="#2C3E50",
            fg="#ECF0F1",
            insertbackground="#ECF0F1",
            selectbackground="#3498DB"
        )
        text_widget.pack(fill=tk.BOTH, expand=True)
        
        # 插入代码内容
        text_widget.insert(tk.END, code_tab.content)
        
        # 绑定文本变化事件
        text_widget.bind("<KeyRelease>", lambda e: self.on_text_changed(file_path))
        text_widget.bind("<ButtonRelease-1>", lambda e: self.update_position())
        
        # 添加到标签页
        tab_id = self.notebook.add(text_frame, text=code_tab.get_display_name())
        code_tab.tab_id = tab_id
        
        # 保存标签页引用
        self.tabs[file_path] = code_tab
        self.current_tab_id = tab_id
        
        # 应用语法高亮
        self.apply_syntax_highlighting(text_widget)
        
        # 更新状态
        self.update_status(f"已打开: {code_tab.filename}")
    
    def on_tab_changed(self, event):
        """标签页切换事件"""
        current_tab = self.notebook.select()
        if current_tab:
            # 更新当前标签页
            for file_path, tab in self.tabs.items():
                if tab.tab_id == current_tab:
                    self.current_tab_id = current_tab
                    self.update_status(f"当前文件: {tab.filename}")
                    break
    
    def on_text_changed(self, file_path: str):
        """文本变化事件"""
        if file_path in self.tabs:
            tab = self.tabs[file_path]
            current_widget = self.get_current_text_widget()
            if current_widget:
                tab.content = current_widget.get(1.0, tk.END)
                tab.modified = tab.is_modified()
                
                # 更新标签页标题
                self.notebook.tab(tab.tab_id, text=tab.get_display_name())
    
    def get_current_text_widget(self):
        """获取当前文本编辑器"""
        if self.current_tab_id:
            current_frame = self.notebook.children[self.notebook.tab(self.current_tab_id, "text")]
            for child in current_frame.winfo_children():
                if isinstance(child, scrolledtext.ScrolledText):
                    return child
        return None
    
    def get_current_tab(self) -> Optional[CodeTab]:
        """获取当前标签页"""
        if self.current_tab_id:
            for tab in self.tabs.values():
                if tab.tab_id == self.current_tab_id:
                    return tab
        return None
    
    def apply_syntax_highlighting(self, text_widget):
        """应用语法高亮"""
        # 清除现有标签
        text_widget.tag_remove("keyword", "1.0", tk.END)
        text_widget.tag_remove("string", "1.0", tk.END)
        text_widget.tag_remove("comment", "1.0", tk.END)
        text_widget.tag_remove("function", "1.0", tk.END)
        text_widget.tag_remove("number", "1.0", tk.END)
        
        # 配置标签颜色
        text_widget.tag_configure("keyword", foreground=self.syntax_colors['keyword'])
        text_widget.tag_configure("string", foreground=self.syntax_colors['string'])
        text_widget.tag_configure("comment", foreground=self.syntax_colors['comment'])
        text_widget.tag_configure("function", foreground=self.syntax_colors['function'])
        text_widget.tag_configure("number", foreground=self.syntax_colors['number'])
        
        # 获取文本内容
        content = text_widget.get(1.0, tk.END)
        
        # 高亮关键字
        for keyword in self.python_keywords:
            start = "1.0"
            while True:
                pos = text_widget.search(keyword, start, tk.END)
                if not pos:
                    break
                end = f"{pos}+{len(keyword)}c"
                text_widget.tag_add("keyword", pos, end)
                start = end
        
        # 高亮字符串
        self.highlight_strings(text_widget)
        
        # 高亮注释
        self.highlight_comments(text_widget)
        
        # 高亮函数定义
        self.highlight_functions(text_widget)
        
        # 高亮数字
        self.highlight_numbers(text_widget)
    
    def highlight_strings(self, text_widget):
        """高亮字符串"""
        content = text_widget.get(1.0, tk.END)
        
        # 查找单引号和双引号字符串
        for quote in ['"', "'"]:
            start = "1.0"
            while True:
                pos = text_widget.search(quote, start, tk.END)
                if not pos:
                    break
                
                # 查找匹配的引号
                line_start = text_widget.index(f"{pos} linestart")
                line_end = text_widget.index(f"{pos} lineend")
                line_content = text_widget.get(line_start, line_end)
                
                # 查找字符串结束位置
                string_end = None
                line_pos = pos.split('.')
                line_num = int(line_pos[0])
                col_num = int(line_pos[1])
                
                # 在当前行中查找匹配的引号
                for i, char in enumerate(line_content[col_num:]):
                    if char == quote:
                        string_end = f"{line_num}.{col_num + i + 1}"
                        break
                
                if string_end:
                    text_widget.tag_add("string", pos, string_end)
                    start = string_end
                else:
                    start = f"{pos}+1c"
    
    def highlight_comments(self, text_widget):
        """高亮注释"""
        content = text_widget.get(1.0, tk.END)
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if '#' in line:
                comment_start = line.find('#')
                start_pos = f"{i+1}.{comment_start}"
                end_pos = f"{i+1}.end"
                text_widget.tag_add("comment", start_pos, end_pos)
    
    def highlight_functions(self, text_widget):
        """高亮函数定义"""
        content = text_widget.get(1.0, tk.END)
        
        # 查找函数定义
        pattern = r'def\s+(\w+)'
        for match in re.finditer(pattern, content):
            start_pos = f"1.0+{match.start()}c"
            end_pos = f"1.0+{match.end()}c"
            text_widget.tag_add("function", start_pos, end_pos)
    
    def highlight_numbers(self, text_widget):
        """高亮数字"""
        content = text_widget.get(1.0, tk.END)
        
        # 查找数字
        pattern = r'\b\d+\.?\d*\b'
        for match in re.finditer(pattern, content):
            start_pos = f"1.0+{match.start()}c"
            end_pos = f"1.0+{match.end()}c"
            text_widget.tag_add("number", start_pos, end_pos)
    
    def update_position(self):
        """更新光标位置显示"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            try:
                position = current_widget.index(tk.INSERT)
                line, col = position.split('.')
                self.position_label.config(text=f"行: {line}, 列: {int(col)+1}")
            except:
                pass
    
    def update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
    
    # 文件操作
    def new_file(self):
        """新建文件"""
        # 创建新标签页
        new_tab = CodeTab(self, "", "新建文件")
        self.open_file_tab("", "新建文件")
    
    def open_file(self):
        """打开文件"""
        file_path = filedialog.askopenfilename(
            title="打开文件",
            filetypes=[
                ("Python文件", "*.py"),
                ("所有文件", "*.*")
            ]
        )
        
        if file_path:
            self.open_file_tab(file_path, "")
    
    def save_current_file(self):
        """保存当前文件"""
        current_tab = self.get_current_tab()
        if current_tab:
            if current_tab.save_content():
                self.update_status(f"已保存: {current_tab.filename}")
                # 更新标签页标题
                self.notebook.tab(current_tab.tab_id, text=current_tab.get_display_name())
            else:
                self.update_status("保存失败")
    
    def save_as_file(self):
        """另存为"""
        current_tab = self.get_current_tab()
        if current_tab:
            file_path = filedialog.asksaveasfilename(
                title="另存为",
                defaultextension=".py",
                filetypes=[("Python文件", "*.py"), ("所有文件", "*.*")]
            )
            
            if file_path:
                try:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(current_tab.content)
                    self.update_status(f"已保存到: {file_path}")
                except Exception as e:
                    messagebox.showerror("保存失败", f"无法保存文件: {e}")
    
    def close_current_tab(self):
        """关闭当前标签页"""
        current_tab = self.get_current_tab()
        if current_tab:
            if current_tab.modified:
                result = messagebox.askyesnocancel(
                    "保存文件",
                    f"文件 {current_tab.filename} 已修改，是否保存？",
                    icon=messagebox.QUESTION
                )
                
                if result is None:  # 取消
                    return
                elif result:  # 是
                    if not current_tab.save_content():
                        return
            
            # 关闭标签页
            self.notebook.forget(current_tab.tab_id)
            del self.tabs[current_tab.file_path]
            
            # 更新当前标签页
            if self.tabs:
                self.current_tab_id = self.notebook.select()
            else:
                self.current_tab_id = None
    
    def close_all_tabs(self):
        """关闭所有标签页"""
        if not self.tabs:
            return
        
        # 检查是否有未保存的文件
        unsaved_files = []
        for tab in self.tabs.values():
            if tab.modified:
                unsaved_files.append(tab.filename)
        
        if unsaved_files:
            result = messagebox.askyesno(
                "保存文件",
                f"以下文件已修改:\n{', '.join(unsaved_files)}\n\n是否保存所有文件？",
                icon=messagebox.QUESTION
            )
            
            if result:
                # 保存所有文件
                for tab in self.tabs.values():
                    if tab.modified:
                        tab.save_content()
        
        # 关闭所有标签页
        for tab in list(self.tabs.values()):
            self.notebook.forget(tab.tab_id)
        
        self.tabs.clear()
    
    # 编辑操作
    def undo(self):
        """撤销"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            try:
                current_widget.edit_undo()
            except tk.TclError:
                pass
    
    def redo(self):
        """重做"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            try:
                current_widget.edit_redo()
            except tk.TclError:
                pass
    
    def cut(self):
        """剪切"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            current_widget.event_generate("<<Cut>>")
    
    def copy(self):
        """复制"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            current_widget.event_generate("<<Copy>>")
    
    def paste(self):
        """粘贴"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            current_widget.event_generate("<<Paste>>")
    
    def select_all(self):
        """全选"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            current_widget.tag_add(tk.SEL, "1.0", tk.END)
            current_widget.mark_set(tk.INSERT, "1.0")
            current_widget.see(tk.INSERT)
    
    # 插件操作
    def reload_current_plugin(self):
        """重新加载当前插件"""
        current_tab = self.get_current_tab()
        if current_tab and current_tab.plugin_name:
            # 查找对应的插件ID
            plugin_id = None
            for pid, plugin in self.plugin_manager.get_all_plugins().items():
                if plugin.name == current_tab.plugin_name:
                    plugin_id = pid
                    break
            
            if plugin_id:
                if self.plugin_manager.reload_plugin(plugin_id):
                    self.update_status(f"已重新加载插件: {current_tab.plugin_name}")
                    # 重新加载文件内容
                    current_tab.load_content()
                    current_widget = self.get_current_text_widget()
                    if current_widget:
                        current_widget.delete(1.0, tk.END)
                        current_widget.insert(1.0, current_tab.content)
                        self.apply_syntax_highlighting(current_widget)
                else:
                    self.update_status(f"重新加载插件失败: {current_tab.plugin_name}")
    
    def backup_current_plugin(self):
        """备份当前插件"""
        current_tab = self.get_current_tab()
        if current_tab:
            current_tab.create_backup()
            self.update_status(f"已备份插件: {current_tab.plugin_name}")
    
    def restore_plugin(self):
        """恢复插件"""
        current_tab = self.get_current_tab()
        if current_tab and current_tab.plugin_name:
            # 显示备份文件选择对话框
            backup_dir = os.path.join("backups", current_tab.plugin_name)
            if os.path.exists(backup_dir):
                backup_files = [f for f in os.listdir(backup_dir) if f.endswith('.bak')]
                if backup_files:
                    # 创建备份文件选择对话框
                    restore_window = tk.Toplevel(self.window)
                    restore_window.title("选择备份文件")
                    restore_window.geometry("400x300")
                    
                    ttk.Label(restore_window, text="选择要恢复的备份文件:").pack(pady=10)
                    
                    # 备份文件列表
                    listbox = tk.Listbox(restore_window)
                    for backup_file in sorted(backup_files, reverse=True):
                        listbox.insert(tk.END, backup_file)
                    listbox.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
                    
                    def restore_selected():
                        selection = listbox.curselection()
                        if selection:
                            backup_file = backup_files[selection[0]]
                            backup_path = os.path.join(backup_dir, backup_file)
                            
                            try:
                                with open(backup_path, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                
                                # 更新当前标签页
                                current_tab.content = content
                                current_tab.modified = True
                                
                                # 更新编辑器
                                current_widget = self.get_current_text_widget()
                                if current_widget:
                                    current_widget.delete(1.0, tk.END)
                                    current_widget.insert(1.0, content)
                                    self.apply_syntax_highlighting(current_widget)
                                
                                self.update_status(f"已恢复备份: {backup_file}")
                                restore_window.destroy()
                                
                            except Exception as e:
                                messagebox.showerror("恢复失败", f"无法恢复备份: {e}")
                    
                    ttk.Button(restore_window, text="恢复", command=restore_selected).pack(pady=10)
                    ttk.Button(restore_window, text="取消", command=restore_window.destroy).pack(pady=5)
                else:
                    messagebox.showinfo("提示", "没有找到备份文件")
            else:
                messagebox.showinfo("提示", "没有找到备份目录")
    
    # 工具操作
    def check_syntax(self):
        """语法检查"""
        current_tab = self.get_current_tab()
        if current_tab:
            try:
                # 清空错误列表
                self.error_listbox.delete(0, tk.END)
                
                # 获取当前内容
                content = current_tab.content
                if not content.strip():
                    self.update_status("文件为空，无需语法检查")
                    return
                
                # 基本语法检查
                syntax_errors = []
                
                # 检查缩进
                lines = content.split('\n')
                for i, line in enumerate(lines, 1):
                    if line.strip():  # 非空行
                        # 检查混合缩进
                        if '\t' in line and '    ' in line:
                            syntax_errors.append(f"行 {i}: 混合使用制表符和空格")
                        
                        # 检查缩进是否一致
                        indent = len(line) - len(line.lstrip())
                        if indent % 4 != 0:
                            syntax_errors.append(f"行 {i}: 缩进不是4的倍数")
                
                # 检查基本语法结构
                try:
                    compile(content, current_tab.filename, 'exec')
                except SyntaxError as e:
                    syntax_errors.append(f"语法错误: {e.msg} (行 {e.lineno})")
                except IndentationError as e:
                    syntax_errors.append(f"缩进错误: {e.msg} (行 {e.lineno})")
                except Exception as e:
                    syntax_errors.append(f"编译错误: {e}")
                
                # 检查常见问题
                # 检查未闭合的括号
                open_brackets = {'(': 0, '[': 0, '{': 0}
                close_brackets = {')': '(', ']': '[', '}': '{'}
                
                for i, char in enumerate(content):
                    if char in open_brackets:
                        open_brackets[char] += 1
                    elif char in close_brackets:
                        if open_brackets[close_brackets[char]] > 0:
                            open_brackets[close_brackets[char]] -= 1
                        else:
                            line_num = content[:i].count('\n') + 1
                            syntax_errors.append(f"行 {line_num}: 未匹配的闭合括号 '{char}'")
                
                # 检查未闭合的引号
                in_string = False
                string_char = None
                for i, char in enumerate(content):
                    if char in ['"', "'"] and (i == 0 or content[i-1] != '\\'):
                        if not in_string:
                            in_string = True
                            string_char = char
                        elif char == string_char:
                            in_string = False
                            string_char = None
                
                if in_string:
                    line_num = content.count('\n') + 1
                    syntax_errors.append(f"行 {line_num}: 未闭合的字符串")
                
                # 显示结果
                if syntax_errors:
                    for error in syntax_errors:
                        self.error_listbox.insert(tk.END, error)
                    self.update_status(f"发现 {len(syntax_errors)} 个语法问题")
                    
                    # 跳转到第一个错误
                    if self.error_listbox.size() > 0:
                        self.error_listbox.selection_set(0)
                else:
                    self.update_status("语法检查通过 ✓")
                
            except Exception as e:
                error_msg = f"检查失败: {e}"
                self.error_listbox.insert(tk.END, error_msg)
                self.update_status(error_msg)
    
    def format_code(self):
        """格式化代码"""
        current_widget = self.get_current_text_widget()
        if current_widget:
            try:
                # 获取当前内容
                content = current_widget.get(1.0, tk.END)
                
                # 使用更智能的格式化
                formatted_content = self._format_python_code(content)
                
                # 更新编辑器
                current_widget.delete(1.0, tk.END)
                current_widget.insert(1.0, formatted_content)
                
                # 重新应用语法高亮
                self.apply_syntax_highlighting(current_widget)
                
                self.update_status("代码已格式化 ✓")
                
            except Exception as e:
                messagebox.showerror("格式化失败", f"无法格式化代码: {e}")
    
    def _format_python_code(self, code: str) -> str:
        """格式化Python代码"""
        lines = code.split('\n')
        formatted_lines = []
        indent_level = 0
        in_multiline_string = False
        string_char = None
        
        # Python关键字和缩进规则
        indent_keywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with']
        dedent_keywords = ['return', 'break', 'continue', 'pass', 'raise']
        
        for i, line in enumerate(lines):
            original_line = line
            stripped = line.strip()
            
            # 跳过空行
            if not stripped:
                formatted_lines.append('')
                continue
            
            # 处理多行字符串
            if '"""' in stripped or "'''" in stripped:
                if not in_multiline_string:
                    in_multiline_string = True
                    string_char = '"""' if '"""' in stripped else "'''"
                else:
                    if string_char in stripped:
                        in_multiline_string = False
                        string_char = None
            
            # 如果在多行字符串中，保持原样
            if in_multiline_string:
                formatted_lines.append('    ' * indent_level + stripped)
                continue
            
            # 处理注释
            if stripped.startswith('#'):
                formatted_lines.append('    ' * indent_level + stripped)
                continue
            
            # 处理导入语句
            if stripped.startswith(('import ', 'from ')):
                formatted_lines.append(stripped)
                continue
            
            # 处理类定义
            if stripped.startswith('class '):
                if indent_level > 0:
                    indent_level -= 1
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
                continue
            
            # 处理函数定义
            if stripped.startswith('def '):
                if indent_level > 0:
                    indent_level -= 1
                formatted_lines.append('    ' * indent_level + stripped)
                indent_level += 1
                continue
            
            # 处理控制流语句
            for keyword in indent_keywords:
                if stripped.startswith(keyword + ' ') or stripped.startswith(keyword + ':'):
                    formatted_lines.append('    ' * indent_level + stripped)
                    if stripped.endswith(':'):
                        indent_level += 1
                    break
            else:
                # 处理减少缩进的情况
                for keyword in dedent_keywords:
                    if stripped.startswith(keyword + ' ') or stripped == keyword:
                        if indent_level > 0:
                            indent_level -= 1
                        break
                
                # 处理结束缩进的语句
                if stripped.startswith(('elif ', 'else:', 'except', 'finally:')):
                    if indent_level > 0:
                        indent_level -= 1
                
                formatted_lines.append('    ' * indent_level + stripped)
        
        return '\n'.join(formatted_lines)
    
    def show_find_dialog(self):
        """显示查找对话框"""
        # 创建查找对话框
        find_window = tk.Toplevel(self.window)
        find_window.title("查找")
        find_window.geometry("300x150")
        find_window.transient(self.window)
        find_window.grab_set()
        
        ttk.Label(find_window, text="查找内容:").pack(pady=5)
        
        find_entry = ttk.Entry(find_window, width=30)
        find_entry.pack(pady=5)
        find_entry.focus()
        
        def find_text():
            search_text = find_entry.get()
            if search_text:
                current_widget = self.get_current_text_widget()
                if current_widget:
                    # 清除之前的搜索
                    current_widget.tag_remove("search", "1.0", tk.END)
                    
                    # 查找文本
                    start = "1.0"
                    while True:
                        pos = current_widget.search(search_text, start, tk.END)
                        if not pos:
                            break
                        end = f"{pos}+{len(search_text)}c"
                        current_widget.tag_add("search", pos, end)
                        start = end
                    
                    # 高亮搜索结果
                    current_widget.tag_configure("search", background="yellow", foreground="black")
                    
                    # 跳转到第一个结果
                    first_pos = current_widget.search(search_text, "1.0", tk.END)
                    if first_pos:
                        current_widget.see(first_pos)
                        current_widget.mark_set(tk.INSERT, first_pos)
        
        ttk.Button(find_window, text="查找", command=find_text).pack(pady=10)
        ttk.Button(find_window, text="取消", command=find_window.destroy).pack(pady=5)
        
        # 绑定回车键
        find_entry.bind("<Return>", lambda e: find_text())
    
    def show_replace_dialog(self):
        """显示替换对话框"""
        # 创建替换对话框
        replace_window = tk.Toplevel(self.window)
        replace_window.title("替换")
        replace_window.geometry("300x200")
        replace_window.transient(self.window)
        replace_window.grab_set()
        
        ttk.Label(replace_window, text="查找内容:").pack(pady=5)
        find_entry = ttk.Entry(replace_window, width=30)
        find_entry.pack(pady=5)
        
        ttk.Label(replace_window, text="替换为:").pack(pady=5)
        replace_entry = ttk.Entry(replace_window, width=30)
        replace_entry.pack(pady=5)
        
        def replace_text():
            find_text = find_entry.get()
            replace_text = replace_entry.get()
            
            if find_text:
                current_widget = self.get_current_text_widget()
                if current_widget:
                    # 获取当前内容
                    content = current_widget.get(1.0, tk.END)
                    
                    # 执行替换
                    new_content = content.replace(find_text, replace_text)
                    
                    # 更新编辑器
                    current_widget.delete(1.0, tk.END)
                    current_widget.insert(1.0, new_content)
                    
                    # 重新应用语法高亮
                    self.apply_syntax_highlighting(current_widget)
                    
                    self.update_status(f"已替换 {content.count(find_text)} 处")
        
        ttk.Button(replace_window, text="替换", command=replace_text).pack(pady=10)
        ttk.Button(replace_window, text="取消", command=replace_window.destroy).pack(pady=5)
    
    def on_error_double_click(self, event):
        """错误列表双击事件"""
        selection = self.error_listbox.curselection()
        if selection:
            error_text = self.error_listbox.get(selection[0])
            
            # 解析错误信息，提取行号
            if "行" in error_text:
                try:
                    line_match = re.search(r'行 (\d+)', error_text)
                    if line_match:
                        line_num = int(line_match.group(1))
                        
                        # 跳转到错误行
                        current_widget = self.get_current_text_widget()
                        if current_widget:
                            current_widget.see(f"{line_num}.0")
                            current_widget.mark_set(tk.INSERT, f"{line_num}.0")
                            current_widget.focus()
                except:
                    pass
    
    def cleanup(self):
        """清理资源"""
        if self.window and self.window.winfo_exists():
            self.window.destroy()
        self.window = None
        self.tabs.clear()
     